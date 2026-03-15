/**
 * Storage abstraction layer.
 *
 * Provides a unified interface over two backends:
 *   - "indexeddb" (browser-only, default)
 *   - "sqlite" (server-side, for EC2 / multi-user deployment)
 *
 * All hooks consume this module instead of db.ts directly.
 */

import * as idb from "./db";
import type { StorageBackend } from "../types";

const API_BASE = "/api/storage";

// ─── Current backend (reactive via localStorage) ─────────

const STORAGE_KEY = "alphamarkets:storage_backend";

export function getBackend(): StorageBackend {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "sqlite") return "sqlite";
  } catch { /* SSR or unavailable */ }
  return "indexeddb";
}

export function setBackend(backend: StorageBackend): void {
  try {
    localStorage.setItem(STORAGE_KEY, backend);
  } catch { /* ignore */ }
}

export async function checkSqliteAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/status`, { credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json();
    // Auto-select SQLite when server-side is available
    if (data.available && getBackend() === "indexeddb") {
      setBackend("sqlite");
    }
    return data.available === true;
  } catch {
    return false;
  }
}

// ─── Helper ─────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Storage API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Saved Runs ─────────────────────────────────────────

export async function getAllRuns<T>(): Promise<T[]> {
  if (getBackend() === "sqlite") {
    const data = await fetchJson<{ runs: T[] }>(`${API_BASE}/runs`);
    return data.runs;
  }
  return idb.getAllRuns<T>();
}

export async function getRun<T>(id: string): Promise<T | undefined> {
  if (getBackend() === "sqlite") {
    try {
      const data = await fetchJson<{ run: T }>(`${API_BASE}/runs/${encodeURIComponent(id)}`);
      return data.run;
    } catch {
      return undefined;
    }
  }
  return idb.getRun<T>(id);
}

export async function putRun<T>(run: T): Promise<void> {
  if (getBackend() === "sqlite") {
    await fetchJson(`${API_BASE}/runs`, {
      method: "POST",
      body: JSON.stringify(run),
    });
    return;
  }
  return idb.putRun(run);
}

export async function deleteRun(id: string): Promise<void> {
  if (getBackend() === "sqlite") {
    await fetchJson(`${API_BASE}/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  return idb.deleteRun(id);
}

export async function countRuns(): Promise<number> {
  if (getBackend() === "sqlite") {
    const data = await fetchJson<{ runs: unknown[] }>(`${API_BASE}/runs`);
    return data.runs.length;
  }
  return idb.countRuns();
}

// ─── News History ───────────────────────────────────────

export async function getNewsHistory(topicHash: string): Promise<string[]> {
  if (getBackend() === "sqlite") {
    const data = await fetchJson<{ urls: string[] }>(
      `${API_BASE}/news-history/${encodeURIComponent(topicHash)}`,
    );
    return data.urls;
  }
  return idb.getNewsHistory(topicHash);
}

export async function addNewsHistory(topicHash: string, newUrls: string[]): Promise<void> {
  if (getBackend() === "sqlite") {
    await fetchJson(`${API_BASE}/news-history`, {
      method: "POST",
      body: JSON.stringify({ topicHash, urls: newUrls }),
    });
    return;
  }
  return idb.addNewsHistory(topicHash, newUrls);
}

// ─── Stock Analyses ─────────────────────────────────────

export async function getStockAnalysis(key: string): Promise<{ data: unknown; timestamp: string } | undefined> {
  if (getBackend() === "sqlite") {
    try {
      return await fetchJson<{ data: unknown; timestamp: string }>(
        `${API_BASE}/stock-analyses/${encodeURIComponent(key)}`,
      );
    } catch {
      return undefined;
    }
  }
  return idb.getStockAnalysis(key);
}

export async function putStockAnalysis(key: string, data: unknown): Promise<void> {
  if (getBackend() === "sqlite") {
    await fetchJson(`${API_BASE}/stock-analyses`, {
      method: "POST",
      body: JSON.stringify({ key, data }),
    });
    return;
  }
  return idb.putStockAnalysis(key, data);
}
