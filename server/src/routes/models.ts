import { Router, Request, Response, NextFunction } from "express";
import { validateOpenRouterKey } from "../middleware/validateKeys.js";
import { listModels } from "../services/openRouterService.js";

const router = Router();

router.get(
  "/",
  validateOpenRouterKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const models = await listModels(req.openRouterKey!);
      res.json({ models });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
