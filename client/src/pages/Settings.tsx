import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Users, Bell, Sparkles, Plus, Trash2, Save, Eye, EyeOff, CheckCircle2, Calendar, Link2, Unlink, Languages, Image, Mic } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import WebhookManager from "@/components/WebhookManager";

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">設定</h2>
          <p className="text-muted-foreground">
            システムの全ての設定を管理できます。
          </p>
        </div>

        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              API設定
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              グループチャット
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              リマインダー
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI設定
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Google
            </TabsTrigger>
            <TabsTrigger value="translation" className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              翻訳
            </TabsTrigger>
            <TabsTrigger value="gemini" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              画像生成
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              音声
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api">
            <ApiSettings />
          </TabsContent>

          <TabsContent value="groups">
            <GroupChatSettings />
          </TabsContent>

          <TabsContent value="reminders">
            <ReminderSettings />
          </TabsContent>

          <TabsContent value="ai">
            <AIModelSettings />
          </TabsContent>

          <TabsContent value="google">
            <GoogleCalendarSettings />
          </TabsContent>

          <TabsContent value="translation">
            <TranslationSettings />
          </TabsContent>

          <TabsContent value="gemini">
            <GeminiSettings />
          </TabsContent>

          <TabsContent value="voice">
            <VoiceSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function ApiSettings() {
  const [telegramToken, setTelegramToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleCalendarJson, setGoogleCalendarJson] = useState("");
  const [adminUserIds, setAdminUserIds] = useState("");
  
  const [showTelegram, setShowTelegram] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);

  const { data: settings } = trpc.botSettings.getAll.useQuery();

  useEffect(() => {
    if (settings) {
      const telegramSetting = settings.find((s) => s.settingKey === "telegram_bot_token");
      const openaiSetting = settings.find((s) => s.settingKey === "openai_api_key");
      const googleSetting = settings.find((s) => s.settingKey === "google_calendar_credentials");
      const adminSetting = settings.find((s) => s.settingKey === "admin_user_ids");

      if (telegramSetting) setTelegramToken(telegramSetting.settingValue || "");
      if (openaiSetting) setOpenaiKey(openaiSetting.settingValue || "");
      if (googleSetting) setGoogleCalendarJson(googleSetting.settingValue || "");
      if (adminSetting) setAdminUserIds(adminSetting.settingValue || "");
    }
  }, [settings]);

  const upsertSetting = trpc.botSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("設定を保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const testTelegram = trpc.testConnections.telegram.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
  });

  const testOpenai = trpc.testConnections.openai.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
  });

  const testGoogleCalendar = trpc.testConnections.googleCalendar.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
  });

  const handleSave = async () => {
    const settingsToSave = [
      { key: "telegram_bot_token", value: telegramToken, description: "Telegram Bot Token" },
      { key: "openai_api_key", value: openaiKey, description: "OpenAI API Key" },
      { key: "google_calendar_credentials", value: googleCalendarJson, description: "Google Calendar認証情報（JSON）" },
      { key: "admin_user_ids", value: adminUserIds, description: "管理者ユーザーID（カンマ区切り）" },
    ];

    for (const setting of settingsToSave) {
      if (setting.value) {
        await upsertSetting.mutateAsync(setting);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          API設定
        </CardTitle>
        <CardDescription>
          Telegram Bot Token、OpenAI API Key、Google Calendar認証情報を設定します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="telegram-token">Telegram Bot Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="telegram-token"
                type={showTelegram ? "text" : "password"}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTelegram(!showTelegram)}
              >
                {showTelegram ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => testTelegram.mutate({ token: telegramToken })}
              disabled={!telegramToken || testTelegram.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              テスト
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            @BotFatherから取得したBot Tokenを入力してください。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="openai-key">OpenAI API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="openai-key"
                type={showOpenai ? "text" : "password"}
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowOpenai(!showOpenai)}
              >
                {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => testOpenai.mutate({ apiKey: openaiKey })}
              disabled={!openaiKey || testOpenai.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              テスト
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            OpenAIのAPI Keyを入力してください。AI下書き生成に使用されます。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="google-calendar">Google Calendar認証情報（JSON）</Label>
          <div className="space-y-2">
            <Textarea
              id="google-calendar"
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              rows={6}
              value={googleCalendarJson}
              onChange={(e) => setGoogleCalendarJson(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => testGoogleCalendar.mutate({ credentials: googleCalendarJson })}
              disabled={!googleCalendarJson || testGoogleCalendar.isPending}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              JSON形式をテスト
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Google Cloud Consoleから取得したサービスアカウントのJSON認証情報を貼り付けてください。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-users">管理者ユーザーID</Label>
          <Input
            id="admin-users"
            placeholder="123456789, 987654321"
            value={adminUserIds}
            onChange={(e) => setAdminUserIds(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            AI機能を使用できる管理者のTelegram User IDをカンマ区切りで入力してください。
          </p>
        </div>

        <Button onClick={handleSave} disabled={upsertSetting.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {upsertSetting.isPending ? "保存中..." : "設定を保存"}
        </Button>

        {/* Webhook Management Section */}
        <div className="border-t pt-6 mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Webhook URL管理</h3>
              <p className="text-sm text-muted-foreground">
                Telegram BOTがメッセージを受信するためのWebhook URLを管理します。
              </p>
            </div>
            <WebhookManager telegramToken={telegramToken} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupChatSettings() {
  const [groups, setGroups] = useState([
    { groupChatId: "", groupName: "", responsibleUserId: "", calendarId: "" },
  ]);

  const { data: groupChats } = trpc.groupChats.getAll.useQuery();

  useEffect(() => {
    if (groupChats && groupChats.length > 0) {
      setGroups(groupChats.map((g) => ({
        groupChatId: g.groupChatId,
        groupName: g.groupName || "",
        responsibleUserId: g.responsibleUserId || "",
        calendarId: g.calendarId || "",
      })));
    }
  }, [groupChats]);

  const upsertGroupChat = trpc.groupChats.upsert.useMutation({
    onSuccess: () => {
      toast.success("グループチャットを保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const addGroup = () => {
    setGroups([...groups, { groupChatId: "", groupName: "", responsibleUserId: "", calendarId: "" }]);
  };

  const removeGroup = async (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const updateGroup = (index: number, field: string, value: string) => {
    const newGroups = [...groups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setGroups(newGroups);
  };

  const handleSave = async (index: number) => {
    const group = groups[index];
    if (group.groupChatId && group.groupName) {
      await upsertGroupChat.mutateAsync(group);
    } else {
      toast.error("グループチャットIDとグループ名は必須です");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          グループチャット管理
        </CardTitle>
        <CardDescription>
          Telegram BOTが動作するグループチャットを管理します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group, index) => (
          <div key={index} className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">グループ #{index + 1}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeGroup(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>グループチャットID</Label>
                <Input
                  placeholder="-1001234567890"
                  value={group.groupChatId}
                  onChange={(e) => updateGroup(index, "groupChatId", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>グループ名</Label>
                <Input
                  placeholder="開発チーム"
                  value={group.groupName}
                  onChange={(e) => updateGroup(index, "groupName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>責任者ユーザーID</Label>
                <Input
                  placeholder="123456789"
                  value={group.responsibleUserId}
                  onChange={(e) => updateGroup(index, "responsibleUserId", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>カレンダーID</Label>
                <Input
                  placeholder="primary または xxx@group.calendar.google.com"
                  value={group.calendarId}
                  onChange={(e) => updateGroup(index, "calendarId", e.target.value)}
                />
              </div>
            </div>

            <Button onClick={() => handleSave(index)} size="sm" className="w-full">
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </div>
        ))}

        <Button onClick={addGroup} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          グループを追加
        </Button>
      </CardContent>
    </Card>
  );
}

function ReminderSettings() {
  const [task24h, setTask24h] = useState("true");
  const [task1h, setTask1h] = useState("true");
  const [taskOverdue, setTaskOverdue] = useState("6");
  const [meeting10min, setMeeting10min] = useState("true");
  const [unanswered72h, setUnanswered72h] = useState("true");

  const { data: settings } = trpc.reminderSettings.getAll.useQuery();

  useEffect(() => {
    if (settings) {
      const task24hSetting = settings.find((s) => s.settingKey === "task_24h_reminder");
      const task1hSetting = settings.find((s) => s.settingKey === "task_1h_reminder");
      const taskOverdueSetting = settings.find((s) => s.settingKey === "task_overdue_followup_hours");
      const meeting10minSetting = settings.find((s) => s.settingKey === "meeting_10min_reminder");
      const unanswered72hSetting = settings.find((s) => s.settingKey === "unanswered_72h_reminder");

      if (task24hSetting) setTask24h(task24hSetting.settingValue || "true");
      if (task1hSetting) setTask1h(task1hSetting.settingValue || "true");
      if (taskOverdueSetting) setTaskOverdue(taskOverdueSetting.settingValue || "6");
      if (meeting10minSetting) setMeeting10min(meeting10minSetting.settingValue || "true");
      if (unanswered72hSetting) setUnanswered72h(unanswered72hSetting.settingValue || "true");
    }
  }, [settings]);

  const upsertSetting = trpc.reminderSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("リマインダー設定を保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSave = async () => {
    const settingsToSave = [
      { key: "task_24h_reminder", value: task24h, description: "タスク24時間前リマインド" },
      { key: "task_1h_reminder", value: task1h, description: "タスク1時間前リマインド" },
      { key: "task_overdue_followup_hours", value: taskOverdue, description: "期限超過フォロー間隔" },
      { key: "meeting_10min_reminder", value: meeting10min, description: "ミーティング10分前リマインド" },
      { key: "unanswered_72h_reminder", value: unanswered72h, description: "未回答72時間リマインド" },
    ];

    for (const setting of settingsToSave) {
      await upsertSetting.mutateAsync(setting);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          リマインダー設定
        </CardTitle>
        <CardDescription>
          タスクとミーティングのリマインダー間隔を設定します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>タスク期限24時間前リマインド</Label>
              <p className="text-sm text-muted-foreground">期限の24時間前に通知します</p>
            </div>
            <select
              value={task24h}
              onChange={(e) => setTask24h(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>タスク期限1時間前リマインド</Label>
              <p className="text-sm text-muted-foreground">期限の1時間前に通知します</p>
            </div>
            <select
              value={task1h}
              onChange={(e) => setTask1h(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>タスク期限超過フォロー間隔（時間）</Label>
            <Input
              type="number"
              value={taskOverdue}
              onChange={(e) => setTaskOverdue(e.target.value)}
              min="1"
              max="24"
            />
            <p className="text-sm text-muted-foreground">
              期限超過後、指定した時間ごとにフォローアップ通知を送信します
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>ミーティング10分前リマインド</Label>
              <p className="text-sm text-muted-foreground">開始の10分前に通知します</p>
            </div>
            <select
              value={meeting10min}
              onChange={(e) => setMeeting10min(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>未回答質問72時間リマインド</Label>
              <p className="text-sm text-muted-foreground">未回答の質問を72時間後に通知します</p>
            </div>
            <select
              value={unanswered72h}
              onChange={(e) => setUnanswered72h(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={upsertSetting.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {upsertSetting.isPending ? "保存中..." : "設定を保存"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AIModelSettings() {
  const [apiProvider, setApiProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("2000");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [perplexityApiKey, setPerplexityApiKey] = useState("");
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Manila");

  const { data: settings } = trpc.botSettings.getAll.useQuery();

  useEffect(() => {
    if (settings) {
      const providerSetting = settings.find((s) => s.settingKey === "ai_provider");
      const modelSetting = settings.find((s) => s.settingKey === "ai_model");
      const tempSetting = settings.find((s) => s.settingKey === "ai_temperature");
      const tokensSetting = settings.find((s) => s.settingKey === "ai_max_tokens");
      const promptSetting = settings.find((s) => s.settingKey === "ai_system_prompt");
      const claudeKeySetting = settings.find((s) => s.settingKey === "claude_api_key");
      const perplexityKeySetting = settings.find((s) => s.settingKey === "perplexity_api_key");
      const webSearchSetting = settings.find((s) => s.settingKey === "enable_web_search");

      if (providerSetting) setApiProvider(providerSetting.settingValue || "openai");
      if (modelSetting) setModel(modelSetting.settingValue || "gpt-4");
      if (tempSetting) setTemperature(tempSetting.settingValue || "0.7");
      if (tokensSetting) setMaxTokens(tokensSetting.settingValue || "2000");
      if (promptSetting) setSystemPrompt(promptSetting.settingValue || "");
      if (claudeKeySetting) setClaudeApiKey(claudeKeySetting.settingValue || "");
      if (perplexityKeySetting) setPerplexityApiKey(perplexityKeySetting.settingValue || "");
      if (webSearchSetting) setEnableWebSearch(webSearchSetting.settingValue === "true");
      
      const timezoneSetting = settings.find((s) => s.settingKey === "timezone");
      if (timezoneSetting) setTimezone(timezoneSetting.settingValue || "Asia/Manila");
    }
  }, [settings]);

  const upsertSetting = trpc.botSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("AIモデル設定を保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSave = async () => {
    const settingsToSave = [
      { key: "ai_provider", value: apiProvider, description: "APIプロバイダー" },
      { key: "ai_model", value: model, description: "AIモデル名" },
      { key: "ai_temperature", value: temperature, description: "Temperature" },
      { key: "ai_max_tokens", value: maxTokens, description: "Max Tokens" },
      { key: "ai_system_prompt", value: systemPrompt, description: "システムプロンプト" },
      { key: "claude_api_key", value: claudeApiKey, description: "Claude API Key" },
      { key: "perplexity_api_key", value: perplexityApiKey, description: "Perplexity API Key" },
      { key: "enable_web_search", value: enableWebSearch ? "true" : "false", description: "Web検索を有効化" },
      { key: "timezone", value: timezone, description: "タイムゾーン" },
    ];

    for (const setting of settingsToSave) {
      if (setting.value) {
        await upsertSetting.mutateAsync(setting);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AIモデル設定
        </CardTitle>
        <CardDescription>
          AI下書き生成に使用するモデルのパラメータを設定します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="api-provider">APIプロバイダー</Label>
          <select
            id="api-provider"
            value={apiProvider}
            onChange={(e) => {
              const newProvider = e.target.value;
              setApiProvider(newProvider);
              // APIプロバイダー変更時にモデル名を自動的にデフォルト値に更新
              if (newProvider === "openai") {
                setModel("gpt-4o");
              } else if (newProvider === "claude") {
                setModel("claude-sonnet-4-5-20250929");
              }
            }}
            className="w-full border rounded px-3 py-2"
          >
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
          </select>
          <p className="text-sm text-muted-foreground">
            使用するAI APIプロバイダーを選択してください。
          </p>
        </div>

        {apiProvider === "claude" && (
          <div className="space-y-2">
            <Label htmlFor="claude-api-key">Claude API Key</Label>
            <div className="relative">
              <Input
                id="claude-api-key"
                type={showClaudeKey ? "text" : "password"}
                placeholder="sk-ant-..."
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowClaudeKey(!showClaudeKey)}
              >
                {showClaudeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AnthropicのClaude API Keyを入力してください。
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="model">モデル名</Label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {apiProvider === "openai" ? (
              <>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-4">GPT-4</option>
              </>
            ) : (
              <>
                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (最新)</option>
                <option value="claude-3-7-sonnet-20250219">Claude Sonnet 3.7</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="claude-3-haiku-20240307">Claude Haiku 3</option>
              </>
            )}
          </select>
          <p className="text-sm text-muted-foreground">
            使用する{apiProvider === "openai" ? "OpenAI" : "Claude"}モデルを選択してください。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            0.0〜2.0の範囲で設定。低いほど決定論的、高いほど創造的な出力になります。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-tokens">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            step="100"
            min="100"
            max="4000"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            生成される応答の最大トークン数を設定します。
          </p>
        </div>

        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-web-search" className="text-base font-medium">Web検索を有効化</Label>
              <p className="text-sm text-muted-foreground">
                AIが回答する前に、Web検索で最新の情報を取得します。（無料・APIキー不要）
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="enable-web-search"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">タイムゾーン</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="Asia/Manila">フィリピン (UTC+8)</option>
            <option value="Asia/Tokyo">日本 (UTC+9)</option>
            <option value="Asia/Singapore">シンガポール (UTC+8)</option>
            <option value="Asia/Hong_Kong">香港 (UTC+8)</option>
            <option value="Asia/Bangkok">タイ (UTC+7)</option>
            <option value="Asia/Jakarta">インドネシア (UTC+7)</option>
            <option value="America/New_York">ニューヨーク (UTC-5)</option>
            <option value="America/Los_Angeles">ロサンゼルス (UTC-8)</option>
            <option value="Europe/London">ロンドン (UTC+0)</option>
            <option value="Europe/Paris">パリ (UTC+1)</option>
          </select>
          <p className="text-sm text-muted-foreground">
            リマインダーや時刻表示に使用するタイムゾーンを選択してください。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="system-prompt">システムプロンプト</Label>
          <Textarea
            id="system-prompt"
            placeholder="あなたは親切で丁寧なアシスタントです。"
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            AIの振る舞いを定義するシステムプロンプトを設定します。
          </p>
        </div>

        <Button onClick={handleSave} disabled={upsertSetting.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {upsertSetting.isPending ? "保存中..." : "設定を保存"}
        </Button>
      </CardContent>
    </Card>
  );
}


function GoogleCalendarSettings() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showClientSecret, setShowClientSecret] = useState(false);

  const { data: credentials, refetch } = trpc.google.getCredentials.useQuery();
  const { data: authUrlData } = trpc.google.getAuthUrl.useQuery(undefined, {
    enabled: !!credentials?.hasClientId && !!credentials?.hasClientSecret && !credentials?.isConnected,
  });

  const saveCredentials = trpc.google.saveCredentials.useMutation({
    onSuccess: () => {
      toast.success("Google認証情報を保存しました");
      refetch();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const disconnect = trpc.google.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Googleアカウントの連携を解除しました");
      refetch();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSaveCredentials = async () => {
    if (!clientId || !clientSecret) {
      toast.error("Client IDとClient Secretを入力してください");
      return;
    }
    await saveCredentials.mutateAsync({ clientId, clientSecret });
  };

  const handleConnect = () => {
    if (authUrlData?.success && authUrlData.authUrl) {
      window.location.href = authUrlData.authUrl;
    } else {
      toast.error(authUrlData?.message || "認証URLを取得できませんでした");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar連携
        </CardTitle>
        <CardDescription>
          Google Calendarと連携して、ミーティング作成時にGoogle Meetリンクを自動生成します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {credentials?.isConnected ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Googleアカウント連携済み</span>
              </div>
              {credentials.connectedEmail && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {credentials.connectedEmail}
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="w-full"
            >
              <Unlink className="h-4 w-4 mr-2" />
              {disconnect.isPending ? "解除中..." : "連携を解除"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-2">設定手順</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a>にアクセス</li>
                <li>新しいプロジェクトを作成（または既存を選択）</li>
                <li>「APIとサービス」→「ライブラリ」で「Google Calendar API」を有効化</li>
                <li>「認証情報」→「OAuthクライアントID」を作成</li>
                <li>アプリケーションの種類：「ウェブアプリケーション」</li>
                <li>承認済みリダイレクトURIに以下を追加：<br/>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{window.location.origin}/api/oauth/google/callback</code>
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-client-id">Client ID</Label>
              <Input
                id="google-client-id"
                type="text"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google-client-secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="google-client-secret"
                  type={showClientSecret ? "text" : "password"}
                  placeholder="GOCSPX-xxxxx"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                >
                  {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleSaveCredentials}
              disabled={saveCredentials.isPending || !clientId || !clientSecret}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveCredentials.isPending ? "保存中..." : "認証情報を保存"}
            </Button>

            {credentials?.hasClientId && credentials?.hasClientSecret && (
              <Button
                onClick={handleConnect}
                variant="outline"
                className="w-full"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Googleアカウントを連携
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function TranslationSettings() {
  const [startKeywords, setStartKeywords] = useState("翻訳開始,翻訳スタート,通訳開始,通訳スタート");
  const [endKeywords, setEndKeywords] = useState("翻訳終了,翻訳ストップ,翻訳停止,通訳終了,通訳ストップ,通訳停止");
  const [autoTranslateOnMention, setAutoTranslateOnMention] = useState(true);

  const { data: settings, refetch } = trpc.translation.getSettings.useQuery();
  const { data: sessions } = trpc.translation.getSessions.useQuery();

  useEffect(() => {
    if (settings) {
      setStartKeywords(settings.startKeywords);
      setEndKeywords(settings.endKeywords);
      setAutoTranslateOnMention(settings.autoTranslateOnMention);
    }
  }, [settings]);

  const saveSettings = trpc.translation.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("翻訳設定を保存しました");
      refetch();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSave = async () => {
    await saveSettings.mutateAsync({
      startKeywords,
      endKeywords,
      autoTranslateOnMention,
    });
  };

  const languageNames: Record<string, string> = {
    'ja': '日本語',
    'en': '英語',
    'zh': '中国語',
    'ko': '韓国語',
    'tl': 'タガログ語',
    'tgl-en': 'タグリッシュ'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          翻訳設定
        </CardTitle>
        <CardDescription>
          Telegramでの双方向翻訳機能を設定します。日本語⇔英語/中国語/韓国語/タガログ語/タグリッシュに対応。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium mb-2">使い方</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Telegramで「翻訳開始」と入力すると翻訳モードが開始</li>
            <li>相手の言語を選択（英語、中国語、韓国語、タガログ語、タグリッシュ）</li>
            <li>あなたの日本語は相手の言語に、相手の言語は日本語に自動翻訳</li>
            <li>「翻訳終了」と入力すると翻訳モードが終了</li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start-keywords">翻訳開始キーワード</Label>
          <Input
            id="start-keywords"
            placeholder="翻訳開始,翻訳スタート,通訳開始"
            value={startKeywords}
            onChange={(e) => setStartKeywords(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            カンマ区切りで複数のキーワードを設定できます。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-keywords">翻訳終了キーワード</Label>
          <Input
            id="end-keywords"
            placeholder="翻訳終了,翻訳ストップ,通訳終了"
            value={endKeywords}
            onChange={(e) => setEndKeywords(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            カンマ区切りで複数のキーワードを設定できます。
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>@メンション時の自動翻訳</Label>
            <p className="text-sm text-muted-foreground">
              日本語以外で@メンションされた時に自動で翻訳します。
            </p>
          </div>
          <select
            value={autoTranslateOnMention ? "true" : "false"}
            onChange={(e) => setAutoTranslateOnMention(e.target.value === "true")}
            className="border rounded px-3 py-2"
          >
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </div>

        <Button onClick={handleSave} disabled={saveSettings.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saveSettings.isPending ? "保存中..." : "設定を保存"}
        </Button>

        {sessions && sessions.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium">アクティブな翻訳セッション</h4>
            <div className="space-y-2">
              {sessions.map((session: any) => (
                <div key={session.id} className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      チャットID: {session.chatId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {languageNames[session.myLanguage] || session.myLanguage} ⇔ {languageNames[session.targetLanguage] || session.targetLanguage}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${session.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {session.isActive ? 'アクティブ' : '終了'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function GeminiSettings() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-image");
  const [enableImageGeneration, setEnableImageGeneration] = useState(false);

  const { data: settings } = trpc.botSettings.getAll.useQuery();

  useEffect(() => {
    if (settings) {
      const geminiKeySetting = settings.find((s) => s.settingKey === "gemini_api_key");
      const geminiModelSetting = settings.find((s) => s.settingKey === "gemini_model");
      const enableSetting = settings.find((s) => s.settingKey === "enable_image_generation");

      if (geminiKeySetting) setGeminiApiKey(geminiKeySetting.settingValue || "");
      if (geminiModelSetting) setGeminiModel(geminiModelSetting.settingValue || "gemini-2.5-flash-image");
      if (enableSetting) setEnableImageGeneration(enableSetting.settingValue === "true");
    }
  }, [settings]);

  const upsertSetting = trpc.botSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Gemini設定を保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const testGemini = trpc.testConnections.gemini.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("テストエラー: " + error.message);
    },
  });

  const handleSave = async () => {
    const settingsToSave = [
      { key: "gemini_api_key", value: geminiApiKey, description: "Gemini API Key" },
      { key: "gemini_model", value: geminiModel, description: "Gemini Model" },
      { key: "enable_image_generation", value: enableImageGeneration ? "true" : "false", description: "画像生成を有効化" },
    ];

    for (const setting of settingsToSave) {
      await upsertSetting.mutateAsync(setting);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          Gemini画像生成設定
        </CardTitle>
        <CardDescription>
          Google Gemini APIを使用してTelegramで画像を生成します。「【画像生成】」コマンドで使用できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium mb-2">使い方</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>でAPI Keyを取得</li>
            <li>下記にAPI Keyを入力して保存</li>
            <li>Telegramで「【画像生成】猫が宇宙を飛んでいる絵」のように入力</li>
            <li>Geminiが画像を生成してTelegramに送信します</li>
          </ol>
        </div>

        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-image-generation" className="text-base font-medium">画像生成を有効化</Label>
              <p className="text-sm text-muted-foreground">
                Telegramで「【画像生成】」コマンドを使用可能にします。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="enable-image-generation"
                checked={enableImageGeneration}
                onChange={(e) => setEnableImageGeneration(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gemini-api-key">Gemini API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gemini-api-key"
                type={showGeminiKey ? "text" : "password"}
                placeholder="AIza..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => testGemini.mutate({ apiKey: geminiApiKey })}
              disabled={!geminiApiKey || testGemini.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              テスト
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Google AI StudioからGemini API Keyを取得して入力してください。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gemini-model">モデル</Label>
          <select
            id="gemini-model"
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="gemini-2.5-flash-image">Nano Banana (gemini-2.5-flash-image) - 高速</option>
            <option value="gemini-3-pro-image-preview">Nano Banana Pro (gemini-3-pro-image-preview) - 高品質</option>
          </select>
          <p className="text-sm text-muted-foreground">
            Nano Banana: 高速・効率的。Nano Banana Pro: 高解像度・高品質（4Kまで対応）。
          </p>
        </div>

        <Button onClick={handleSave} disabled={upsertSetting.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {upsertSetting.isPending ? "保存中..." : "設定を保存"}
        </Button>
      </CardContent>
    </Card>
  );
}


// ============================================
// Voice Settings Component
// ============================================

const GEMINI_TTS_VOICES = [
  { name: 'Zephyr', description: 'Bright（明るい）' },
  { name: 'Puck', description: 'Upbeat（陽気）' },
  { name: 'Charon', description: 'Informative（情報的）' },
  { name: 'Kore', description: 'Firm（しっかり）' },
  { name: 'Fenrir', description: 'Excitable（興奮）' },
  { name: 'Leda', description: 'Youthful（若々しい）' },
  { name: 'Orus', description: 'Firm（しっかり）' },
  { name: 'Aoede', description: 'Breezy（爽やか）' },
  { name: 'Callirrhoe', description: 'Easy-going（のんびり）' },
  { name: 'Autonoe', description: 'Bright（明るい）' },
  { name: 'Enceladus', description: 'Breathy（息づかい）' },
  { name: 'Iapetus', description: 'Clear（クリア）' },
  { name: 'Umbriel', description: 'Easy-going（のんびり）' },
  { name: 'Algieba', description: 'Smooth（滑らか）' },
  { name: 'Despina', description: 'Smooth（滑らか）' },
  { name: 'Erinome', description: 'Clear（クリア）' },
  { name: 'Algenib', description: 'Gravelly（しわがれ）' },
  { name: 'Rasalgethi', description: 'Informative（情報的）' },
  { name: 'Laomedeia', description: 'Upbeat（陽気）' },
  { name: 'Achernar', description: 'Soft（柔らか）' },
  { name: 'Alnilam', description: 'Firm（しっかり）' },
  { name: 'Schedar', description: 'Even（均一）' },
  { name: 'Gacrux', description: 'Mature（成熟）' },
  { name: 'Pulcherrima', description: 'Forward（前向き）' },
  { name: 'Achird', description: 'Friendly（フレンドリー）' },
  { name: 'Zubenelgenubi', description: 'Casual（カジュアル）' },
  { name: 'Vindemiatrix', description: 'Gentle（優しい）' },
  { name: 'Sadachbia', description: 'Lively（活発）' },
  { name: 'Sadaltager', description: 'Knowledgeable（博識）' },
  { name: 'Sulafat', description: 'Warm（温かい）' },
];

function VoiceSettings() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceName, setVoiceName] = useState("Kore");
  const [voiceResponseMode, setVoiceResponseMode] = useState("voice_only");

  const { data: settings } = trpc.botSettings.getAll.useQuery();
  const { data: geminiSettings } = trpc.botSettings.getAll.useQuery();

  useEffect(() => {
    if (settings) {
      const voiceEnabledSetting = settings.find((s) => s.settingKey === "voice_enabled");
      const voiceNameSetting = settings.find((s) => s.settingKey === "voice_name");
      const voiceResponseModeSetting = settings.find((s) => s.settingKey === "voice_response_mode");

      if (voiceEnabledSetting) setVoiceEnabled(voiceEnabledSetting.settingValue === "true");
      if (voiceNameSetting) setVoiceName(voiceNameSetting.settingValue || "Kore");
      if (voiceResponseModeSetting) setVoiceResponseMode(voiceResponseModeSetting.settingValue || "voice_only");
    }
  }, [settings]);

  // Check if Gemini API key is configured
  const geminiApiKey = geminiSettings?.find((s) => s.settingKey === "gemini_api_key")?.settingValue;
  const isGeminiConfigured = !!geminiApiKey;

  const upsertSetting = trpc.botSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("音声設定を保存しました");
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const handleSave = async () => {
    const settingsToSave = [
      { key: "voice_enabled", value: voiceEnabled ? "true" : "false", description: "音声機能を有効化" },
      { key: "voice_name", value: voiceName, description: "音声の種類" },
      { key: "voice_response_mode", value: voiceResponseMode, description: "返答モード" },
    ];

    for (const setting of settingsToSave) {
      await upsertSetting.mutateAsync(setting);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          音声メッセージ設定
        </CardTitle>
        <CardDescription>
          Telegramで音声メッセージを送信すると、AIが内容を理解して音声で返答します。Gemini APIを使用します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isGeminiConfigured && (
          <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
            <h4 className="font-medium text-yellow-600 mb-2">⚠️ Gemini API Keyが必要です</h4>
            <p className="text-sm text-muted-foreground">
              音声機能を使用するには、「画像生成」タブでGemini API Keyを設定してください。
            </p>
          </div>
        )}

        <div className="p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium mb-2">使い方</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>「画像生成」タブでGemini API Keyを設定</li>
            <li>下記で音声機能を有効化</li>
            <li>Telegramで音声メッセージを送信</li>
            <li>AIが内容を理解して、設定した音声で返答します</li>
          </ol>
        </div>

        <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="voice-enabled" className="text-base font-medium">音声機能を有効化</Label>
              <p className="text-sm text-muted-foreground">
                Telegramで音声メッセージを受け付けて、音声で返答します。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="voice-enabled"
                checked={voiceEnabled}
                onChange={(e) => setVoiceEnabled(e.target.checked)}
                disabled={!isGeminiConfigured}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-name">音声の種類</Label>
          <select
            id="voice-name"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            disabled={!isGeminiConfigured}
          >
            {GEMINI_TTS_VOICES.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} - {voice.description}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            返答に使用する音声を選択してください。30種類の音声から選べます。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-response-mode">返答モード</Label>
          <select
            id="voice-response-mode"
            value={voiceResponseMode}
            onChange={(e) => setVoiceResponseMode(e.target.value)}
            className="w-full border rounded px-3 py-2"
            disabled={!isGeminiConfigured}
          >
            <option value="voice_only">音声のみ</option>
            <option value="text_only">テキストのみ</option>
            <option value="both">音声 + テキスト両方</option>
          </select>
          <p className="text-sm text-muted-foreground">
            AIの返答を音声、テキスト、または両方で送信するかを選択します。
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={upsertSetting.isPending || !isGeminiConfigured} 
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {upsertSetting.isPending ? "保存中..." : "設定を保存"}
        </Button>
      </CardContent>
    </Card>
  );
}
