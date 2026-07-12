import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, householdsTable, householdMembersTable } from "@workspace/db";
import { CreateHouseholdBody, JoinHouseholdBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function requireAuthUser(req: any, res: any): Promise<number | null> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId as number;
}

router.post("/households", async (req, res): Promise<void> => {
  const userId = await requireAuthUser(req, res);
  if (!userId) return;

  const parsed = CreateHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check user not already in a household
  const [existingMember] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (existingMember) {
    res.status(409).json({ error: "You already belong to a household" });
    return;
  }

  const inviteCode = generateInviteCode();
  const [household] = await db
    .insert(householdsTable)
    .values({
      name: parsed.data.name,
      inviteCode,
      adminUserId: userId,
    })
    .returning();

  await db.insert(householdMembersTable).values({
    householdId: household.id,
    userId,
  });

  res.status(201).json({
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    adminUserId: household.adminUserId,
  });
});

router.get("/households/me", async (req, res): Promise<void> => {
  const userId = await requireAuthUser(req, res);
  if (!userId) return;

  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (!member) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.id, member.householdId));

  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return;
  }

  res.json({
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    adminUserId: household.adminUserId,
  });
});

router.post("/households/join", async (req, res): Promise<void> => {
  const userId = await requireAuthUser(req, res);
  if (!userId) return;

  const parsed = JoinHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingMember] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (existingMember) {
    res.status(409).json({ error: "You already belong to a household" });
    return;
  }

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.inviteCode, parsed.data.inviteCode.toUpperCase()));

  if (!household) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }

  await db.insert(householdMembersTable).values({
    householdId: household.id,
    userId,
  });

  res.json({
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    adminUserId: household.adminUserId,
  });
});

router.delete("/households/me/leave", async (req, res): Promise<void> => {
  const userId = await requireAuthUser(req, res);
  if (!userId) return;

  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (!member) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.id, member.householdId));

  // If user is the admin and the sole member, delete the household entirely
  const allMembers = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.householdId, member.householdId));

  if (household?.adminUserId === userId && allMembers.length === 1) {
    await db
      .delete(householdMembersTable)
      .where(eq(householdMembersTable.householdId, member.householdId));
    await db
      .delete(householdsTable)
      .where(eq(householdsTable.id, member.householdId));
  } else if (household?.adminUserId === userId) {
    res.status(403).json({ error: "Transfer admin to another member before leaving" });
    return;
  } else {
    await db
      .delete(householdMembersTable)
      .where(
        and(
          eq(householdMembersTable.householdId, member.householdId),
          eq(householdMembersTable.userId, userId),
        ),
      );
  }

  res.json({ message: "Left household" });
});

router.get("/households/me/members", async (req, res): Promise<void> => {
  const userId = await requireAuthUser(req, res);
  if (!userId) return;

  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));

  if (!member) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const members = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      joinedAt: householdMembersTable.joinedAt,
    })
    .from(householdMembersTable)
    .innerJoin(usersTable, eq(householdMembersTable.userId, usersTable.id))
    .where(eq(householdMembersTable.householdId, member.householdId));

  res.json(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      joinedAt: m.joinedAt.toISOString(),
    })),
  );
});

export default router;
