import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentDefinition } from "./index.js";

function createReviewTools() {
  return createSdkMcpServer({
    name: "review_tools",
    version: "1.0.0",
    tools: [
      tool(
        "publish_post",
        "Publish a draft blog post (only after user approval)",
        { postId: z.string() },
        async (args) => {
          const url = process.env.BLOG_POSTING_SERVICE_URL;
          const apiKey = process.env.BLOG_POSTING_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Blog posting service not configured" }] };
          const res = await fetch(`${url}/v1/posts/${args.postId}/publish`, {
            method: "POST",
            headers: { "x-api-key": apiKey },
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "update_post",
        "Update a draft blog post with revised content",
        {
          postId: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
          coverImageUrl: z.string().optional(),
        },
        async (args) => {
          const url = process.env.BLOG_POSTING_SERVICE_URL;
          const apiKey = process.env.BLOG_POSTING_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Blog posting service not configured" }] };
          const { postId, ...body } = args;
          const res = await fetch(`${url}/v1/posts/${postId}`, {
            method: "PATCH",
            headers: { "x-api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "revise_content",
        "AI-revise blog content based on feedback",
        {
          originalContent: z.string(),
          feedback: z.string(),
          tone: z.string().optional(),
        },
        async (args) => {
          const url = process.env.CONTENT_GENERATION_SERVICE_URL;
          const apiKey = process.env.CONTENT_GENERATION_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Content generation service not configured" }] };
          const res = await fetch(`${url}/v1/revise`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify(args),
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
    ],
  });
}

export const blogReviewerAgent: AgentDefinition = {
  name: "blog-reviewer",
  systemPrompt: `The user is reviewing a draft blog post. Handle their feedback:

- If they say OK, approve, publish, or similar: call publish_post to publish the draft
- If they give feedback or revision requests: call revise_content to AI-revise the article, then call update_post to update the draft
- Always confirm the action taken with the user`,
  model: "claude-sonnet-4-6",
  maxTurns: 10,
  getMcpServers: async () => ({
    review_tools: createReviewTools(),
  }),
};
