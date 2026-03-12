import { useState, useEffect, useCallback } from "react";
import type { SavedRun } from "../types";
import * as db from "../lib/db";

function generateId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useSavedRuns() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all runs from IndexedDB on mount
  useEffect(() => {
    db.getAllRuns<SavedRun>()
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  const saveRun = useCallback(
    async (run: Omit<SavedRun, "id" | "timestamp">): Promise<string> => {
      const id = generateId();
      const newRun: SavedRun = {
        ...run,
        id,
        timestamp: new Date().toISOString(),
      };

      await db.putRun(newRun);
      setRuns((prev) => [newRun, ...prev]);
      return id;
    },
    [],
  );

  const deleteRunById = useCallback(async (id: string) => {
    await db.deleteRun(id);
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRun = useCallback(
    async (id: string): Promise<SavedRun | undefined> => {
      // Check in-memory first
      const cached = runs.find((r) => r.id === id);
      if (cached) return cached;
      // Fall back to IndexedDB
      return db.getRun<SavedRun>(id);
    },
    [runs],
  );

  return { runs, loading, saveRun, deleteRun: deleteRunById, getRun };
}
