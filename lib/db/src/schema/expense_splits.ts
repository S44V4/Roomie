import { pgTable, serial, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expenseSplitsTable = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull(),
  userId: integer("user_id").notNull(),
  shareAmount: numeric("share_amount", { precision: 10, scale: 2 }).notNull(),
});

export const insertExpenseSplitSchema = createInsertSchema(expenseSplitsTable).omit({ id: true });
export type InsertExpenseSplit = z.infer<typeof insertExpenseSplitSchema>;
export type ExpenseSplit = typeof expenseSplitsTable.$inferSelect;
