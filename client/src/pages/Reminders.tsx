import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Calendar, Clock, Edit, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Reminder = {
  id: number;
  chatId: string;
  userId: string | null;
  message: string;
  remindAt: Date;
  status: string;
  originalMessageId: string | null;
  repeatType: string | null;
  repeatDays: string | null;
  repeatEndDate: Date | null;
  eventName: string | null;
  reminderMinutesBefore: number | null;
  createdAt: Date;
};

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="default" className="bg-blue-500">待機中</Badge>;
    case "sent":
      return <Badge variant="secondary">送信済み</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-gray-500">キャンセル</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRepeatTypeName(repeatType: string | null) {
  switch (repeatType) {
    case "daily":
      return "毎日";
    case "weekly":
      return "毎週";
    case "monthly":
      return "毎月";
    default:
      return "1回のみ";
  }
}

function getDayNames(repeatDays: string | null) {
  if (!repeatDays) return "";
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const days = repeatDays.split(",").map(d => parseInt(d.trim()));
  return days.map(d => dayNames[d]).join("・");
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default function Reminders() {
  // Using sonner toast
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "cancelled">("all");
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  const { data: reminders, isLoading, refetch } = trpc.reminders.list.useQuery({ status: statusFilter });
  const updateMutation = trpc.reminders.update.useMutation({
    onSuccess: () => {
      toast.success("リマインダーを更新しました");
      refetch();
      setEditingReminder(null);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });
  const deleteMutation = trpc.reminders.delete.useMutation({
    onSuccess: () => {
      toast.success("リマインダーをキャンセルしました");
      refetch();
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate({ id: deleteConfirmId });
    }
  };

  const handleUpdate = () => {
    if (!editingReminder) return;
    updateMutation.mutate({
      id: editingReminder.id,
      message: editingReminder.message,
      eventName: editingReminder.eventName || undefined,
      reminderMinutesBefore: editingReminder.reminderMinutesBefore || undefined,
      repeatType: (editingReminder.repeatType as "none" | "daily" | "weekly" | "monthly") || "none",
      repeatDays: editingReminder.repeatDays,
    });
  };

  const pendingCount = reminders?.filter(r => r.status === "pending").length || 0;
  const sentCount = reminders?.filter(r => r.status === "sent").length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">リマインダー管理</h1>
            <p className="text-muted-foreground">設定済みのリマインダーを確認・編集・削除できます</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待機中</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">通知待ちのリマインダー</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">送信済み</CardTitle>
              <Bell className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentCount}</div>
              <p className="text-xs text-muted-foreground">送信完了したリマインダー</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">合計</CardTitle>
              <Calendar className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reminders?.length || 0}</div>
              <p className="text-xs text-muted-foreground">全リマインダー数</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="pending">待機中</TabsTrigger>
            <TabsTrigger value="sent">送信済み</TabsTrigger>
            <TabsTrigger value="cancelled">キャンセル</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reminders && reminders.length > 0 ? (
              <div className="space-y-4">
                {reminders.map((reminder) => (
                  <Card key={reminder.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Bell className="h-4 w-4" />
                            {reminder.eventName || "リマインダー"}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-2">
                            {getStatusBadge(reminder.status)}
                            <Badge variant="outline">{getRepeatTypeName(reminder.repeatType)}</Badge>
                            {reminder.repeatType === "weekly" && reminder.repeatDays && (
                              <Badge variant="outline">{getDayNames(reminder.repeatDays)}</Badge>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {reminder.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(reminder as Reminder)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(reminder.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>通知予定: {formatDateTime(reminder.remindAt)}</span>
                        </div>
                        {reminder.reminderMinutesBefore && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            <span>イベント{reminder.reminderMinutesBefore}分前に通知</span>
                          </div>
                        )}
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <p className="whitespace-pre-wrap">{reminder.message}</p>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          作成日: {formatDateTime(reminder.createdAt)} | チャットID: {reminder.chatId}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">リマインダーがありません</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Telegramで「@ボット名 18時にミーティング、15分前にリマインド」のように送信してください
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingReminder} onOpenChange={(open) => !open && setEditingReminder(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>リマインダーを編集</DialogTitle>
              <DialogDescription>リマインダーの内容を編集できます</DialogDescription>
            </DialogHeader>
            {editingReminder && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="eventName">イベント名</Label>
                  <Input
                    id="eventName"
                    value={editingReminder.eventName || ""}
                    onChange={(e) => setEditingReminder({ ...editingReminder, eventName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">通知メッセージ</Label>
                  <Input
                    id="message"
                    value={editingReminder.message}
                    onChange={(e) => setEditingReminder({ ...editingReminder, message: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminderMinutes">何分前に通知</Label>
                  <Input
                    id="reminderMinutes"
                    type="number"
                    value={editingReminder.reminderMinutesBefore || 15}
                    onChange={(e) => setEditingReminder({ ...editingReminder, reminderMinutesBefore: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeatType">繰り返し</Label>
                  <Select
                    value={editingReminder.repeatType || "none"}
                    onValueChange={(value) => setEditingReminder({ ...editingReminder, repeatType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">1回のみ</SelectItem>
                      <SelectItem value="daily">毎日</SelectItem>
                      <SelectItem value="weekly">毎週</SelectItem>
                      <SelectItem value="monthly">毎月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingReminder(null)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>リマインダーをキャンセル</DialogTitle>
              <DialogDescription>
                このリマインダーをキャンセルしますか？この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                戻る
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "キャンセル中..." : "キャンセルする"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
