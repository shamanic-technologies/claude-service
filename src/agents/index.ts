export interface AgentContext {
  appId: string;
  orgId?: string;
  userId?: string;
  context?: Record<string, unknown>;
}

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  model: string;
  maxTurns: number;
  getMcpServers: (
    context: AgentContext
  ) => Promise<Record<string, unknown>>;
}

import { dashboardChatAgent } from "./dashboard-chat.js";
import { blogCreatorAgent } from "./blog-creator.js";
import { blogReviewerAgent } from "./blog-reviewer.js";

const AGENTS: Record<string, AgentDefinition> = {
  "dashboard-chat": dashboardChatAgent,
  "blog-creator": blogCreatorAgent,
  "blog-reviewer": blogReviewerAgent,
};

export function getAgent(name: string): AgentDefinition | undefined {
  return AGENTS[name];
}

export function listAgents(): string[] {
  return Object.keys(AGENTS);
}
