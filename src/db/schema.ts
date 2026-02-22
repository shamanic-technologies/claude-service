import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ButtonRecord {
  label: string;
  value: string;
}

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id"),
    appId: text("app_id").notNull(),
    agentName: text("agent_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_sessions_app_id").on(t.appId),
    index("idx_sessions_agent_name").on(t.agentName),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant" | "tool">(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<ToolCallRecord[]>(),
    buttons: jsonb("buttons").$type<ButtonRecord[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_messages_session_id").on(t.sessionId)]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
