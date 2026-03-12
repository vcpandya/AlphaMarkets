import { Router, Request, Response, NextFunction } from "express";
import { validateJinaKey } from "../middleware/validateKeys.js";

const router = Router();

// Extract content from a single URL using Jina Reader
router.post(
  "/extract-url",
  validateJinaKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body as { url: string };
      if (!url) {
        res.status(400).json({ error: "Missing required field: url" });
        return;
      }

      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Authorization: `Bearer ${req.jinaKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jina Reader error: ${response.status} - ${errorText}`);
      }

      const json = await response.json() as { data: { title: string; content: string; url: string } };
      const data = json.data || {};

      res.json({
        title: data.title || "Untitled",
        content: data.content || "",
        url: data.url || url,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
