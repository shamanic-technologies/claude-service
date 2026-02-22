import { Request, Response, NextFunction } from "express";

export function serviceKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    res.status(500).json({ error: "Service not configured" });
    return;
  }

  const provided = req.headers["x-api-key"];
  const providedKey = typeof provided === "string" ? provided : null;

  if (!providedKey || providedKey !== serviceKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
