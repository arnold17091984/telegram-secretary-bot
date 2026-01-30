import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("Bot Settings API", () => {
  it("should get all bot settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const settings = await caller.botSettings.getAll();
    expect(Array.isArray(settings)).toBe(true);
  });

  it.skipIf(!process.env.DATABASE_URL)("should upsert bot setting", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.botSettings.upsert({
      key: "test_setting",
      value: "test_value",
      description: "Test setting",
    });

    expect(result.success).toBe(true);
  });
});

describe("Group Chats API", () => {
  it("should get all group chats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const groupChats = await caller.groupChats.getAll();
    expect(Array.isArray(groupChats)).toBe(true);
  });

  it.skipIf(!process.env.DATABASE_URL)("should upsert group chat", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.groupChats.upsert({
      groupChatId: "-1001234567890",
      groupName: "Test Group",
      responsibleUserId: "test_user",
      calendarId: "primary",
    });

    expect(result.success).toBe(true);
  });
});

describe("Tasks API", () => {
  it("should get all tasks", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const tasks = await caller.tasks.getAll();
    expect(Array.isArray(tasks)).toBe(true);
  });
});

describe("Meetings API", () => {
  it("should get all meetings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const meetings = await caller.meetings.getAll();
    expect(Array.isArray(meetings)).toBe(true);
  });
});

describe("Drafts API", () => {
  it("should get all drafts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const drafts = await caller.drafts.getAll();
    expect(Array.isArray(drafts)).toBe(true);
  });
});

describe("Audit Logs API", () => {
  it("should get all audit logs", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.auditLogs.getAll();
    expect(Array.isArray(logs)).toBe(true);
  });
});
