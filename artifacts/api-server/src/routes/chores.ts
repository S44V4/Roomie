import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  choresTable,
  householdsTable,
  householdMembersTable,
  choreAssignmentsTable,
} from "@workspace/db";
import {
  CreateChoreBody,
  UpdateChoreBody,
  UpdateChoreParams,
  DeleteChoreParams,
  UpdateChoreRotationParams,
  UpdateChoreRotationBody,
} from "@workspace/api-zod";
import { generateAssignmentsForChore } from "../lib/assignments";

const router: IRouter = Router();

async function getHouseholdAndCheckAdmin(
  userId: number,
  res: any,
): Promise<{ householdId: number } | null> {
  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (!member) {
    res.status(404).json({ error: "You are not in a household" });
    return null;
  }

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.id, member.householdId));

  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return null;
  }

  if (household.adminUserId !== userId) {
    res.status(403).json({ error: "Only the household admin can manage chores" });
    return null;
  }

  return { householdId: member.householdId };
}

async function getUserHouseholdId(userId: number): Promise<number | null> {
  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));
  return member?.householdId ?? null;
}

function choreToResponse(chore: typeof choresTable.$inferSelect) {
  return {
    id: chore.id,
    householdId: chore.householdId,
    name: chore.name,
    description: chore.description ?? null,
    frequency: chore.frequency,
    customDays: chore.customDays ?? null,
    rotationOrder: chore.rotationOrder,
  };
}

router.get("/chores", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const chores = await db
    .select()
    .from(choresTable)
    .where(eq(choresTable.householdId, householdId));

  res.json(chores.map(choreToResponse));
});

router.post("/chores", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const ctx = await getHouseholdAndCheckAdmin(req.session.userId, res);
  if (!ctx) return;

  const parsed = CreateChoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [chore] = await db
    .insert(choresTable)
    .values({
      householdId: ctx.householdId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      frequency: parsed.data.frequency,
      customDays: parsed.data.customDays ?? null,
      rotationOrder: parsed.data.rotationOrder,
    })
    .returning();

  // Generate assignments
  await generateAssignmentsForChore(chore.id);

  res.status(201).json(choreToResponse(chore));
});

router.patch("/chores/:choreId", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = UpdateChoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ctx = await getHouseholdAndCheckAdmin(req.session.userId, res);
  if (!ctx) return;

  const [chore] = await db
    .select()
    .from(choresTable)
    .where(
      and(
        eq(choresTable.id, params.data.choreId),
        eq(choresTable.householdId, ctx.householdId),
      ),
    );

  if (!chore) {
    res.status(404).json({ error: "Chore not found" });
    return;
  }

  const parsed = UpdateChoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof choresTable.$inferSelect> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.frequency !== undefined) updates.frequency = parsed.data.frequency;
  if (parsed.data.customDays !== undefined) updates.customDays = parsed.data.customDays ?? null;

  const [updated] = await db
    .update(choresTable)
    .set(updates)
    .where(eq(choresTable.id, chore.id))
    .returning();

  await generateAssignmentsForChore(updated.id);

  res.json(choreToResponse(updated));
});

router.delete("/chores/:choreId", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = DeleteChoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ctx = await getHouseholdAndCheckAdmin(req.session.userId, res);
  if (!ctx) return;

  const [chore] = await db
    .select()
    .from(choresTable)
    .where(
      and(
        eq(choresTable.id, params.data.choreId),
        eq(choresTable.householdId, ctx.householdId),
      ),
    );

  if (!chore) {
    res.status(404).json({ error: "Chore not found" });
    return;
  }

  // Delete all assignments first
  await db
    .delete(choreAssignmentsTable)
    .where(eq(choreAssignmentsTable.choreId, chore.id));

  await db.delete(choresTable).where(eq(choresTable.id, chore.id));

  res.sendStatus(204);
});

router.patch("/chores/:choreId/rotation", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = UpdateChoreRotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ctx = await getHouseholdAndCheckAdmin(req.session.userId, res);
  if (!ctx) return;

  const [chore] = await db
    .select()
    .from(choresTable)
    .where(
      and(
        eq(choresTable.id, params.data.choreId),
        eq(choresTable.householdId, ctx.householdId),
      ),
    );

  if (!chore) {
    res.status(404).json({ error: "Chore not found" });
    return;
  }

  const parsed = UpdateChoreRotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(choresTable)
    .set({ rotationOrder: parsed.data.rotationOrder })
    .where(eq(choresTable.id, chore.id))
    .returning();

  await generateAssignmentsForChore(updated.id);

  res.json(choreToResponse(updated));
});

export default router;
