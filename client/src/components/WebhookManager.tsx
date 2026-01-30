import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, Unlink, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface WebhookManagerProps {
  telegramToken: string;
}

export default function WebhookManager({ telegramToken }: WebhookManagerProps) {
  const [webhookUrl, setWebhookUrl] = useState("");

  // 現在のWebhook状態を取得
  const { data: webhookInfo, refetch: refetchWebhookInfo } = trpc.webhook.getInfo.useQuery(
    { token: telegramToken },
    { enabled: !!telegramToken }
  );

  // Webhook URL登録
  const setWebhook = trpc.webhook.setWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchWebhookInfo();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // Webhook URL削除
  const deleteWebhook = trpc.webhook.deleteWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchWebhookInfo();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // 現在のドメインから自動的にWebhook URLを生成
  useEffect(() => {
    const currentUrl = window.location.origin;
    setWebhookUrl(`${currentUrl}/api/telegram/webhook`);
  }, []);

  const handleSetWebhook = () => {
    if (!telegramToken) {
      toast.error("Telegram Bot Tokenを先に設定してください");
      return;
    }
    setWebhook.mutate({ token: telegramToken, webhookUrl });
  };

  const handleDeleteWebhook = () => {
    if (!telegramToken) {
      toast.error("Telegram Bot Tokenを先に設定してください");
      return;
    }
    deleteWebhook.mutate({ token: telegramToken });
  };

  if (!telegramToken) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Webhook URLを管理するには、まずTelegram Bot Tokenを設定してください。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* 現在のWebhook状態 */}
        {webhookInfo && webhookInfo.success !== false && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">現在の状態:</span>
              {webhookInfo.url ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">登録済み</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">未登録</span>
                </div>
              )}
            </div>

            {webhookInfo.url && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">登録されているURL:</p>
                <p className="text-sm font-mono break-all">{webhookInfo.url}</p>
              </div>
            )}

            {webhookInfo.pendingUpdateCount !== undefined && webhookInfo.pendingUpdateCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  保留中の更新: {webhookInfo.pendingUpdateCount}件
                </AlertDescription>
              </Alert>
            )}

            {webhookInfo.lastErrorMessage && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  最後のエラー: {webhookInfo.lastErrorMessage}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 自動生成されたWebhook URL */}
        <div className="space-y-2">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
            <p className="text-xs text-muted-foreground mb-1">このアプリのWebhook URL:</p>
            <p className="text-sm font-mono break-all text-primary">{webhookUrl}</p>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2">
          <Button
            onClick={handleSetWebhook}
            disabled={setWebhook.isPending || !telegramToken}
            className="flex-1"
          >
            <Link2 className="h-4 w-4 mr-2" />
            {setWebhook.isPending ? "登録中..." : "Webhook URLを登録"}
          </Button>

          <Button
            variant="outline"
            onClick={() => refetchWebhookInfo()}
            disabled={!telegramToken}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {webhookInfo?.url && (
            <Button
              variant="destructive"
              onClick={handleDeleteWebhook}
              disabled={deleteWebhook.isPending || !telegramToken}
            >
              <Unlink className="h-4 w-4 mr-2" />
              {deleteWebhook.isPending ? "削除中..." : "削除"}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          💡 ヒント: 「Webhook URLを登録」ボタンをクリックするだけで、自動的にTelegram APIに登録されます。手動でURLを入力する必要はありません。
        </p>
      </CardContent>
    </Card>
  );
}
