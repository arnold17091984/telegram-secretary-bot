import { getDb } from "../db";
import { triggers } from "../../drizzle/schema";

const DEFAULT_TRIGGERS = [
  {
    triggerKeyword: "【タスク】",
    triggerType: "task" as const,
    description: "タスク作成・期限管理・リマインド機能を提供します。",
    enabled: 1,
  },
  {
    triggerKeyword: "【ミーティング】",
    triggerType: "meeting" as const,
    description: "Google Calendar連携・Meet リンク生成・10分前リマインド機能を提供します。",
    enabled: 1,
  },
  {
    triggerKeyword: "【AI】",
    triggerType: "ai_draft" as const,
    description: "直近50件の履歴からAI下書きを生成します。",
    enabled: 1,
  },
  {
    triggerKeyword: "【返答】",
    triggerType: "reply_generation" as const,
    description: "未回答質問を抽出し返答下書きを生成します。",
    enabled: 1,
  },
];

export async function initializeDefaultTriggers() {
  const db = await getDb();
  if (!db) {
    console.warn("[DefaultTriggers] Database not available, skipping initialization");
    return;
  }

  try {
    // トリガーが既に存在するかチェック
    const existingTriggers = await db.select().from(triggers).limit(1);
    
    if (existingTriggers.length > 0) {
      console.log("[DefaultTriggers] Triggers already exist, skipping initialization");
      return;
    }

    // デフォルトトリガーを挿入
    for (const trigger of DEFAULT_TRIGGERS) {
      await db.insert(triggers).values(trigger);
    }

    console.log("[DefaultTriggers] Successfully initialized default triggers");
  } catch (error) {
    console.error("[DefaultTriggers] Failed to initialize default triggers:", error);
  }
}
