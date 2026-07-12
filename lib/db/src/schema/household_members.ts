import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const householdMembersTable = pgTable(
  "household_members",
  {
    householdId: integer("household_id").notNull(),
    userId: integer("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] })],
);

export type HouseholdMember = typeof householdMembersTable.$inferSelect;
