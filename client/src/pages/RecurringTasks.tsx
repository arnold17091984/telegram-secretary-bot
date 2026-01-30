import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Pencil, Trash2, Repeat, Pause, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export default function RecurringTasks() {
  const { data: tasks, isLoading, refetch } = trpc.recurringTasks.list.useQuery();
  const updateMutation = trpc.recurringTasks.update.useMutation();
  const deleteMutation = trpc.recurringTasks.delete.useMutation();

  const [editingTask, setEditingTask] = useState<any>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<any>(null);

  const formatSchedule = (task: any) => {
    const time = `${task.hour}:${String(task.minute).padStart(2, '0')}`;
    
    if (task.frequency === 'daily') {
      const excludeInfo = task.excludeDays 
        ? `（${task.excludeDays.split(',').map((d: string) => DAY_NAMES[parseInt(d)]).join('、')}曜日除く）`
        : '';
      return `毎日 ${time}${excludeInfo}`;
    } else if (task.frequency === 'weekly' && task.dayOfWeek !== null) {
      return `毎週${DAY_NAMES[task.dayOfWeek]}曜日 ${time}`;
    } else if (task.frequency === 'monthly' && task.dayOfMonth !== null) {
      return `毎月${task.dayOfMonth}日 ${time}`;
    }
    return time;
  };

  const formatNextSend = (nextSendAt: string | null) => {
    if (!nextSendAt) return '-';
    const date = new Date(nextSendAt);
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  const handleEdit = (task: any) => {
    setEditingTask({
      ...task,
      hour: task.hour.toString(),
      minute: task.minute.toString(),
      dayOfWeek: task.dayOfWeek?.toString() || '',
      dayOfMonth: task.dayOfMonth?.toString() || '',
      excludeDays: task.excludeDays || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;

    try {
      await updateMutation.mutateAsync({
        id: editingTask.id,
        taskTitle: editingTask.taskTitle,
        frequency: editingTask.frequency,
        hour: parseInt(editingTask.hour),
        minute: parseInt(editingTask.minute),
        dayOfWeek: editingTask.frequency === 'weekly' ? parseInt(editingTask.dayOfWeek) : null,
        dayOfMonth: editingTask.frequency === 'monthly' ? parseInt(editingTask.dayOfMonth) : null,
        excludeDays: editingTask.frequency === 'daily' ? editingTask.excludeDays : null,
        assigneeMention: editingTask.assigneeMention,
      });
      toast.success('定期タスクを更新しました');
      setEditingTask(null);
      refetch();
    } catch (error) {
      toast.error('更新に失敗しました');
    }
  };

  const handleToggleActive = async (task: any) => {
    try {
      await updateMutation.mutateAsync({
        id: task.id,
        isActive: task.isActive === 1 ? 0 : 1,
      });
      toast.success(task.isActive === 1 ? '定期タスクを一時停止しました' : '定期タスクを再開しました');
      refetch();
    } catch (error) {
      toast.error('更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTask) return;

    try {
      await deleteMutation.mutateAsync({ id: deleteConfirmTask.id });
      toast.success('定期タスクを削除しました');
      setDeleteConfirmTask(null);
      refetch();
    } catch (error) {
      toast.error('削除に失敗しました');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Repeat className="h-6 w-6" />
              定期タスク
            </h1>
            <p className="text-muted-foreground mt-1">
              定期的に繰り返されるタスクのリマインダーを管理します
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>定期タスク一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                読み込み中...
              </div>
            ) : !tasks || tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>定期タスクはまだありません</p>
                <p className="text-sm mt-2">
                  Telegramで「【定期タスク】」と送信して作成してください
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タスク</TableHead>
                    <TableHead>スケジュール</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>次回送信</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task: any) => (
                    <TableRow key={task.id} className={task.isActive !== 1 ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{task.taskTitle}</TableCell>
                      <TableCell>{formatSchedule(task)}</TableCell>
                      <TableCell>{task.assigneeMention || '-'}</TableCell>
                      <TableCell>{formatNextSend(task.nextSendAt)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          task.isActive === 1 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {task.isActive === 1 ? '有効' : '停止中'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(task)}
                            title={task.isActive === 1 ? '一時停止' : '再開'}
                          >
                            {task.isActive === 1 ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmTask(task)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>定期タスクを編集</DialogTitle>
              <DialogDescription>
                タスクの内容やスケジュールを変更できます
              </DialogDescription>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>タスク内容</Label>
                  <Input
                    value={editingTask.taskTitle}
                    onChange={(e) => setEditingTask({ ...editingTask, taskTitle: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>頻度</Label>
                  <Select
                    value={editingTask.frequency}
                    onValueChange={(value) => setEditingTask({ ...editingTask, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">毎日</SelectItem>
                      <SelectItem value="weekly">毎週</SelectItem>
                      <SelectItem value="monthly">毎月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editingTask.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>曜日</Label>
                    <Select
                      value={editingTask.dayOfWeek}
                      onValueChange={(value) => setEditingTask({ ...editingTask, dayOfWeek: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((name, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {name}曜日
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingTask.frequency === 'monthly' && (
                  <div className="space-y-2">
                    <Label>日付</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={editingTask.dayOfMonth}
                      onChange={(e) => setEditingTask({ ...editingTask, dayOfMonth: e.target.value })}
                    />
                  </div>
                )}

                {editingTask.frequency === 'daily' && (
                  <div className="space-y-2">
                    <Label>配信しない曜日</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_NAMES.map((name, index) => {
                        const excludeDaysList = editingTask.excludeDays ? editingTask.excludeDays.split(',') : [];
                        const isExcluded = excludeDaysList.includes(index.toString());
                        return (
                          <Button
                            key={index}
                            type="button"
                            variant={isExcluded ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const newExcludeDays = isExcluded
                                ? excludeDaysList.filter((d: string) => d !== index.toString()).join(',')
                                : [...excludeDaysList, index.toString()].filter(Boolean).join(',');
                              setEditingTask({ ...editingTask, excludeDays: newExcludeDays });
                            }}
                          >
                            {name}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      選択した曜日はリマインダーが送信されません
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>時</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={editingTask.hour}
                      onChange={(e) => setEditingTask({ ...editingTask, hour: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>分</Label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={editingTask.minute}
                      onChange={(e) => setEditingTask({ ...editingTask, minute: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>担当者（@メンション）</Label>
                  <Input
                    value={editingTask.assigneeMention || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, assigneeMention: e.target.value })}
                    placeholder="@username"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmTask} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>定期タスクを削除</DialogTitle>
              <DialogDescription>
                この定期タスクを削除してもよろしいですか？この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>
            {deleteConfirmTask && (
              <div className="py-4">
                <p className="font-medium">{deleteConfirmTask.taskTitle}</p>
                <p className="text-sm text-muted-foreground">{formatSchedule(deleteConfirmTask)}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmTask(null)}>
                キャンセル
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? '削除中...' : '削除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
