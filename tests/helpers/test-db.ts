import { db, sql } from "../../src/db/index.js";
import { sessions, messages } from "../../src/db/schema.js";

export async function cleanTestData() {
  await db.delete(messages);
  await db.delete(sessions);
}

export async function closeDb() {
  await sql.end();
}

export async function insertTestSession(
  data: {
    appId?: string;
    orgId?: string | null;
    agentName?: string;
  } = {}
) {
  const [session] = await db
    .insert(sessions)
    .values({
      appId: data.appId ?? "test-app",
      orgId: data.orgId ?? null,
      agentName: data.agentName ?? "dashboard-chat",
    })
    .returning();
  return session;
}

export async function insertTestMessage(
  sessionId: string,
  data: {
    role?: "user" | "assistant";
    content?: string;
  } = {}
) {
  const [msg] = await db
    .insert(messages)
    .values({
      sessionId,
      role: data.role ?? "user",
      content: data.content ?? "test message",
    })
    .returning();
  return msg;
}
