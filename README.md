# claude-agent-service

Centralized AI agent service using Anthropic's Claude Agent SDK. Replaces the Gemini-based chat-service with support for multiple named agents.

## Agents

- **dashboard-chat** — General MCP Factory assistant (Foxy)
- **blog-creator** — Writes and publishes blog posts
- **blog-reviewer** — Handles draft review and feedback

## API

```
POST /agents/:agentName
Headers: x-api-key
Body: { message, sessionId?, appId, runId, keySource, orgId?, userId?, context? }
Response: SSE stream
```

## Development

```bash
pnpm install
pnpm dev          # start with hot reload
pnpm test         # run tests
pnpm build        # compile + generate openapi
pnpm db:generate  # generate migration SQL
pnpm db:push      # push schema to DB
```

## Environment

Copy `.env.example` to `.env` and fill in values. Key vars: `CLAUDE_AGENT_SERVICE_DATABASE_URL`, `ANTHROPIC_API_KEY`, `SERVICE_API_KEY`.
