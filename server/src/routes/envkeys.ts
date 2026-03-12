import { Router, Request, Response } from "express";

const router = Router();

interface KeyConfig {
  name: string;
  envVars: string[];
}

const KEY_CONFIGS: KeyConfig[] = [
  {
    name: "openRouter",
    envVars: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
  },
  {
    name: "jina",
    envVars: ["JINA_API_KEY", "JINA_KEY"],
  },
  {
    name: "alphaVantage",
    envVars: [
      "ALPHA_VANTAGE_API_KEY",
      "ALPHA_VANTAGE_KEY",
      "ALPHAVANTAGE_API_KEY",
    ],
  },
];

function findEnvValue(envVars: string[]): string | undefined {
  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value) return value;
  }
  return undefined;
}

function maskKey(key: string): string {
  if (key.length <= 8) {
    return key.substring(0, 2) + "..." + key.substring(key.length - 2);
  }
  return key.substring(0, 4) + "..." + key.substring(key.length - 4);
}

// GET /api/env-keys - check which keys are available
router.get("/", (_req: Request, res: Response) => {
  const result: Record<
    string,
    { found: boolean; preview: string | null }
  > = {};

  for (const config of KEY_CONFIGS) {
    const value = findEnvValue(config.envVars);
    result[config.name] = {
      found: !!value,
      preview: value ? maskKey(value) : null,
    };
  }

  res.json(result);
});

// POST /api/env-keys/resolve - get actual key value on demand
router.post("/resolve", (req: Request, res: Response) => {
  const { key } = req.body as { key: string };

  if (!key) {
    res.status(400).json({ error: "Missing required field: key" });
    return;
  }

  const config = KEY_CONFIGS.find((c) => c.name === key);
  if (!config) {
    res.status(400).json({
      error: `Unknown key name: ${key}. Valid options: ${KEY_CONFIGS.map((c) => c.name).join(", ")}`,
    });
    return;
  }

  const value = findEnvValue(config.envVars);
  if (!value) {
    res.status(404).json({
      error: `No environment variable found for ${key}`,
    });
    return;
  }

  res.json({ key: config.name, value });
});

export default router;
