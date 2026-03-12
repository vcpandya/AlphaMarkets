import express from "express";
import cors from "cors";
import newsRouter from "./routes/news.js";
import analysisRouter from "./routes/analysis.js";
import modelsRouter from "./routes/models.js";
import envkeysRouter from "./routes/envkeys.js";
import contentRouter from "./routes/content.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: [
      "Content-Type",
      "x-jina-key",
      "x-openrouter-key",
      "x-alphavantage-key",
    ],
  })
);
app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/news", newsRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/models", modelsRouter);
app.use("/api/env-keys", envkeysRouter);
app.use("/api/content", contentRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`AlphaMarkets server running on http://localhost:${PORT}`);
});

export default app;
