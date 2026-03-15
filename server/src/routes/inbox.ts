import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listInbox, getMessage, replyToMessage } from "../services/agentMailService.js";

const router = Router();

// GET /api/inbox - list messages in the omni@agentmail.to mailbox (admin only)
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  const limit = 20;
  const result = await listInbox(limit);
  if (result.error) {
    res.status(502).json({ error: result.error });
    return;
  }
  res.json({ messages: result.messages });
});

// GET /api/inbox/:messageId - get a single message
router.get("/:messageId", requireAdmin, async (req: Request, res: Response) => {
  const messageId = req.params.messageId as string;
  const result = await getMessage(messageId);
  if (result.error || !result.message) {
    res.status(result.message === null ? 404 : 502).json({ error: result.error || "Message not found" });
    return;
  }
  res.json({ message: result.message });
});

// POST /api/inbox/:messageId/reply - reply to a message
router.post("/:messageId/reply", requireAdmin, async (req: Request, res: Response) => {
  const messageId = req.params.messageId as string;
  const { html } = req.body as { html: string };
  if (!html) {
    res.status(400).json({ error: "Missing required field: html" });
    return;
  }
  const result = await replyToMessage(messageId, html);
  if (!result.success) {
    res.status(502).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

export default router;
