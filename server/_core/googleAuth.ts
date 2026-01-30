import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import type { User } from "../../drizzle/schema";
import { ForbiddenError } from "@shared/_core/errors";
import { ENV } from "./env";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
};

class GoogleAuthService {
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      this.oauth2Client = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
      console.log("[GoogleAuth] Initialized with client ID:", GOOGLE_CLIENT_ID.substring(0, 20) + "...");
    } else {
      console.warn("[GoogleAuth] WARNING: Google OAuth credentials not configured");
    }
  }

  /**
   * Generate Google OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state?: string): string {
    if (!this.oauth2Client) {
      throw new Error("Google OAuth not configured");
    }

    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      redirect_uri: redirectUri,
      state: state,
      prompt: "consent",
    });
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async handleCallback(code: string, redirectUri: string): Promise<{
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }> {
    if (!this.oauth2Client) {
      throw new Error("Google OAuth not configured");
    }

    // Exchange code for tokens
    const { tokens } = await this.oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    // Verify ID token and get user info
    const ticket = await this.oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid ID token");
    }

    return {
      googleId: payload.sub,
      email: payload.email || "",
      name: payload.name || "",
      avatarUrl: payload.picture || null,
    };
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user
   */
  async createSessionToken(
    userId: number,
    email: string,
    name: string,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      userId,
      email,
      name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * Verify session token
   */
  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });

      const { userId, email, name } = payload as Record<string, unknown>;

      if (typeof userId !== "number" || typeof email !== "string") {
        console.warn("[GoogleAuth] Session payload missing required fields");
        return null;
      }

      return {
        userId,
        email,
        name: typeof name === "string" ? name : "",
      };
    } catch (error) {
      console.warn("[GoogleAuth] Session verification failed", String(error));
      return null;
    }
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  /**
   * Authenticate request and return user
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    const user = await db.getUserById(session.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Update last signed in
    await db.updateUserLastSignedIn(user.id);

    return user;
  }

  isConfigured(): boolean {
    return this.oauth2Client !== null;
  }
}

export const googleAuth = new GoogleAuthService();
