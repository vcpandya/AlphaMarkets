import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      jinaKey?: string;
      openRouterKey?: string;
      alphaVantageKey?: string;
    }
  }
}

// Helper: header value takes precedence over env var fallback
function resolveKey(headerValue: string | undefined, ...envVars: string[]): string | undefined {
  if (headerValue) return headerValue;
  for (const envVar of envVars) {
    const v = process.env[envVar];
    if (v) return v;
  }
  return undefined;
}

export function validateJinaKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = resolveKey(
    req.headers["x-jina-key"] as string | undefined,
    "JINA_API_KEY",
    "JINA_KEY",
  );
  if (!key) {
    res.status(401).json({ error: "Missing Jina API key (set x-jina-key header or JINA_API_KEY env var)" });
    return;
  }
  req.jinaKey = key;
  next();
}

export function validateOpenRouterKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = resolveKey(
    req.headers["x-openrouter-key"] as string | undefined,
    "OPENROUTER_API_KEY",
    "OPENROUTER_KEY",
  );
  if (!key) {
    res.status(401).json({ error: "Missing OpenRouter API key (set x-openrouter-key header or OPENROUTER_API_KEY env var)" });
    return;
  }
  req.openRouterKey = key;
  next();
}

export function validateAlphaVantageKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = resolveKey(
    req.headers["x-alphavantage-key"] as string | undefined,
    "ALPHA_VANTAGE_API_KEY",
    "ALPHA_VANTAGE_KEY",
    "ALPHAVANTAGE_API_KEY",
  );
  if (!key) {
    res.status(401).json({ error: "Missing Alpha Vantage API key (set x-alphavantage-key header or ALPHA_VANTAGE_API_KEY env var)" });
    return;
  }
  req.alphaVantageKey = key;
  next();
}

export function validateAllKeys(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const jinaKey = resolveKey(
    req.headers["x-jina-key"] as string | undefined,
    "JINA_API_KEY",
    "JINA_KEY",
  );
  const openRouterKey = resolveKey(
    req.headers["x-openrouter-key"] as string | undefined,
    "OPENROUTER_API_KEY",
    "OPENROUTER_KEY",
  );

  const missing: string[] = [];
  if (!jinaKey) missing.push("x-jina-key / JINA_API_KEY");
  if (!openRouterKey) missing.push("x-openrouter-key / OPENROUTER_API_KEY");

  if (missing.length > 0) {
    res.status(401).json({ error: `Missing required API keys: ${missing.join(", ")}` });
    return;
  }

  req.jinaKey = jinaKey;
  req.openRouterKey = openRouterKey;
  next();
}
