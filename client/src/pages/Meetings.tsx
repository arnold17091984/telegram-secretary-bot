import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Video, Users } from "lucide-react";

export default function Meetings() {
  const meetings = [
    {
      id: 1,
      title: "チームスタンドアップ",
      time: "今日 14:00 - 14:30",
      type: "Google Meet",
      attendees: 5,
      status: "確定",
    },
    {
      id: 2,
      title: "プロジェクトレビュー",
      time: "明日 15:00 - 16:00",
      type: "Google Meet",
      attendees: 8,
      status: "確定",
    },
    {
      id: 3,
      title: "クライアントミーティング",
      time: "2日後 10:00 - 11:00",
      type: "対面",
      attendees: 3,
      status: "保留中",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">ミーティング管理</h2>
          <p className="text-muted-foreground">
            全てのミーティングをスケジュールし、Google Calendarと連携できます。
          </p>
        </div>

        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      {meeting.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span>{meeting.time}</span>
                      <span className="flex items-center gap-1">
                        {meeting.type === "Google Meet" ? (
                          <Video className="h-4 w-4" />
                        ) : null}
                        {meeting.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.attendees}名
                      </span>
                    </CardDescription>
                  </div>
                  <Badge
                    variant={meeting.status === "確定" ? "default" : "outline"}
                    className={
                      meeting.status === "確定"
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-100"
                        : ""
                    }
                  >
                    {meeting.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
