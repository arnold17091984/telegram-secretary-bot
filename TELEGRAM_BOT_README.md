# Telegram Secretary Bot - セットアップガイド

## 概要

このシステムは、Telegramグループチャット用の秘書BOTと管理画面を統合したシステムです。タスク管理、ミーティング管理、AI下書き生成などの機能を提供します。

## 主な機能

### 1. タスク管理
- **【タスク】**トリガーでタスク作成
- 担当者への期限設定ボタン送信
- タスク状態管理（pending_acceptance、in_progress、blocked、completed）
- 自動リマインダー（24時間前、1時間前）
- 期限超過フォロー

### 2. ミーティング管理
- **【ミーティング】**トリガーでミーティング作成
- Google Calendar連携
- Google Meetリンク自動生成
- 10分前リマインダー

### 3. AI下書き生成
- **【AI】**トリガーでAI下書き生成
- 直近50件のチャット履歴を収集
- OpenAI APIで適切な返答を生成
- 管理者DMに下書き送信（投稿・編集・破棄ボタン付き）

### 4. 返答生成
- **【返答】**トリガーで未回答質問を抽出
- 質問選択フロー
- AI返答下書き生成

## セットアップ手順

### 1. 管理画面にアクセス

デプロイ後、管理画面にアクセスして以下の設定を行います。

### 2. Telegram Bot設定

1. **Settings** → **API Settings** → **Telegram Bot Configuration**
2. Telegram Bot Tokenを入力
   - [@BotFather](https://t.me/botfather)で新しいBOTを作成
   - `/newbot`コマンドでBOTを作成
   - 取得したTokenを入力

3. Webhookを設定
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
   ```

### 3. Google Calendar設定

1. **Settings** → **API Settings** → **Google Calendar API**
2. Google Cloud Consoleでサービスアカウントを作成
   - [Google Cloud Console](https://console.cloud.google.com/)にアクセス
   - プロジェクトを作成
   - Google Calendar APIを有効化
   - サービスアカウントを作成
   - JSONキーをダウンロード
3. ダウンロードしたJSONファイルをアップロード

### 4. OpenAI API設定

1. **Settings** → **API Settings** → **OpenAI API**
2. OpenAI API Keyを入力
   - [OpenAI Platform](https://platform.openai.com/)でAPIキーを取得
   - 取得したKeyを入力

### 5. グループチャット登録

1. **Settings** → **Group Chats**
2. **Add Group**をクリック
3. 以下の情報を入力：
   - **Group Chat ID**: TelegramグループのID（`-1001234567890`形式）
   - **Group Name**: グループ名
   - **Responsible User ID**: 責任者のTelegram User ID
   - **Calendar ID**: Google CalendarのID（例：`primary`または特定のカレンダーID）

#### Group Chat IDの取得方法

1. BOTをグループに追加
2. グループで任意のメッセージを送信
3. 以下のURLにアクセス：
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. レスポンスから`chat.id`を確認

### 6. リマインダー設定

1. **Settings** → **Reminders**
2. 以下の設定を有効化：
   - Task Reminder (24 hours before)
   - Task Reminder (1 hour before)
   - Meeting Reminder (10 minutes before)

### 7. AIモデル設定

1. **Settings** → **AI Settings**
2. 以下のパラメータを設定：
   - **Model**: `gpt-4.1-mini`（推奨）
   - **Temperature**: `0.7`（0.0-2.0）
   - **Max Tokens**: `500`

## 使用方法

### タスク作成

Telegramグループで以下のようにメッセージを送信：

```
【タスク】API仕様書を更新する @john
```

担当者（@john）に期限設定ボタンが送信されます。

### ミーティング作成

```
【ミーティング】週次ミーティング 明日 14:00-15:00 @john @sarah
```

ミーティング形式（Google Meet / 対面 / その他）を選択するボタンが表示されます。

### AI下書き生成

```
【AI】最近の議論をまとめて、次のアクションアイテムを提案してください
```

AI が直近のチャット履歴を分析し、適切な下書きを生成して管理者のDMに送信します。

### 返答生成

```
【返答】
```

未回答の質問を抽出し、AI が適切な返答を生成します。

## Redis設定（リマインダー機能用）

リマインダー機能を使用するには、Redisが必要です。

### ローカル開発

```bash
# Redisをインストール（macOS）
brew install redis

# Redisを起動
redis-server
```

### 本番環境

環境変数を設定：

```bash
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

## トラブルシューティング

### BOTがメッセージに反応しない

1. Webhookが正しく設定されているか確認
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

2. グループチャットが登録されているか確認（管理画面 → Settings → Group Chats）

3. BOTがグループの管理者権限を持っているか確認

### Google Meetリンクが生成されない

1. サービスアカウントにカレンダーの編集権限があるか確認
2. Google Calendar APIが有効化されているか確認
3. カレンダーIDが正しいか確認

### AI下書きが生成されない

1. OpenAI API Keyが正しく設定されているか確認
2. APIクォータが残っているか確認
3. 管理画面 → Audit Logsでエラーを確認

## 監査ログ

すべての操作は監査ログに記録されます。

管理画面 → **Audit Logs**で確認できます。

## データベース

すべてのデータはMySQLデータベースに保存されます。

管理画面 → **Database**（Management UI）で直接確認・編集できます。

## セキュリティ

- すべてのAPI設定は暗号化されてデータベースに保存されます
- 管理画面はManus OAuth認証で保護されています
- Webhook エンドポイントは公開されていますが、Telegram の署名検証で保護されています（推奨）

## サポート

問題が発生した場合は、以下を確認してください：

1. **Audit Logs**（管理画面）
2. **サーバーログ**（`.manus-logs/devserver.log`）
3. **ブラウザコンソール**（`.manus-logs/browserConsole.log`）

## ライセンス

MIT License
