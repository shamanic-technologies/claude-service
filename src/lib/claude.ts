import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Response } from "express";
import { sendSSE } from "./utils.js";

export interface RunAgentParams {
  res: Response;
  anthropicApiKey: string;
  systemPrompt: string;
  model: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  newMessage: string;
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
}

export interface AgentResult {
  fullText: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

/**
 * Build system prompt with conversation history appended as context.
 * The SDK receives the base agent prompt + prior conversation so it has
 * full context, and only the new user message as the actual prompt.
 */
function buildSystemPromptWithHistory(
  basePrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): string {
  if (history.length === 0) return basePrompt;

  const historyText = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return `${basePrompt}\n\n<conversation_history>\n${historyText}\n</conversation_history>\n\nContinue the conversation based on the history above. Respond to the user's new message.`;
}

export async function runAgentWithStreaming(
  params: RunAgentParams
): Promise<AgentResult> {
  const {
    res,
    anthropicApiKey,
    systemPrompt,
    model,
    history,
    newMessage,
    mcpServers,
    maxTurns,
  } = params;

  const fullSystemPrompt = buildSystemPromptWithHistory(systemPrompt, history);

  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCostUsd = 0;

  const stream = query({
    prompt: newMessage,
    options: {
      systemPrompt: fullSystemPrompt,
      model,
      maxTurns: maxTurns ?? 10,
      mcpServers: mcpServers as Record<string, never> | undefined,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
      env: { ...process.env, ANTHROPIC_API_KEY: anthropicApiKey },
    },
  });

  for await (const msg of stream) {
    // Token-level streaming
    if (msg.type === "stream_event") {
      const event = msg.event as Record<string, unknown>;
      if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown>;
        if (delta.type === "text_delta" && typeof delta.text === "string") {
          fullText += delta.text;
          sendSSE(res, { type: "token", content: delta.text });
        }
      }
      continue;
    }

    // Tool use blocks from complete assistant messages
    if (msg.type === "assistant") {
      const assistantMsg = msg as Record<string, unknown>;
      const message = assistantMsg.message as Record<string, unknown>;
      const content = message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use") {
            sendSSE(res, {
              type: "tool_call",
              name: b.name,
              args: b.input,
            });
          }
        }
      }
      continue;
    }

    // Final result with usage stats
    if (msg.type === "result") {
      const result = msg as Record<string, unknown>;
      if (result.subtype === "success") {
        if (typeof result.result === "string") {
          // If we didn't get streaming tokens, use the final result text
          if (!fullText) fullText = result.result;
        }
        totalCostUsd = (result.total_cost_usd as number) ?? 0;
        const usage = result.usage as Record<string, number> | undefined;
        if (usage) {
          inputTokens = usage.input_tokens ?? 0;
          outputTokens = usage.output_tokens ?? 0;
        }
      }
      continue;
    }
  }

  return { fullText, inputTokens, outputTokens, totalCostUsd };
}
