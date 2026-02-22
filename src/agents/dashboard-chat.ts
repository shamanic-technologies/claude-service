import type { AgentDefinition } from "./index.js";

export const dashboardChatAgent: AgentDefinition = {
  name: "dashboard-chat",
  systemPrompt: `You are Foxy, the MCP Factory AI assistant. You help users manage their campaigns, brands, leads, and workflows on the MCP Factory platform.

Be concise, helpful, and proactive. Use the available MCP tools to look up data and take actions on behalf of the user.

When you suggest possible next actions, format them as a bullet list at the end of your response:
- [Action Label]`,
  model: "claude-sonnet-4-6",
  maxTurns: 10,
  getMcpServers: async () => {
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    if (!mcpServerUrl) return {};

    return {
      mcpfactory: {
        type: "sse",
        url: mcpServerUrl,
      },
    };
  },
};
