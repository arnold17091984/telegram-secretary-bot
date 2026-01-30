import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Settings as SettingsIcon } from "lucide-react";

export default function AuditLogs() {
  const logs = [
    {
      id: 1,
      action: "タスク作成",
      user: "john@example.com",
      timestamp: "2分前",
      details: "「APIドキュメントの更新」を作成",
    },
    {
      id: 2,
      action: "設定変更",
      user: "admin@example.com",
      timestamp: "1時間前",
      details: "Telegram Bot Tokenを更新",
    },
    {
      id: 3,
      action: "ミーティング作成",
      user: "sarah@example.com",
      timestamp: "3時間前",
      details: "「チームスタンドアップ」を作成",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">監査ログ</h2>
          <p className="text-muted-foreground">
            システム内の全ての操作履歴を確認できます。
          </p>
        </div>

        <div className="grid gap-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      {log.action}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {log.user}
                      </span>
                      <span>{log.timestamp}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{log.details}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
