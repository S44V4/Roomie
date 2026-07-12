import { and, eq, lt, gte } from "drizzle-orm";
import { db, choresTable, choreAssignmentsTable } from "@workspace/db";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getChoreOccurrenceDates(
  frequency: string,
  customDays: string | null | undefined,
  createdAt: Date,
  fromDate: Date,
  numDays: number,
): string[] {
  const dates: string[] = [];
  const cursor = new Date(fromDate);
  const end = new Date(fromDate);
  end.setDate(end.getDate() + numDays);

  if (frequency === "daily") {
    while (cursor < end) {
      dates.push(toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (frequency === "weekly") {
    const targetDay = createdAt.getDay();
    while (cursor < end) {
      if (cursor.getDay() === targetDay) {
        dates.push(toDateStr(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (frequency === "custom" && customDays) {
    const dayNums = customDays.split(",").map(Number).filter((n) => !isNaN(n));
    while (cursor < end) {
      if (dayNums.includes(cursor.getDay())) {
        dates.push(toDateStr(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return dates;
}

export async function generateAssignmentsForChore(choreId: number): Promise<void> {
  const [chore] = await db
    .select()
    .from(choresTable)
    .where(eq(choresTable.id, choreId));

  if (!chore || !chore.rotationOrder.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Delete all future pending assignments for this chore
  await db.delete(choreAssignmentsTable).where(
    and(
      eq(choreAssignmentsTable.choreId, choreId),
      eq(choreAssignmentsTable.status, "pending"),
      gte(choreAssignmentsTable.date, todayStr),
    ),
  );

  // Count past assignments to maintain rotation continuity
  const pastAssignments = await db
    .select()
    .from(choreAssignmentsTable)
    .where(
      and(
        eq(choreAssignmentsTable.choreId, choreId),
        lt(choreAssignmentsTable.date, todayStr),
      ),
    );
  const offset = pastAssignments.length;

  // Generate occurrence dates for the next 30 days
  const dates = getChoreOccurrenceDates(
    chore.frequency,
    chore.customDays,
    new Date(chore.createdAt),
    today,
    30,
  );

  if (!dates.length) return;

  const rotationOrder = chore.rotationOrder;
  const toInsert = dates.map((date, i) => ({
    choreId,
    userId: rotationOrder[(offset + i) % rotationOrder.length],
    date,
    status: "pending" as const,
    confirmedAt: null,
  }));

  await db.insert(choreAssignmentsTable).values(toInsert);
}
