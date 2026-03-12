import { useCallback } from "react";
import * as db from "../lib/db";

function hashTopic(topic: string): string {
  let h = 0;
  for (let i = 0; i < topic.length; i++) {
    h = ((h << 5) - h + topic.charCodeAt(i)) | 0;
  }
  return "t_" + Math.abs(h).toString(36);
}

export function useNewsHistory() {
  const getPreviousUrls = useCallback(async (topic: string): Promise<string[]> => {
    const key = hashTopic(topic);
    return db.getNewsHistory(key);
  }, []);

  const addUrls = useCallback(async (topic: string, urls: string[]) => {
    const key = hashTopic(topic);
    await db.addNewsHistory(key, urls);
  }, []);

  return { getPreviousUrls, addUrls };
}
