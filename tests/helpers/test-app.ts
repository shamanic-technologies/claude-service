import express from "express";
import cors from "cors";
import healthRoutes from "../../src/routes/health.js";
import agentRoutes from "../../src/routes/agent.js";
import { serviceKeyAuth } from "../../src/middleware/auth.js";

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(healthRoutes);
  app.use(serviceKeyAuth, agentRoutes);
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  return app;
}

export function getAuthHeaders(): Record<string, string> {
  return {
    "x-api-key": "test-service-key",
    "Content-Type": "application/json",
  };
}
