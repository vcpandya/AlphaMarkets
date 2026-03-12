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

export function validateJinaKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const jinaKey = req.headers["x-jina-key"] as string | undefined;
  if (!jinaKey) {
    res.status(401).json({ error: "Missing Jina API key (x-jina-key header)" });
    return;
  }
  req.jinaKey = jinaKey;
  next();
}

export function validateOpenRouterKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const openRouterKey = req.headers["x-openrouter-key"] as string | undefined;
  if (!openRouterKey) {
    res
      .status(401)
      .json({ error: "Missing OpenRouter API key (x-openrouter-key header)" });
    return;
  }
  req.openRouterKey = openRouterKey;
  next();
}

export function validateAlphaVantageKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const alphaVantageKey = req.headers["x-alphavantage-key"] as string | undefined;
  if (!alphaVantageKey) {
    res
      .status(401)
      .json({ error: "Missing Alpha Vantage API key (x-alphavantage-key header)" });
    return;
  }
  req.alphaVantageKey = alphaVantageKey;
  next();
}

export function validateAllKeys(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const jinaKey = req.headers["x-jina-key"] as string | undefined;
  const openRouterKey = req.headers["x-openrouter-key"] as string | undefined;

  const missing: string[] = [];
  if (!jinaKey) missing.push("x-jina-key");
  if (!openRouterKey) missing.push("x-openrouter-key");

  if (missing.length > 0) {
    res
      .status(401)
      .json({ error: `Missing required API key headers: ${missing.join(", ")}` });
    return;
  }

  req.jinaKey = jinaKey;
  req.openRouterKey = openRouterKey;
  next();
}
