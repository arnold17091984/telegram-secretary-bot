import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { googleAuth } from "./googleAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Try Google OAuth first (new auth system)
  try {
    if (googleAuth.isConfigured()) {
      user = await googleAuth.authenticateRequest(opts.req);
    }
  } catch (error) {
    // Google auth failed, try legacy Manus auth
    user = null;
  }

  // Fall back to legacy Manus OAuth if Google auth didn't work
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
