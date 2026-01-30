import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Plus, Trash2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const TRIGGER_FLOWS = {
  task: {
    title: "タスク管理",
    description: "タスクを作成し、担当者に期限設定ボタンを送信。期限リマインダーと進捗管理を自動化します。",
    flow: [
      "1. トリガーキーワードを検知",
      "2. タスクタイトルと担当者を抽出",
      "3. 担当者に期限選択ボタンを送信",
      "4. 期限確定後、グループチャットに確認メッセージ",
      "5. 24時間前・1時間前にリマインド",
      "6. 期限超過後、段階的にエスカレーション",
    ],
  },
  meeting: {
    title: "ミーティング管理",
    description: "ミーティングを作成し、Google Calendarに登録。Meet リンク生成と10分前リマインドを自動化します。",
    flow: [
      "1. トリガーキーワードを検知",
      "2. 日時・参加者・議題を抽出",
      "3. 不足情報を確認",
      "4. オンライン会議形式を選択（Google Meet/対面/その他）",
      "5. Google Calendarにイベント作成",
      "6. Meet リンク生成（Google Meetの場合）",
      "7. グループチャットに確認メッセージ",
      "8. 開始10分前にリマインド",
    ],
  },
  ai_draft: {
    title: "AI下書き生成",
    description: "直近50件のチャット履歴からAIが下書きを生成。管理者DMに送信し、投稿・編集・破棄を選択できます。",
    flow: [
      "1. トリガーキーワードを検知",
      "2. 管理者権限をチェック",
      "3. 直近50件のチャット履歴を収集",
      "4. OpenAI APIで下書き生成",
      "5. 管理者DMに下書きと操作ボタンを送信",
      "6. 投稿ボタン: グループチャットに即座に投稿",
      "7. 編集ボタン: 現在の内容を表示し編集可能に",
      "8. 破棄ボタン: 下書きを削除",
    ],
  },
  reply_generation: {
    title: "返答生成",
    description: "未回答の質問を抽出し、AIが返答下書きを生成。管理者承認後にグループチャットに投稿します。",
    flow: [
      "1. トリガーキーワードを検知",
      "2. 管理者権限をチェック",
      "3. 未回答質問を抽出（疑問符を含むメッセージ）",
      "4. 質問を選択",
      "5. OpenAI APIで返答下書き生成",
      "6. 管理者DMに下書きと操作ボタンを送信",
      "7. 投稿・編集・破棄の操作（AI下書きと同様）",
    ],
  },
  custom: {
    title: "カスタムトリガー",
    description: "独自のトリガーを作成し、カスタム動作を設定できます。",
    flow: ["1. トリガーキーワードを検知", "2. カスタム処理を実行"],
  },
};

export default function TriggerSettings() {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTrigger, setNewTrigger] = useState({
    triggerKeyword: "",
    triggerType: "custom" as const,
    description: "",
  });

  // トリガー一覧取得
  const { data: triggersData, refetch } = trpc.triggers.list.useQuery();

  useEffect(() => {
    if (triggersData) {
      setTriggers(triggersData);
    }
  }, [triggersData]);

  // トリガー更新
  const updateTrigger = trpc.triggers.update.useMutation({
    onSuccess: () => {
      toast.success("トリガーを更新しました");
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // トリガー削除
  const deleteTrigger = trpc.triggers.delete.useMutation({
    onSuccess: () => {
      toast.success("トリガーを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // トリガー追加
  const createTrigger = trpc.triggers.create.useMutation({
    onSuccess: () => {
      toast.success("トリガーを追加しました");
      refetch();
      setIsAddDialogOpen(false);
      setNewTrigger({ triggerKeyword: "", triggerType: "custom", description: "" });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSaveKeyword = (id: number) => {
    updateTrigger.mutate({ id, triggerKeyword: editKeyword });
  };

  const handleToggleEnabled = (id: number, currentEnabled: number) => {
    updateTrigger.mutate({ id, enabled: currentEnabled === 1 ? 0 : 1 });
  };

  const handleAddTrigger = () => {
    if (!newTrigger.triggerKeyword) {
      toast.error("トリガーキーワードを入力してください");
      return;
    }
    createTrigger.mutate(newTrigger);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">トリガー管理</h3>
          <p className="text-sm text-muted-foreground">
            BOTのトリガーキーワードと動作フローを管理します。
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新しいトリガーを追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいトリガーを追加</DialogTitle>
              <DialogDescription>
                カスタムトリガーを作成します。トリガーキーワードと説明を入力してください。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="keyword">トリガーキーワード</Label>
                <Input
                  id="keyword"
                  placeholder="例: 【カスタム】"
                  value={newTrigger.triggerKeyword}
                  onChange={(e) => setNewTrigger({ ...newTrigger, triggerKeyword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">トリガータイプ</Label>
                <Select
                  value={newTrigger.triggerType}
                  onValueChange={(value: any) => setNewTrigger({ ...newTrigger, triggerType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">カスタム</SelectItem>
                    <SelectItem value="task">タスク管理</SelectItem>
                    <SelectItem value="meeting">ミーティング管理</SelectItem>
                    <SelectItem value="ai_draft">AI下書き生成</SelectItem>
                    <SelectItem value="reply_generation">返答生成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  placeholder="このトリガーの動作を説明してください"
                  value={newTrigger.description || ""}
                  onChange={(e) => setNewTrigger({ ...newTrigger, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddTrigger}>追加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {triggers.map((trigger) => {
          const flowInfo = TRIGGER_FLOWS[trigger.triggerType as keyof typeof TRIGGER_FLOWS];
          const isEditing = editingId === trigger.id;

          return (
            <Card key={trigger.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {flowInfo?.title || trigger.triggerType}
                    </CardTitle>
                    <CardDescription>{flowInfo?.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={trigger.enabled === 1}
                      onCheckedChange={() => handleToggleEnabled(trigger.id, trigger.enabled)}
                    />
                    <Badge variant={trigger.enabled === 1 ? "default" : "secondary"}>
                      {trigger.enabled === 1 ? "有効" : "無効"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* トリガーキーワード */}
                <div className="space-y-2">
                  <Label>トリガーキーワード</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={editKeyword}
                        onChange={(e) => setEditKeyword(e.target.value)}
                        placeholder="例: 【タスク】"
                      />
                      <Button onClick={() => handleSaveKeyword(trigger.id)} size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                      <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                        キャンセル
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded-md text-sm font-mono flex-1">
                        {trigger.triggerKeyword}
                      </code>
                      <Button
                        onClick={() => {
                          setEditingId(trigger.id);
                          setEditKeyword(trigger.triggerKeyword);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        編集
                      </Button>
                    </div>
                  )}
                </div>

                {/* 動作フロー */}
                <div className="space-y-2">
                  <Label>動作フロー</Label>
                  <div className="p-4 bg-muted/50 rounded-md space-y-2">
                    {flowInfo?.flow.map((step, index) => (
                      <div key={index} className="text-sm">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 削除ボタン（カスタムトリガーのみ） */}
                {trigger.triggerType === "custom" && (
                  <Button
                    onClick={() => deleteTrigger.mutate({ id: trigger.id })}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    削除
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
