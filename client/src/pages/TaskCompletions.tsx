import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Calendar } from "lucide-react";

export default function TaskCompletions() {
  const { data: completions, isLoading } = trpc.recurringTasks.completions.useQuery({});

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6" />
              完了履歴
            </h1>
            <p className="text-muted-foreground mt-1">
              定期タスクの完了報告履歴を確認できます
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              最近の完了報告
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                読み込み中...
              </div>
            ) : !completions || completions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>完了報告はまだありません</p>
                <p className="text-sm mt-2">
                  定期タスクのリマインダーで「完了報告」ボタンを押すと記録されます
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タスク</TableHead>
                    <TableHead>報告者</TableHead>
                    <TableHead>予定時刻</TableHead>
                    <TableHead>完了時刻</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completions.map((item: any) => (
                    <TableRow key={item.completion.id}>
                      <TableCell className="font-medium">
                        {item.task?.taskTitle || '（削除済み）'}
                      </TableCell>
                      <TableCell>{item.completion.completedByName || '-'}</TableCell>
                      <TableCell>{formatDateTime(item.completion.scheduledAt)}</TableCell>
                      <TableCell>{formatDateTime(item.completion.completedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
