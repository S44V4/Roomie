import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const choreAssignmentsTable = pgTable("chore_assignments", {
  id: serial("id").primaryKey(),
  choreId: integer("chore_id").notNull(),
  userId: integer("user_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("pending"), // pending | done
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const insertChoreAssignmentSchema = createInsertSchema(choreAssignmentsTable).omit({ id: true });
export type InsertChoreAssignment = z.infer<typeof insertChoreAssignmentSchema>;
export type ChoreAssignment = typeof choreAssignmentsTable.$inferSelect;
