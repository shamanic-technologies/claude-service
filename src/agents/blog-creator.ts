import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentDefinition } from "./index.js";

function createBlogTools() {
  return createSdkMcpServer({
    name: "blog_tools",
    version: "1.0.0",
    tools: [
      tool(
        "get_author_profile",
        "Get the author's online presence, writing style, and profile context",
        { appId: z.string(), authorId: z.string().optional() },
        async (args) => {
          const url = process.env.HUMAN_SERVICE_URL;
          const apiKey = process.env.HUMAN_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Human service not configured" }] };
          const res = await fetch(`${url}/v1/profiles/${args.authorId ?? "default"}`, {
            headers: { "x-api-key": apiKey },
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "generate_blog_content",
        "AI-generate a blog article based on topic, style, and context",
        {
          topic: z.string(),
          tone: z.string().optional(),
          outline: z.string().optional(),
          authorContext: z.string().optional(),
        },
        async (args) => {
          const url = process.env.CONTENT_GENERATION_SERVICE_URL;
          const apiKey = process.env.CONTENT_GENERATION_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Content generation service not configured" }] };
          const res = await fetch(`${url}/v1/generate`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify(args),
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "generate_cover_visual",
        "Create a cover image or diagram for the blog post",
        {
          description: z.string(),
          style: z.string().optional(),
        },
        async (args) => {
          const url = process.env.CREATIVE_SERVICE_URL;
          const apiKey = process.env.CREATIVE_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Creative service not configured" }] };
          const res = await fetch(`${url}/v1/diagrams`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify(args),
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "create_blog_draft",
        "Store the blog post as a draft. Always create as DRAFT first.",
        {
          title: z.string(),
          content: z.string(),
          coverImageUrl: z.string().optional(),
          tags: z.array(z.string()).optional(),
          authorName: z.string().optional(),
        },
        async (args) => {
          const url = process.env.BLOG_POSTING_SERVICE_URL;
          const apiKey = process.env.BLOG_POSTING_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Blog posting service not configured" }] };
          const res = await fetch(`${url}/v1/posts`, {
            method: "POST",
            headers: { "x-api-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify({ ...args, status: "draft" }),
          });
          const data = await res.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        }
      ),
      tool(
        "send_notification",
        "Send a notification message to the user via Telegram",
        {
          chatId: z.string(),
          message: z.string(),
        },
        async (args) => {
          const url = process.env.TELEGRAM_BOT_SERVICE_URL;
          const apiKey = process.env.TELEGRAM_BOT_SERVICE_API_KEY;
          if (!url || !apiKey)
            return { content: [{ type: "text" as const, text: "Telegram service not configured" }] };
          const res = await fetch(`${url}/v1/messages`, {
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

export const blogCreatorAgent: AgentDefinition = {
  name: "blog-creator",
  systemPrompt: `You help the user write blog posts. Follow this flow:
1) Call get_author_profile to get author context and writing style
2) Call generate_blog_content to write the article
3) Call generate_cover_visual for a cover visual
4) Call create_blog_draft to store as draft
5) Send the preview link back to the user

Always create as DRAFT first. Never publish directly without user approval.`,
  model: "claude-sonnet-4-6",
  maxTurns: 20,
  getMcpServers: async () => ({
    blog_tools: createBlogTools(),
  }),
};
