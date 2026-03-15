import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import * as db from "../services/pgStorage.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
} from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const user = await db.getUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  await db.updateUserLastLogin(user.id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role as "admin" | "user",
  });

  setAuthCookie(res, token);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }

  const user = await db.getUserById(req.user.userId);
  if (!user) {
    res.json({ user: null });
    return;
  }

  const byok = ((await db.getServerSetting("byok")) ?? "true") === "true";

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    },
    settings: { byok },
  });
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const user = await db.getUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.updateUserPassword(user.id, hash);

  res.json({ ok: true });
});

// GET /api/auth/users (admin only)
router.get("/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const users = await db.getAllUsers();
  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      invitedBy: u.invited_by,
      createdAt: u.created_at,
      lastLogin: u.last_login,
    })),
  });
});

// POST /api/auth/invite (admin only)
router.post("/invite", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { username, password, displayName, role } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = await db.getUserByUsername(username);
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const userRole = role === "admin" ? "admin" : "user";
  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const hash = bcrypt.hashSync(password, 10);

  await db.createUser({
    id,
    username,
    passwordHash: hash,
    displayName: displayName || username,
    role: userRole,
    invitedBy: req.user!.userId,
  });

  res.json({
    ok: true,
    user: { id, username, displayName: displayName || username, role: userRole },
  });
});

// DELETE /api/auth/users/:id (admin only)
router.delete("/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    await db.deleteUser(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete user" });
  }
});

// GET /api/auth/server-settings (admin only)
router.get("/server-settings", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const settings = await db.getAllServerSettings();
  res.json({ settings });
});

// POST /api/auth/server-settings (admin only)
router.post("/server-settings", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { key, value } = req.body;
  if (!key) {
    res.status(400).json({ error: "key required" });
    return;
  }
  await db.setServerSetting(key, String(value));
  res.json({ ok: true });
});

// GET /api/auth/status - public
router.get("/status", (_req: Request, res: Response) => {
  res.json({ authRequired: db.isAvailable() });
});

export default router;
