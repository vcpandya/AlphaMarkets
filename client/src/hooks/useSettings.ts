import { useState, useCallback, useEffect } from "react";
import type { NewsSource, StorageBackend } from "../types";
import { getBackend, setBackend as setStorageBackend, checkSqliteAvailable } from "../lib/storage";

const KEYS = {
  jina: "alphamarkets:jina_key",
  openRouter: "alphamarkets:openrouter_key",
  alphaVantage: "alphamarkets:alphavantage_key",
  agentMail: "alphamarkets:agentmail_key",
  model: "alphamarkets:selected_model",
  newsSource: "alphamarkets:news_source",
} as const;

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // storage full or unavailable
  }
}

export function useSettings() {
  const [jinaKey, setJinaKeyState] = useState(() => read(KEYS.jina));
  const [openRouterKey, setOpenRouterKeyState] = useState(() =>
    read(KEYS.openRouter),
  );
  const [alphaVantageKey, setAlphaVantageKeyState] = useState(() =>
    read(KEYS.alphaVantage),
  );
  const [agentMailKey, setAgentMailKeyState] = useState(() =>
    read(KEYS.agentMail),
  );
  const [selectedModel, setSelectedModelState] = useState(() =>
    read(KEYS.model),
  );
  const [newsSource, setNewsSourceState] = useState<NewsSource>(
    () => (read(KEYS.newsSource) as NewsSource) || "jina",
  );
  const [storageBackend, setStorageBackendState] = useState<StorageBackend>(getBackend);
  const [sqliteAvailable, setSqliteAvailable] = useState(false);

  useEffect(() => {
    checkSqliteAvailable().then(setSqliteAvailable);
  }, []);

  const setJinaKey = useCallback((v: string) => {
    write(KEYS.jina, v);
    setJinaKeyState(v);
  }, []);

  const setOpenRouterKey = useCallback((v: string) => {
    write(KEYS.openRouter, v);
    setOpenRouterKeyState(v);
  }, []);

  const setAlphaVantageKey = useCallback((v: string) => {
    write(KEYS.alphaVantage, v);
    setAlphaVantageKeyState(v);
  }, []);

  const setAgentMailKey = useCallback((v: string) => {
    write(KEYS.agentMail, v);
    setAgentMailKeyState(v);
  }, []);

  const setSelectedModel = useCallback((v: string) => {
    write(KEYS.model, v);
    setSelectedModelState(v);
  }, []);

  const setNewsSource = useCallback((v: NewsSource) => {
    write(KEYS.newsSource, v);
    setNewsSourceState(v);
  }, []);

  const setStorageBackendSetting = useCallback((v: StorageBackend) => {
    setStorageBackend(v);
    setStorageBackendState(v);
  }, []);

  const hasKeys = (() => {
    if (!openRouterKey) return false;
    switch (newsSource) {
      case "jina":
        return Boolean(jinaKey);
      case "alphavantage":
        return Boolean(alphaVantageKey);
      case "both":
        return Boolean(jinaKey && alphaVantageKey);
      default:
        return false;
    }
  })();

  return {
    jinaKey,
    openRouterKey,
    alphaVantageKey,
    agentMailKey,
    selectedModel,
    newsSource,
    storageBackend,
    sqliteAvailable,
    setJinaKey,
    setOpenRouterKey,
    setAlphaVantageKey,
    setAgentMailKey,
    setSelectedModel,
    setNewsSource,
    setStorageBackend: setStorageBackendSetting,
    hasKeys,
  };
}
