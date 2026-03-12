import { NewsArticle } from "../types/index.js";

interface JinaSearchResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  description?: string;
}

interface JinaSearchResponse {
  code: number;
  status: number;
  data: JinaSearchResult[];
}

function buildSearchQuery(
  topic: string,
  location: string,
  datePeriod?: { from: string; to: string }
): string {
  let query = topic;
  if (location) {
    query += ` ${location}`;
  }
  if (datePeriod) {
    query += ` ${datePeriod.from} to ${datePeriod.to}`;
  }
  return query;
}

export async function searchNews(
  apiKey: string,
  topic: string,
  location: string,
  datePeriod?: { from: string; to: string }
): Promise<NewsArticle[]> {
  const query = buildSearchQuery(topic, location, datePeriod);
  const encodedQuery = encodeURIComponent(query);
  const url = `https://s.jina.ai/${encodedQuery}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "X-With-Generated-Alt": "true",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw Object.assign(
      new Error(`Jina Search API error: ${response.status} - ${errorText}`),
      { statusCode: response.status }
    );
  }

  const json = (await response.json()) as JinaSearchResponse;
  const results = json.data || [];

  return results.map((item) => ({
    url: item.url || "",
    title: item.title || "Untitled",
    content: item.content || item.description || "",
    publishedDate: item.publishedDate || new Date().toISOString(),
    isNew: true,
    source: extractSource(item.url),
  }));
}

function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
