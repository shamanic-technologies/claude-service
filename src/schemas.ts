import { z } from "zod";
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "serviceKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
  description: "Service-to-service API key",
});

export const AgentRequestSchema = z
  .object({
    message: z.string().min(1),
    sessionId: z.string().uuid().optional(),
    appId: z.string().min(1),
    runId: z.string(),
    keySource: z.enum(["app", "byok"]),
    orgId: z.string().optional(),
    userId: z.string().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi("AgentRequest", {});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

registry.registerPath({
  method: "post",
  path: "/agents/{agentName}",
  summary: "Run an agent with SSE streaming",
  description:
    "Sends a message to a named agent and streams the response as Server-Sent Events. Supports session resumption via sessionId.",
  security: [{ serviceKeyAuth: [] }],
  request: {
    params: z.object({
      agentName: z
        .string()
        .openapi("AgentName", { description: "Agent name (dashboard-chat, blog-creator, blog-reviewer)" }),
    }),
    body: {
      content: {
        "application/json": { schema: AgentRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description:
        "SSE stream: {sessionId}, {type:token,content}, {type:tool_call,name,args}, {type:tool_result,name,result}, {type:buttons,buttons}, [DONE]",
      content: {
        "text/event-stream": {
          schema: z.string(),
        },
      },
    },
    400: { description: "Invalid request body" },
    401: { description: "Missing or invalid x-api-key" },
    404: { description: "Unknown agent name" },
  },
});

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Health check",
  responses: {
    200: {
      description: "Service health status",
      content: {
        "application/json": {
          schema: z
            .object({
              status: z.string(),
              service: z.string(),
              database: z.string(),
            })
            .openapi("HealthResponse", {}),
        },
      },
    },
  },
});
