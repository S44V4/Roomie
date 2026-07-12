import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, desc } from "drizzle-orm";
import {
  db,
  choreAssignmentsTable,
  choresTable,
  usersTable,
  householdMembersTable,
} from "@workspace/db";
import { MarkAssignmentDoneParams } from "@workspace/api-zod";

const router: IRouter = Router();

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function getUserHouseholdId(userId: number): Promise<number | null> {
  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));
  return member?.householdId ?? null;
}

async function getHouseholdChoreIds(householdId: number): Promise<number[]> {
  const chores = await db
    .select({ id: choresTable.id })
    .from(choresTable)
    .where(eq(choresTable.householdId, householdId));
  return chores.map((c) => c.id);
}

async function enrichAssignments(
  assignments: (typeof choreAssignmentsTable.$inferSelect)[],
) {
  if (!assignments.length) return [];

  // Get unique chore IDs and user IDs
  const choreIds = [...new Set(assignments.map((a) => a.choreId))];
  const userIds = [...new Set(assignments.map((a) => a.userId))];

  const [chores, users] = await Promise.all([
    db
      .select({ id: choresTable.id, name: choresTable.name })
      .from(choresTable)
      .where(
        choreIds.length === 1
          ? eq(choresTable.id, choreIds[0])
          : eq(choresTable.id, choreIds[0]), // will fetch individually below
      ),
    db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(
        userIds.length === 1
          ? eq(usersTable.id, userIds[0])
          : eq(usersTable.id, userIds[0]),
      ),
  ]);

  // Fetch all chores/users by IDs
  const allChores = await Promise.all(
    choreIds.map((id) =>
      db.select().from(choresTable).where(eq(choresTable.id, id)).then((r) => r[0]),
    ),
  );
  const allUsers = await Promise.all(
    userIds.map((id) =>
      db.select().from(usersTable).where(eq(usersTable.id, id)).then((r) => r[0]),
    ),
  );

  const choreMap = new Map(
    allChores
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => [c.id, c.name]),
  );
  const userMap = new Map(
    allUsers
      .filter((u): u is NonNullable<typeof u> => u != null)
      .map((u) => [u.id, u.name]),
  );

  return assignments.map((a) => ({
    id: a.id,
    choreId: a.choreId,
    choreName: choreMap.get(a.choreId) ?? "Unknown",
    userId: a.userId,
    userName: userMap.get(a.userId) ?? "Unknown",
    date: a.date,
    status: a.status,
    confirmedAt: a.confirmedAt ? a.confirmedAt.toISOString() : null,
  }));
}

router.get("/assignments/today", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const today = toDateStr(new Date());
  const assignments = await db
    .select()
    .from(choreAssignmentsTable)
    .where(
      and(
        eq(choreAssignmentsTable.userId, req.session.userId),
        eq(choreAssignmentsTable.date, today),
      ),
    );

  const enriched = await enrichAssignments(assignments);
  res.json(enriched);
});

router.get("/assignments/upcoming", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.json([]);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 14);

  const todayStr = toDateStr(today);
  const endStr = toDateStr(endDate);

  const choreIds = await getHouseholdChoreIds(householdId);
  if (!choreIds.length) {
    res.json([]);
    return;
  }

  const allAssignments: (typeof choreAssignmentsTable.$inferSelect)[] = [];
  for (const choreId of choreIds) {
    const rows = await db
      .select()
      .from(choreAssignmentsTable)
      .where(
        and(
          eq(choreAssignmentsTable.choreId, choreId),
          gte(choreAssignmentsTable.date, todayStr),
          lte(choreAssignmentsTable.date, endStr),
        ),
      );
    allAssignments.push(...rows);
  }

  allAssignments.sort((a, b) => a.date.localeCompare(b.date));
  const enriched = await enrichAssignments(allAssignments);
  res.json(enriched);
});

router.get("/assignments/history", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.json([]);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const choreIds = await getHouseholdChoreIds(householdId);
  if (!choreIds.length) {
    res.json([]);
    return;
  }

  const allAssignments: (typeof choreAssignmentsTable.$inferSelect)[] = [];
  for (const choreId of choreIds) {
    const rows = await db
      .select()
      .from(choreAssignmentsTable)
      .where(
        and(
          eq(choreAssignmentsTable.choreId, choreId),
          lt(choreAssignmentsTable.date, todayStr),
        ),
      );
    allAssignments.push(...rows);
  }

  // Sort by date descending, limit to last 60 days of history
  allAssignments.sort((a, b) => b.date.localeCompare(a.date));
  const limited = allAssignments.slice(0, 100);

  const enriched = await enrichAssignments(limited);
  res.json(enriched);
});

router.patch(
  "/assignments/:assignmentId/done",
  async (req, res): Promise<void> => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const params = MarkAssignmentDoneParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [assignment] = await db
      .select()
      .from(choreAssignmentsTable)
      .where(eq(choreAssignmentsTable.id, params.data.assignmentId));

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    if (assignment.userId !== req.session.userId) {
      res.status(403).json({ error: "You can only mark your own assignments as done" });
      return;
    }

    const [updated] = await db
      .update(choreAssignmentsTable)
      .set({ status: "done", confirmedAt: new Date() })
      .where(eq(choreAssignmentsTable.id, assignment.id))
      .returning();

    const enriched = await enrichAssignments([updated]);
    res.json(enriched[0]);
  },
);

export default router;
