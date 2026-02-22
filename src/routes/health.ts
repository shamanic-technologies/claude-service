import { Router } from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: "ok",
      service: "claude-agent-service",
      database: "ok",
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      service: "claude-agent-service",
      database: "unreachable",
    });
  }
});

export default router;
