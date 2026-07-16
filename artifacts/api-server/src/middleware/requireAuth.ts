import type { Request, Response, NextFunction } from "express";
import { validateMobileToken } from "../lib/mobileAuth";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Session auth (web browser)
  if (req.session?.userId) {
    next();
    return;
  }

  // Bearer token auth (Android app)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token  = authHeader.slice(7);
    const userId = await validateMobileToken(token).catch(() => null);
    if (userId) {
      req.session.userId = userId;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Not authenticated" });
}
