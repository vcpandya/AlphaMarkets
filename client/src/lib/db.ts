/**
 * IndexedDB wrapper for AlphaMarkets.
 *
 * Stores:
 *   - "saved_runs"   → SavedRun objects, keyed by id, indexed by timestamp
 *   - "news_history" → { topicHash, urls[] } keyed by topicHash
 */

const DB_NAME = "alphamarkets";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("saved_runs")) {
        const store = db.createObjectStore("saved_runs", { keyPath: "id" });
        store.createIndex("by_timestamp", "timestamp");
      }

      if (!db.objectStoreNames.contains("news_history")) {
        db.createObjectStore("news_history", { keyPath: "topicHash" });
      }

      if (!db.objectStoreNames.contains("stock_analyses")) {
        db.createObjectStore("stock_analyses");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

// ─── Generic helpers ───────────────────────────────────────

async function tx(
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Saved Runs ────────────────────────────────────────────

export async function getAllRuns<T>(): Promise<T[]> {
  const store = await tx("saved_runs", "readonly");
  const index = store.index("by_timestamp");
  const all = await reqToPromise(index.getAll());
  // Newest first
  return (all as T[]).reverse();
}

export async function getRun<T>(id: string): Promise<T | undefined> {
  const store = await tx("saved_runs", "readonly");
  const result = await reqToPromise(store.get(id));
  return result as T | undefined;
}

export async function putRun<T>(run: T): Promise<void> {
  const store = await tx("saved_runs", "readwrite");
  await reqToPromise(store.put(run));
}

export async function deleteRun(id: string): Promise<void> {
  const store = await tx("saved_runs", "readwrite");
  await reqToPromise(store.delete(id));
}

export async function countRuns(): Promise<number> {
  const store = await tx("saved_runs", "readonly");
  return reqToPromise(store.count());
}

// ─── News History ──────────────────────────────────────────

interface NewsHistoryEntry {
  topicHash: string;
  urls: string[];
}

export async function getNewsHistory(
  topicHash: string,
): Promise<string[]> {
  const store = await tx("news_history", "readonly");
  const entry = await reqToPromise(store.get(topicHash));
  return (entry as NewsHistoryEntry | undefined)?.urls || [];
}

export async function addNewsHistory(
  topicHash: string,
  newUrls: string[],
): Promise<void> {
  const store = await tx("news_history", "readwrite");
  const existing = await reqToPromise(store.get(topicHash));
  const currentUrls = (existing as NewsHistoryEntry | undefined)?.urls || [];
  const merged = Array.from(new Set([...currentUrls, ...newUrls]));
  await reqToPromise(
    store.put({ topicHash, urls: merged } satisfies NewsHistoryEntry),
  );
}

// ─── Stock Analyses ───────────────────────────────────────

interface StockAnalysisEntry {
  key: string;
  data: unknown;
  timestamp: string; // ISO string
}

export async function getStockAnalysis(key: string): Promise<{ data: unknown; timestamp: string } | undefined> {
  const store = await tx("stock_analyses", "readonly");
  const result = await reqToPromise(store.get(key));
  const entry = result as StockAnalysisEntry | undefined;
  if (!entry) return undefined;
  // Handle legacy entries that don't have timestamp wrapper
  if (!entry.timestamp) {
    return { data: entry, timestamp: new Date().toISOString() };
  }
  return { data: entry.data, timestamp: entry.timestamp };
}

export async function putStockAnalysis(key: string, data: unknown): Promise<void> {
  const store = await tx("stock_analyses", "readwrite");
  const entry: StockAnalysisEntry = { key, data, timestamp: new Date().toISOString() };
  await reqToPromise(store.put(entry, key));
}
