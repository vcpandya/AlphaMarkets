import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import newsRouter from "./routes/news.js";
import analysisRouter from "./routes/analysis.js";
import modelsRouter from "./routes/models.js";
import envkeysRouter from "./routes/envkeys.js";
import contentRouter from "./routes/content.js";
import storageRouter from "./routes/storage.js";
import authRouter from "./routes/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { startScheduler, stopScheduler } from "./services/scheduler.js";
import { isAvailable as sqliteIsAvailable } from "./services/sqliteStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "x-jina-key",
      "x-openrouter-key",
      "x-alphavantage-key",
      "x-agentmail-key",
    ],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

// Health check (public)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (login/logout/status are public, others require auth)
app.use("/api/auth", authRouter);

// Public: storage status (needed for auto-detect before login)
app.get("/api/storage/status", (_req, res) => {
  res.json({ available: sqliteIsAvailable(), backend: "sqlite" });
});

// Protected routes: require auth when SQLite is available (server mode)
app.use("/api/news", requireAuth, newsRouter);
app.use("/api/analysis", requireAuth, analysisRouter);
app.use("/api/models", requireAuth, modelsRouter);
app.use("/api/env-keys", requireAuth, envkeysRouter);
app.use("/api/content", requireAuth, contentRouter);
app.use("/api/storage", requireAuth, storageRouter);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Error handler (must be last)
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`AlphaMarkets server running on http://localhost:${PORT}`);
  startScheduler();
});

function shutdown() {
  console.log("Shutting down...");
  stopScheduler();
  server.close(() => process.exit(0));
  // Force exit if graceful shutdown takes too long
  setTimeout(() => process.exit(1), 10_000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
