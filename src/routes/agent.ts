import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, messages } from "../db/schema.js";
import { getAgent } from "../agents/index.js";
import { resolveAnthropicApiKey } from "../lib/keys.js";
import { createChildRun, addCosts, completeRun } from "../lib/runs.js";
import { runAgentWithStreaming } from "../lib/claude.js";
import { sendSSE, extractButtons } from "../lib/utils.js";
import { AgentRequestSchema } from "../schemas.js";

const router = Router();

router.post("/agents/:agentName", async (req, res) => {
  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { message, sessionId, appId, runId, keySource, orgId, userId, context } =
    parsed.data;
  const { agentName } = req.params;

  // Look up agent
  const agent = getAgent(agentName);
  if (!agent) {
    res.status(404).json({ error: `Unknown agent: ${agentName}` });
    return;
  }

  // Resolve API key BEFORE flushing SSE headers (so we can return proper HTTP errors)
  let anthropicKey: string;
  try {
    anthropicKey = await resolveAnthropicApiKey({ keySource, appId, orgId });
  } catch (err) {
    res.status(500).json({
      error: "Failed to resolve API key",
      details: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Start SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let childRunId: string | null = null;

  try {
    // Create or resume session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const [session] = await db
        .insert(sessions)
        .values({ appId, orgId: orgId ?? null, agentName })
        .returning();
      currentSessionId = session.id;
    }

    sendSSE(res, { sessionId: currentSessionId });

    // Load conversation history
    const history = await db.query.messages.findMany({
      where: eq(messages.sessionId, currentSessionId),
      orderBy: [asc(messages.createdAt)],
    });

    const sdkHistory = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Save new user message
    await db.insert(messages).values({
      sessionId: currentSessionId,
      role: "user",
      content: message.trim(),
    });

    // Create child run for cost tracking
    childRunId = await createChildRun({
      clerkOrgId: orgId,
      clerkUserId: userId,
      appId,
      serviceName: "claude-agent-service",
      taskName: agentName,
      parentRunId: runId,
    });

    // Get MCP servers for this agent
    const mcpServers = await agent.getMcpServers({
      appId,
      orgId,
      userId,
      context,
    });

    // Run the agent
    const result = await runAgentWithStreaming({
      res,
      anthropicApiKey: anthropicKey,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      history: sdkHistory,
      newMessage: message.trim(),
      mcpServers,
      maxTurns: agent.maxTurns,
    });

    // Extract and emit buttons
    const buttons = extractButtons(result.fullText);
    if (buttons.length > 0) {
      sendSSE(res, { type: "buttons", buttons });
    }

    // Save assistant response
    await db.insert(messages).values({
      sessionId: currentSessionId,
      role: "assistant",
      content: result.fullText,
      buttons: buttons.length > 0 ? buttons : null,
    });

    // Track costs
    if (childRunId) {
      await addCosts(childRunId, result.inputTokens, result.outputTokens);
      await completeRun(childRunId, "completed");
    }

    sendSSE(res, "[DONE]");
  } catch (err) {
    console.error(`[AGENT:${agentName}] Error:`, err);
    if (childRunId) {
      await completeRun(childRunId, "failed").catch(() => {});
    }
    sendSSE(res, {
      type: "error",
      message: "An error occurred. Please try again.",
    });
    sendSSE(res, "[DONE]");
  } finally {
    res.end();
  }
});

export default router;
