import { Router } from "express";
import type { Request, Response } from "express";
import * as sqlite from "../services/sqliteStorage.js";
import { computeNextRun } from "../services/scheduler.js";
import type { ScheduleConfig } from "../types/index.js";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
}

// Check if SQLite backend is available
router.get("/status", (_req: Request, res: Response) => {
  res.json({ available: sqlite.isAvailable(), backend: "sqlite" });
});

// ─── Saved Runs ─────────────────────────────────────────

router.get("/runs", (_req: Request, res: Response) => {
  const runs = sqlite.getAllRuns();
  res.json({ runs });
});

router.get("/runs/:id", (req: Request, res: Response) => {
  const run = sqlite.getRun(paramStr(req.params.id));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ run });
});

router.post("/runs", (req: Request, res: Response) => {
  const run = req.body;
  if (!run?.id || !run?.timestamp) {
    res.status(400).json({ error: "Run must have id and timestamp" });
    return;
  }
  sqlite.putRun(run);
  res.json({ ok: true });
});

router.delete("/runs/:id", (req: Request, res: Response) => {
  sqlite.deleteRun(paramStr(req.params.id));
  res.json({ ok: true });
});

// ─── News History ───────────────────────────────────────

router.get("/news-history/:topicHash", (req: Request, res: Response) => {
  const urls = sqlite.getNewsHistory(paramStr(req.params.topicHash));
  res.json({ urls });
});

router.post("/news-history", (req: Request, res: Response) => {
  const { topicHash, urls } = req.body;
  if (!topicHash || !Array.isArray(urls)) {
    res.status(400).json({ error: "topicHash and urls[] required" });
    return;
  }
  sqlite.addNewsHistory(topicHash, urls);
  res.json({ ok: true });
});

// ─── Stock Analyses ─────────────────────────────────────

router.get("/stock-analyses/:key", (req: Request, res: Response) => {
  const result = sqlite.getStockAnalysis(paramStr(req.params.key));
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.post("/stock-analyses", (req: Request, res: Response) => {
  const { key, data } = req.body;
  if (!key) {
    res.status(400).json({ error: "key required" });
    return;
  }
  sqlite.putStockAnalysis(key, data);
  res.json({ ok: true });
});

// ─── Schedules ──────────────────────────────────────────

router.get("/schedules", (_req: Request, res: Response) => {
  const schedules = sqlite.getAllSchedules();
  res.json({ schedules });
});

router.get("/schedules/:id", (req: Request, res: Response) => {
  const schedule = sqlite.getSchedule(paramStr(req.params.id));
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json({ schedule });
});

router.post("/schedules", (req: Request, res: Response) => {
  const schedule = req.body as ScheduleConfig;
  if (!schedule?.id || !schedule?.name || !schedule?.emailTo) {
    res.status(400).json({ error: "Schedule must have id, name, and emailTo" });
    return;
  }
  // Compute next run time
  schedule.nextRun = computeNextRun(schedule);
  sqlite.putSchedule(schedule);
  res.json({ ok: true, schedule });
});

router.delete("/schedules/:id", (req: Request, res: Response) => {
  sqlite.deleteSchedule(paramStr(req.params.id));
  res.json({ ok: true });
});

router.post("/schedules/:id/toggle", (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const existing = sqlite.getSchedule(id) as ScheduleConfig | undefined;
  if (!existing) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  existing.enabled = !existing.enabled;
  if (existing.enabled) {
    existing.nextRun = computeNextRun(existing);
  }
  sqlite.putSchedule(existing);
  res.json({ ok: true, schedule: existing });
});

export default router;
