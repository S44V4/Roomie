import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  expensesTable,
  expenseSplitsTable,
  usersTable,
  householdMembersTable,
} from "@workspace/db";
import { CreateExpenseBody, DeleteExpenseParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function getUserHouseholdId(userId: number): Promise<number | null> {
  const [member] = await db
    .select()
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));
  return member?.householdId ?? null;
}

async function getHouseholdMembers(householdId: number) {
  return db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(householdMembersTable)
    .innerJoin(usersTable, eq(householdMembersTable.userId, usersTable.id))
    .where(eq(householdMembersTable.householdId, householdId));
}

async function enrichExpenses(expenses: (typeof expensesTable.$inferSelect)[]) {
  if (!expenses.length) return [];

  const result = [];
  for (const expense of expenses) {
    const [paidByUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, expense.paidBy));

    const splits = await db
      .select({
        userId: expenseSplitsTable.userId,
        userName: usersTable.name,
        shareAmount: expenseSplitsTable.shareAmount,
      })
      .from(expenseSplitsTable)
      .innerJoin(usersTable, eq(expenseSplitsTable.userId, usersTable.id))
      .where(eq(expenseSplitsTable.expenseId, expense.id));

    result.push({
      id: expense.id,
      householdId: expense.householdId,
      paidBy: expense.paidBy,
      paidByName: paidByUser?.name ?? "Unknown",
      amount: parseFloat(expense.amount),
      description: expense.description,
      date: expense.date,
      splits: splits.map((s) => ({
        userId: s.userId,
        userName: s.userName,
        shareAmount: parseFloat(s.shareAmount),
      })),
    });
  }
  return result;
}

// GET /expenses/balances — must come before /:expenseId
router.get("/expenses/balances", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.json([]);
    return;
  }

  const members = await getHouseholdMembers(householdId);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const balances = new Map<number, number>();
  for (const m of members) {
    balances.set(m.id, 0);
  }

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.householdId, householdId));

  for (const expense of expenses) {
    const amount = parseFloat(expense.amount);
    const splits = await db
      .select()
      .from(expenseSplitsTable)
      .where(eq(expenseSplitsTable.expenseId, expense.id));

    // payer is owed the total amount
    balances.set(expense.paidBy, (balances.get(expense.paidBy) ?? 0) + amount);

    // each person in the split owes their share
    for (const split of splits) {
      balances.set(
        split.userId,
        (balances.get(split.userId) ?? 0) - parseFloat(split.shareAmount),
      );
    }
  }

  const result = Array.from(balances.entries()).map(([userId, balance]) => ({
    userId,
    userName: memberMap.get(userId) ?? "Unknown",
    balance: Math.round(balance * 100) / 100,
  }));

  res.json(result);
});

// GET /expenses/settle — must come before /:expenseId
router.get("/expenses/settle", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.json([]);
    return;
  }

  const members = await getHouseholdMembers(householdId);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const balances = new Map<number, number>();
  for (const m of members) balances.set(m.id, 0);

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.householdId, householdId));

  for (const expense of expenses) {
    const amount = parseFloat(expense.amount);
    const splits = await db
      .select()
      .from(expenseSplitsTable)
      .where(eq(expenseSplitsTable.expenseId, expense.id));

    balances.set(expense.paidBy, (balances.get(expense.paidBy) ?? 0) + amount);
    for (const split of splits) {
      balances.set(
        split.userId,
        (balances.get(split.userId) ?? 0) - parseFloat(split.shareAmount),
      );
    }
  }

  // Debt simplification: greedy debtor-creditor matching
  type BalanceEntry = { userId: number; userName: string; amount: number };
  const creditors: BalanceEntry[] = [];
  const debtors: BalanceEntry[] = [];

  for (const [userId, balance] of balances.entries()) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) {
      creditors.push({ userId, userName: memberMap.get(userId) ?? "Unknown", amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ userId, userName: memberMap.get(userId) ?? "Unknown", amount: -rounded });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0.01) {
      transactions.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.userName,
        toUserId: creditor.userId,
        toUserName: creditor.userName,
        amount: Math.round(amount * 100) / 100,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  res.json(transactions);
});

router.get("/expenses", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.json([]);
    return;
  }

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.householdId, householdId))
    .orderBy(desc(expensesTable.date), desc(expensesTable.createdAt));

  const enriched = await enrichExpenses(expenses);
  res.json(enriched);
});

router.post("/expenses", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, description, paidBy, date, splitAmong } = parsed.data;
  const expenseDate = date ?? new Date().toISOString().split("T")[0];

  const [expense] = await db
    .insert(expensesTable)
    .values({
      householdId,
      paidBy,
      amount: amount.toString(),
      description,
      date: expenseDate,
    })
    .returning();

  // Determine who to split among
  let splitUserIds = splitAmong;
  if (!splitUserIds || splitUserIds.length === 0) {
    const members = await getHouseholdMembers(householdId);
    splitUserIds = members.map((m) => m.id);
  }

  const shareAmount = amount / splitUserIds.length;
  const splits = splitUserIds.map((userId) => ({
    expenseId: expense.id,
    userId,
    shareAmount: shareAmount.toFixed(2),
  }));

  await db.insert(expenseSplitsTable).values(splits);

  const enriched = await enrichExpenses([expense]);
  res.status(201).json(enriched[0]);
});

router.delete("/expenses/:expenseId", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const householdId = await getUserHouseholdId(req.session.userId);
  if (!householdId) {
    res.status(404).json({ error: "You are not in a household" });
    return;
  }

  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(
      and(
        eq(expensesTable.id, params.data.expenseId),
        eq(expensesTable.householdId, householdId),
      ),
    );

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  if (expense.paidBy !== req.session.userId) {
    res.status(403).json({ error: "You can only delete your own expenses" });
    return;
  }

  await db
    .delete(expenseSplitsTable)
    .where(eq(expenseSplitsTable.expenseId, expense.id));

  await db.delete(expensesTable).where(eq(expensesTable.id, expense.id));

  res.sendStatus(204);
});

export default router;
