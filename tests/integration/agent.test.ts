import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders } from "../helpers/test-app.js";
import {
  cleanTestData,
  closeDb,
  insertTestSession,
  insertTestMessage,
} from "../helpers/test-db.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createChildRun, addCosts, completeRun } from "../../src/lib/runs.js";

const app = createTestApp();
const authHeaders = getAuthHeaders();

/** Create a mock SDK generator that yields tokens then a result */
function mockSdkStream(tokens: string[]) {
  return async function* () {
    yield {
      type: "system" as const,
      subtype: "init" as const,
      session_id: "sdk-session",
      model: "claude-sonnet-4-6",
      tools: [],
    };
    for (const token of tokens) {
      yield {
        type: "stream_event" as const,
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: token },
        },
      };
    }
    yield {
      type: "result" as const,
      subtype: "success" as const,
      result: tokens.join(""),
      total_cost_usd: 0.001,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };
  };
}

/** Parse SSE text into array of events */
function parseSSE(text: string): unknown[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => chunk.replace(/^data: /, "").trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
}

// File-level cleanup — runs after ALL describes in this file
afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("GET /health", () => {
  it("returns health status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      service: "claude-agent-service",
    });
  });
});

describe("POST /agents/:agentName", () => {
  beforeEach(async () => {
    await cleanTestData();
    vi.clearAllMocks();
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/agents/dashboard-chat")
      .send({
        message: "hello",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown agent", async () => {
    const res = await request(app)
      .post("/agents/nonexistent")
      .set(authHeaders)
      .send({
        message: "hello",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("nonexistent");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({ message: "hello" }); // missing appId, runId, keySource
    expect(res.status).toBe(400);
  });

  it("streams token events for valid request", async () => {
    vi.mocked(query).mockReturnValue(
      mockSdkStream(["Hello", " world", "!"])() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "hello",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const events = parseSSE(res.text);

    // First event should be sessionId
    expect(events[0]).toMatchObject({ sessionId: expect.any(String) });

    // Should have token events
    const tokenEvents = events.filter(
      (e): e is { type: string; content: string } =>
        typeof e === "object" && e !== null && (e as Record<string, unknown>).type === "token"
    );
    expect(tokenEvents.length).toBe(3);
    expect(tokenEvents[0].content).toBe("Hello");

    // Last event should be [DONE]
    expect(events[events.length - 1]).toBe("[DONE]");
  });

  it("creates a new session when no sessionId provided", async () => {
    vi.mocked(query).mockReturnValue(
      mockSdkStream(["Hi!"])() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "hello",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    const events = parseSSE(res.text);
    const sessionEvent = events[0] as { sessionId: string };
    expect(sessionEvent.sessionId).toBeDefined();
    expect(typeof sessionEvent.sessionId).toBe("string");
  });

  it("resumes existing session", async () => {
    const session = await insertTestSession({ agentName: "dashboard-chat" });
    await insertTestMessage(session.id, {
      role: "user",
      content: "Previous question",
    });
    await insertTestMessage(session.id, {
      role: "assistant",
      content: "Previous answer",
    });

    vi.mocked(query).mockReturnValue(
      mockSdkStream(["Follow-up"])() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "follow-up question",
        sessionId: session.id,
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    const events = parseSSE(res.text);
    const sessionEvent = events[0] as { sessionId: string };
    expect(sessionEvent.sessionId).toBe(session.id);
  });

  it("tracks costs via runs-service", async () => {
    vi.mocked(query).mockReturnValue(
      mockSdkStream(["Response"])() as ReturnType<typeof query>
    );

    await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "hello",
        appId: "test-app",
        runId: "parent-run-1",
        keySource: "app",
      });

    expect(createChildRun).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "test-app",
        serviceName: "claude-agent-service",
        taskName: "dashboard-chat",
        parentRunId: "parent-run-1",
      })
    );
    expect(addCosts).toHaveBeenCalledWith("test-run-id", 100, 50);
    expect(completeRun).toHaveBeenCalledWith("test-run-id", "completed");
  });

  it("emits tool_call events when SDK returns tool_use blocks", async () => {
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield {
          type: "system" as const,
          subtype: "init" as const,
          session_id: "s",
          model: "m",
          tools: [],
        };
        yield {
          type: "assistant" as const,
          message: {
            content: [
              {
                type: "tool_use",
                name: "mcp__mcpfactory__list_campaigns",
                input: { status: "active" },
              },
            ],
          },
        };
        yield {
          type: "stream_event" as const,
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Here are your campaigns." },
          },
        };
        yield {
          type: "result" as const,
          subtype: "success" as const,
          result: "Here are your campaigns.",
          total_cost_usd: 0.002,
          usage: { input_tokens: 200, output_tokens: 100 },
        };
      })() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "list my campaigns",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    const events = parseSSE(res.text);
    const toolCallEvent = events.find(
      (e): e is { type: string; name: string; args: unknown } =>
        typeof e === "object" && e !== null && (e as Record<string, unknown>).type === "tool_call"
    );
    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent!.name).toBe("mcp__mcpfactory__list_campaigns");
    expect(toolCallEvent!.args).toEqual({ status: "active" });
  });

  it("emits error event and [DONE] when SDK throws", async () => {
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield {
          type: "system" as const,
          subtype: "init" as const,
          session_id: "s",
          model: "m",
          tools: [],
        };
        throw new Error("API rate limit exceeded");
      })() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "hello",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    const events = parseSSE(res.text);
    const errorEvent = events.find(
      (e): e is { type: string; message: string } =>
        typeof e === "object" && e !== null && (e as Record<string, unknown>).type === "error"
    );
    expect(errorEvent).toBeDefined();
    expect(events[events.length - 1]).toBe("[DONE]");

    // Should mark run as failed
    expect(completeRun).toHaveBeenCalledWith("test-run-id", "failed");
  });

  it("extracts and emits buttons from response", async () => {
    const responseText = `Here's what I found!\n- [View Details]\n- [Create New]`;
    vi.mocked(query).mockReturnValue(
      mockSdkStream([responseText])() as ReturnType<typeof query>
    );

    const res = await request(app)
      .post("/agents/dashboard-chat")
      .set(authHeaders)
      .send({
        message: "what can I do?",
        appId: "test-app",
        runId: "run-1",
        keySource: "app",
      });

    const events = parseSSE(res.text);
    const buttonsEvent = events.find(
      (e): e is { type: string; buttons: unknown[] } =>
        typeof e === "object" && e !== null && (e as Record<string, unknown>).type === "buttons"
    );
    expect(buttonsEvent).toBeDefined();
    expect(buttonsEvent!.buttons).toEqual([
      { label: "View Details", value: "View Details" },
      { label: "Create New", value: "Create New" },
    ]);
  });
});
