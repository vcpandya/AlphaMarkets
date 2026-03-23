import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as db from "../services/pgStorage.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
}

// POST /api/share  (protected — creates a share link for a run)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { runId, runData, password, expiresAt } = req.body as {
    runId?: string;
    runData?: unknown;
    password?: string;
    expiresAt?: string;
  };

  if (!runId || !runData) {
    res.status(400).json({ error: "runId and runData are required" });
    return;
  }

  const token = crypto.randomBytes(20).toString("hex");
  const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined;

  await db.createSharedRun({
    token,
    runId,
    runData,
    passwordHash,
    expiresAt: expiresAt || undefined,
  });

  res.json({ ok: true, token });
});

// GET /api/share/:token  (public — fetch share metadata + run data if no password)
router.get("/:token", async (req: Request, res: Response) => {
  const token = paramStr(req.params.token);
  const row = await db.getSharedRun(token);

  if (!row) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await db.deleteSharedRun(token);
    res.status(410).json({ error: "Share link has expired" });
    return;
  }

  if (row.password_hash) {
    res.json({ passwordRequired: true, expiresAt: row.expires_at });
    return;
  }

  res.json({
    passwordRequired: false,
    expiresAt: row.expires_at,
    run: row.run_data,
  });
});

// POST /api/share/:token/verify  (public — verify password and return run data)
router.post("/:token/verify", async (req: Request, res: Response) => {
  const token = paramStr(req.params.token);
  const { password } = req.body as { password?: string };

  const row = await db.getSharedRun(token);

  if (!row) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await db.deleteSharedRun(token);
    res.status(410).json({ error: "Share link has expired" });
    return;
  }

  if (!row.password_hash) {
    res.json({ run: row.run_data });
    return;
  }

  if (!password || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.json({ run: row.run_data });
});

// DELETE /api/share/:token  (protected — revoke a share link)
router.delete("/:token", requireAuth, async (req: Request, res: Response) => {
  const token = paramStr(req.params.token);
  await db.deleteSharedRun(token);
  res.json({ ok: true });
});

export default router;
