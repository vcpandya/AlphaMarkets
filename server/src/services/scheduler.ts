/**
 * Scheduler service - runs scheduled analyses and sends email reports.
 *
 * Polls PostgreSQL every 60s for due schedules, executes them server-side,
 * and emails the results via AgentMail.
 */

import type { ScheduleConfig } from "../types/index.js";
import * as db from "./pgStorage.js";
import { chatCompletion } from "./openRouterService.js";
import { buildPrompt, JSON_SCHEMAS } from "./promptBuilder.js";
import { sendEmail, formatAnalysisEmail } from "./agentMailService.js";

let intervalId: ReturnType<typeof setInterval> | null = null;

function getServerKeys() {
  return {
    openRouter: process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || "",
    jina: process.env.JINA_API_KEY || process.env.JINA_KEY || "",
    alphaVantage: process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHAVANTAGE_API_KEY || "",
    agentMail: process.env.AGENTMAIL_API_KEY || process.env.AGENTMAIL_KEY || "",
    model: process.env.DEFAULT_MODEL || "anthropic/claude-sonnet-4",
  };
}

export function computeNextRun(schedule: ScheduleConfig): string {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(":").map(Number);

  let next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case "daily":
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    case "weekly": {
      const targetDay = schedule.dayOfWeek ?? 1;
      const currentDay = next.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
      break;
    }
    case "monthly": {
      const targetDate = Math.min(schedule.dayOfMonth ?? 1, 28);
      next.setDate(1);
      next.setDate(targetDate);
      if (next <= now) {
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDate);
      }
      break;
    }
  }

  return next.toISOString();
}

async function executeSchedule(schedule: ScheduleConfig): Promise<void> {
  const keys = getServerKeys();

  if (!keys.openRouter) {
    console.error(`[Scheduler] No OpenRouter key configured, skipping schedule "${schedule.name}"`);
    return;
  }

  console.log(`[Scheduler] Running schedule "${schedule.name}" (${schedule.id})`);

  try {
    // Step 1: Search news via Jina
    let articles: { url: string; title: string; content: string; publishedDate: string; isNew: boolean }[] = [];

    if (keys.jina) {
      const topic = schedule.tags.join(", ");
      const searchUrl = `https://s.jina.ai/${encodeURIComponent(topic)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${keys.jina}`,
          Accept: "application/json",
        },
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json() as { data?: { title: string; url: string; content: string }[] };
        articles = (searchData.data || []).slice(0, 10).map((r) => ({
          url: r.url,
          title: r.title,
          content: (r.content || "").slice(0, 3000),
          publishedDate: new Date().toISOString(),
          isNew: true,
        }));
      }
    }

    if (articles.length === 0) {
      console.log(`[Scheduler] No articles found for "${schedule.name}", skipping email`);
      return;
    }

    // Step 2: Generate selected reports
    const topic = schedule.tags.join(", ");
    const market = schedule.markets.join(",");
    const results: { qa?: unknown[]; stocks?: unknown[] } = {};

    if (schedule.modules.qa) {
      try {
        const prompt = buildPrompt("qa", articles as never[], topic, schedule.location, market, schedule.stockCount);
        const schema = JSON_SCHEMAS["qa"];
        const raw = await chatCompletion(keys.openRouter, keys.model, [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ], { jsonMode: true, jsonSchema: schema });
        const parsed = JSON.parse(raw);
        results.qa = Array.isArray(parsed) ? parsed : parsed.items || [];
      } catch (err) {
        console.error(`[Scheduler] QA report failed for "${schedule.name}":`, err);
      }
    }

    if (schedule.modules.stocks) {
      try {
        const prompt = buildPrompt("stocks", articles as never[], topic, schedule.location, market, schedule.stockCount);
        const schema = JSON_SCHEMAS["stocks"];
        const raw = await chatCompletion(keys.openRouter, keys.model, [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ], { jsonMode: true, jsonSchema: schema });
        const parsed = JSON.parse(raw);
        results.stocks = Array.isArray(parsed) ? parsed : parsed.items || [];
      } catch (err) {
        console.error(`[Scheduler] Stocks report failed for "${schedule.name}":`, err);
      }
    }

    // Step 3: Save run to PostgreSQL
    const runId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.putRun({
      id: runId,
      timestamp: new Date().toISOString(),
      tags: schedule.tags,
      location: schedule.location,
      markets: schedule.markets,
      stockCount: schedule.stockCount,
      results: {
        qa: results.qa || null,
        stocks: results.stocks || null,
        graph: null,
        causechain: null,
      },
    });

    // Step 4: Send email
    if (schedule.emailTo && keys.agentMail) {
      const { subject, html } = formatAnalysisEmail(schedule, results);
      const emailResult = await sendEmail({
        apiKey: keys.agentMail,
        to: schedule.emailTo,
        subject,
        htmlBody: html,
      });
      if (!emailResult.success) {
        console.error(`[Scheduler] Email failed for "${schedule.name}":`, emailResult.error);
      } else {
        console.log(`[Scheduler] Email sent to ${schedule.emailTo} for "${schedule.name}"`);
      }
    }

    // Step 5: Update schedule with lastRun + nextRun
    const updatedSchedule: ScheduleConfig = {
      ...schedule,
      lastRun: new Date().toISOString(),
      nextRun: computeNextRun(schedule),
    };
    await db.putSchedule(updatedSchedule);

    console.log(`[Scheduler] Completed "${schedule.name}", next run: ${updatedSchedule.nextRun}`);
  } catch (err) {
    console.error(`[Scheduler] Error executing schedule "${schedule.name}":`, err);
  }
}

const runningSchedules = new Set<string>();

async function tick(): Promise<void> {
  try {
    if (!db.isAvailable()) return;

    const now = new Date().toISOString();
    const dueSchedules = await db.getDueSchedules(now) as ScheduleConfig[];

    for (const schedule of dueSchedules) {
      if (runningSchedules.has(schedule.id)) continue;
      runningSchedules.add(schedule.id);
      executeSchedule(schedule).finally(() => runningSchedules.delete(schedule.id));
    }
  } catch (err) {
    console.error("[Scheduler] Tick error:", err);
  }
}

export function startScheduler(): void {
  if (intervalId) return;

  intervalId = setInterval(tick, 60_000);
  tick();

  console.log("[Scheduler] Started (checking every 60s)");
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Scheduler] Stopped");
  }
}
