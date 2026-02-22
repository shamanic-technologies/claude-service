import { describe, it, expect } from "vitest";
import { getAgent, listAgents } from "../../src/agents/index.js";

describe("Agent registry", () => {
  it("lists all expected agents", () => {
    const agents = listAgents();
    expect(agents).toContain("dashboard-chat");
    expect(agents).toContain("blog-creator");
    expect(agents).toContain("blog-reviewer");
    expect(agents).toHaveLength(3);
  });

  it("returns agent definition by name", () => {
    const agent = getAgent("dashboard-chat");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("dashboard-chat");
    expect(agent!.model).toBe("claude-sonnet-4-6");
    expect(agent!.systemPrompt).toBeTruthy();
    expect(agent!.maxTurns).toBeGreaterThan(0);
  });

  it("returns undefined for unknown agent", () => {
    expect(getAgent("nonexistent")).toBeUndefined();
  });

  it("blog-creator has tools configured", async () => {
    const agent = getAgent("blog-creator");
    expect(agent).toBeDefined();
    const servers = await agent!.getMcpServers({ appId: "test" });
    expect(servers).toBeDefined();
    expect(Object.keys(servers).length).toBeGreaterThan(0);
  });

  it("blog-reviewer has tools configured", async () => {
    const agent = getAgent("blog-reviewer");
    expect(agent).toBeDefined();
    const servers = await agent!.getMcpServers({ appId: "test" });
    expect(servers).toBeDefined();
    expect(Object.keys(servers).length).toBeGreaterThan(0);
  });
});
