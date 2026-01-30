import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { googleAuth } from "./googleAuth";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGoogleOAuthRoutes(app: Express) {
  // Google OAuth login initiation
  app.get("/api/auth/google", async (req: Request, res: Response) => {
    try {
      if (!googleAuth.isConfigured()) {
        res.status(500).json({ error: "Google OAuth not configured" });
        return;
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
      const state = btoa(JSON.stringify({ returnTo: req.query.returnTo || "/" }));
      
      const authUrl = googleAuth.getAuthUrl(redirectUri, state);
      res.redirect(302, authUrl);
    } catch (error) {
      console.error("[GoogleOAuth] Login initiation failed", error);
      res.status(500).json({ error: "Failed to initiate Google login" });
    }
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[GoogleOAuth] Authorization error:", error);
      res.redirect(302, "/?error=auth_failed");
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
      
      // Exchange code for user info
      const googleUser = await googleAuth.handleCallback(code, redirectUri);

      // Check if user exists
      let user = await db.getUserByGoogleId(googleUser.googleId);

      if (!user) {
        // Check if user exists by email (for migration from Manus auth)
        const existingUser = await db.getUserByEmail(googleUser.email);
        
        if (existingUser) {
          // Update existing user with Google ID
          const dbInstance = await db.getDb();
          if (dbInstance) {
            const { users } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await dbInstance.update(users)
              .set({ 
                googleId: googleUser.googleId,
                avatarUrl: googleUser.avatarUrl,
                loginMethod: "google",
                lastSignedIn: new Date()
              })
              .where(eq(users.id, existingUser.id));
          }
          user = await db.getUserById(existingUser.id);
        } else {
          // Create new user
          user = await db.createUserFromGoogle(googleUser);
        }
      }

      if (!user) {
        res.status(500).json({ error: "Failed to create or find user" });
        return;
      }

      // Create session token
      const sessionToken = await googleAuth.createSessionToken(
        user.id,
        user.email || "",
        user.name || "",
        { expiresInMs: ONE_YEAR_MS }
      );

      // Set cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Parse state for return URL
      let returnTo = "/";
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          returnTo = stateData.returnTo || "/";
        } catch {
          // Ignore state parsing errors
        }
      }

      res.redirect(302, returnTo);
    } catch (error) {
      console.error("[GoogleOAuth] Callback failed", error);
      res.redirect(302, "/?error=auth_failed");
    }
  });

  // Get Google login URL (for frontend)
  app.get("/api/auth/google/url", async (req: Request, res: Response) => {
    try {
      if (!googleAuth.isConfigured()) {
        res.json({ configured: false, url: null });
        return;
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
      const returnTo = getQueryParam(req, "returnTo") || "/";
      const state = btoa(JSON.stringify({ returnTo }));
      
      const authUrl = googleAuth.getAuthUrl(redirectUri, state);
      res.json({ configured: true, url: authUrl });
    } catch (error) {
      console.error("[GoogleOAuth] Failed to generate URL", error);
      res.status(500).json({ error: "Failed to generate login URL" });
    }
  });
}
