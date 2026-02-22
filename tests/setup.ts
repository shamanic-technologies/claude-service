import { beforeAll, afterAll, vi } from "vitest";

process.env.CLAUDE_AGENT_SERVICE_DATABASE_URL =
  process.env.CLAUDE_AGENT_SERVICE_DATABASE_URL ||
  "postgresql://test:test@localhost/claude_agent_test";
process.env.SERVICE_API_KEY = "test-service-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.NODE_ENV = "test";

// Mock the Claude Agent SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
  tool: vi.fn(
    (
      name: string,
      _desc: string,
      _schema: unknown,
      handler: (...args: unknown[]) => unknown
    ) => ({
      name,
      handler,
    })
  ),
  createSdkMcpServer: vi.fn(() => ({ type: "sdk", name: "mock" })),
}));

// Mock external service clients
vi.mock("../src/lib/runs.js", () => ({
  createChildRun: vi.fn().mockResolvedValue("test-run-id"),
  addCosts: vi.fn().mockResolvedValue(undefined),
  completeRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/keys.js", () => ({
  resolveAnthropicApiKey: vi.fn().mockResolvedValue("test-anthropic-key"),
  registerAppKey: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => console.log("[Test] Suite starting..."));
afterAll(() => console.log("[Test] Suite complete."));
