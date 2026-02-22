import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db/index.js";
import healthRoutes from "./routes/health.js";
import agentRoutes from "./routes/agent.js";
import { serviceKeyAuth } from "./middleware/auth.js";
import { registerAppKey } from "./lib/keys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const APP_ID = "claude-agent-service";

app.use(cors());
app.use(express.json());

// Serve OpenAPI spec (public)
const openapiPath = join(__dirname, "..", "openapi.json");
app.get("/openapi.json", (_req, res) => {
  if (existsSync(openapiPath)) {
    res.json(JSON.parse(readFileSync(openapiPath, "utf-8")));
  } else {
    res.status(404).json({ error: "Run: pnpm generate:openapi" });
  }
});

// Health (public)
app.use(healthRoutes);

// Agent routes (protected)
app.use(serviceKeyAuth, agentRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

Sentry.setupExpressErrorHandler(app);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

async function startup() {
  // 1. Run DB migrations
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[Claude Agent Service] Migrations complete");

  // 2. Register Anthropic key with key-service
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    await registerAppKey(APP_ID, anthropicKey).catch((err) =>
      console.warn("[Claude Agent Service] Key registration failed:", err)
    );
  }

  // 3. Register OpenAPI spec with API registry
  const apiRegistryUrl = process.env.API_REGISTRY_URL;
  const apiRegistryKey = process.env.API_REGISTRY_API_KEY;
  const serviceUrl =
    process.env.SERVICE_URL ?? `http://localhost:${PORT}`;
  if (apiRegistryUrl && apiRegistryKey) {
    await fetch(`${apiRegistryUrl}/services`, {
      method: "POST",
      headers: {
        "x-api-key": apiRegistryKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "claude-agent",
        baseUrl: serviceUrl,
        openapiUrl: `${serviceUrl}/openapi.json`,
      }),
    }).catch((err) =>
      console.warn(
        "[Claude Agent Service] API registry registration failed:",
        err
      )
    );
  }

  // 4. Start server
  app.listen(Number(PORT), "::", () => {
    console.log(`[Claude Agent Service] Running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startup().catch((err) => {
    console.error("[Claude Agent Service] Startup failed:", err);
    process.exit(1);
  });
}

export default app;
