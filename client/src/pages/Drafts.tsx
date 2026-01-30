import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare } from "lucide-react";

export default function Drafts() {
  const drafts = [
    {
      id: 1,
      content: "プロジェクトの進捗状況について、チーム全体で共有したいと思います...",
      createdAt: "2時間前",
      status: "承認待ち",
      type: "AI生成",
    },
    {
      id: 2,
      content: "次回のミーティングの議題について、以下の点を確認したいです...",
      createdAt: "5時間前",
      status: "承認待ち",
      type: "返答生成",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">下書き管理</h2>
          <p className="text-muted-foreground">
            AI生成された下書きを確認し、承認または編集できます。
          </p>
        </div>

        <div className="grid gap-4">
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      下書き #{draft.id}
                    </CardTitle>
                    <CardDescription>
                      {draft.createdAt} • {draft.type}
                    </CardDescription>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                    {draft.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {draft.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
