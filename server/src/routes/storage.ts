import { Router } from "express";
import type { Request, Response } from "express";
import * as db from "../services/pgStorage.js";
import { computeNextRun } from "../services/scheduler.js";
import type { ScheduleConfig } from "../types/index.js";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
}

// Check if PostgreSQL backend is available
router.get("/status", (_req: Request, res: Response) => {
  res.json({ available: db.isAvailable(), backend: "postgres" });
});

// ─── Saved Runs ─────────────────────────────────────────

router.get("/runs", async (_req: Request, res: Response) => {
  const runs = await db.getAllRuns();
  res.json({ runs });
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  const run = await db.getRun(paramStr(req.params.id));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ run });
});

router.post("/runs", async (req: Request, res: Response) => {
  const run = req.body;
  if (!run?.id || !run?.timestamp) {
    res.status(400).json({ error: "Run must have id and timestamp" });
    return;
  }
  await db.putRun(run);
  res.json({ ok: true });
});

router.delete("/runs/:id", async (req: Request, res: Response) => {
  await db.deleteRun(paramStr(req.params.id));
  res.json({ ok: true });
});

// ─── News History ───────────────────────────────────────

router.get("/news-history/:topicHash", async (req: Request, res: Response) => {
  const urls = await db.getNewsHistory(paramStr(req.params.topicHash));
  res.json({ urls });
});

router.post("/news-history", async (req: Request, res: Response) => {
  const { topicHash, urls } = req.body;
  if (!topicHash || !Array.isArray(urls)) {
    res.status(400).json({ error: "topicHash and urls[] required" });
    return;
  }
  await db.addNewsHistory(topicHash, urls);
  res.json({ ok: true });
});

// ─── Stock Analyses ─────────────────────────────────────

router.get("/stock-analyses/:key", async (req: Request, res: Response) => {
  const result = await db.getStockAnalysis(paramStr(req.params.key));
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.post("/stock-analyses", async (req: Request, res: Response) => {
  const { key, data } = req.body;
  if (!key) {
    res.status(400).json({ error: "key required" });
    return;
  }
  await db.putStockAnalysis(key, data);
  res.json({ ok: true });
});

// ─── Schedules ──────────────────────────────────────────

router.get("/schedules", async (_req: Request, res: Response) => {
  const schedules = await db.getAllSchedules();
  res.json({ schedules });
});

router.get("/schedules/:id", async (req: Request, res: Response) => {
  const schedule = await db.getSchedule(paramStr(req.params.id));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json({ schedule });
});

router.post("/schedules", async (req: Request, res: Response) => {
  const schedule = req.body as ScheduleConfig;
  if (!schedule?.id || !schedule?.name || !schedule?.emailTo) {
    res.status(400).json({ error: "Schedule must have id, name, and emailTo" });
    return;
  }
  schedule.nextRun = computeNextRun(schedule);
  await db.putSchedule(schedule);
  res.json({ ok: true, schedule });
});

router.delete("/schedules/:id", async (req: Request, res: Response) => {
  await db.deleteSchedule(paramStr(req.params.id));
  res.json({ ok: true });
});

router.post("/schedules/:id/toggle", async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const existing = await db.getSchedule(id) as ScheduleConfig | undefined;
  if (!existing) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  existing.enabled = !existing.enabled;
  if (existing.enabled) {
    existing.nextRun = computeNextRun(existing);
  }
  await db.putSchedule(existing);
  res.json({ ok: true, schedule: existing });
});

export default router;
