import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Clock, AlertCircle } from "lucide-react";

export default function Tasks() {
  const tasks = [
    {
      id: 1,
      title: "APIドキュメントの更新",
      assignee: "@john",
      dueDate: "今日 17:00",
      status: "進行中",
      priority: "高",
    },
    {
      id: 2,
      title: "プルリクエストのレビュー",
      assignee: "@sarah",
      dueDate: "明日 10:00",
      status: "保留中",
      priority: "中",
    },
    {
      id: 3,
      title: "データベース最適化",
      assignee: "@mike",
      dueDate: "3日後",
      status: "保留中",
      priority: "低",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">タスク管理</h2>
          <p className="text-muted-foreground">
            全てのタスクを一元管理し、進捗を追跡できます。
          </p>
        </div>

        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      {task.title}
                    </CardTitle>
                    <CardDescription>
                      担当者: {task.assignee} • 期限: {task.dueDate}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={task.status === "進行中" ? "default" : "outline"}
                      className={
                        task.status === "進行中"
                          ? "bg-purple-100 text-purple-700 hover:bg-purple-100"
                          : ""
                      }
                    >
                      {task.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        task.priority === "高"
                          ? "border-red-500 text-red-500"
                          : task.priority === "中"
                            ? "border-yellow-500 text-yellow-500"
                            : "border-green-500 text-green-500"
                      }
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
