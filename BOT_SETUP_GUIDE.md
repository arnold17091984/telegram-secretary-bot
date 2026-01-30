# Telegram秘書BOT セットアップガイド

このガイドでは、Telegram秘書BOTを実際に動作させるための手順を説明します。

---

## 📋 目次

1. [前提条件](#前提条件)
2. [Telegram Botの作成](#telegram-botの作成)
3. [管理画面での設定](#管理画面での設定)
4. [Webhook URLの登録](#webhook-urlの登録)
5. [動作確認](#動作確認)
6. [トリガーキーワード一覧](#トリガーキーワード一覧)

---

## 前提条件

- Telegramアカウント
- このアプリケーションがデプロイされ、公開URLが取得されていること
- OpenAI APIキー（AI機能を使用する場合）
- Google Cloud サービスアカウント（カレンダー連携を使用する場合）

---

## Telegram Botの作成

### 1. BotFatherでBotを作成

1. Telegramで **@BotFather** を検索して開く
2. `/newbot` コマンドを送信
3. Bot名を入力（例: `My Secretary Bot`）
4. Botのユーザー名を入力（例: `my_secretary_bot`）※末尾は必ず `bot` で終わる必要があります
5. BotFatherから **Bot Token** が送られてきます（例: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. Bot Tokenをコピー

送られてきたBot Tokenを安全な場所にコピーしておきます。

---

## 管理画面での設定

### 1. ログインして設定画面を開く

1. アプリケーションにログイン
2. 左サイドバーの「設定」をクリック
3. 「API設定」タブを開く

### 2. Telegram Bot Tokenを設定

1. **Telegram Bot Token** フィールドに、BotFatherから取得したTokenを貼り付け
2. 「テスト」ボタンをクリックして接続を確認
3. 成功メッセージが表示されたら「設定を保存」をクリック

### 3. 管理者ユーザーIDを設定

AI機能を使用できるユーザーを指定します。

1. Telegramで **@userinfobot** を検索して開く
2. `/start` コマンドを送信すると、あなたのUser IDが表示されます（例: `123456789`）
3. 管理画面の「管理者ユーザーID」フィールドにUser IDを入力
4. 複数の管理者を設定する場合は、カンマ区切りで入力（例: `123456789, 987654321`）
5. 「設定を保存」をクリック

### 4. グループチャットを設定

1. 「グループチャット」タブを開く
2. Botを追加したいグループチャットで、以下の手順を実施：
   - グループにBotを追加（グループ設定 → メンバーを追加 → Botを検索）
   - グループで `/start@your_bot_name` コマンドを送信
   - グループチャットIDを取得するには、**@RawDataBot** をグループに追加して `/start` を送信すると、`chat.id` が表示されます
3. 管理画面に戻り、「グループを追加」をクリック
4. 以下の情報を入力：
   - **グループチャットID**: 取得したID（例: `-1001234567890`）
   - **グループ名**: 任意の名前（例: `開発チーム`）
   - **責任者ユーザーID**: グループの責任者のTelegram User ID
   - **カレンダーID**: Google CalendarのID（ミーティング機能を使用する場合）
5. 「保存」をクリック

### 5. OpenAI API Key を設定（オプション）

AI下書き生成機能を使用する場合：

1. [OpenAI Platform](https://platform.openai.com/api-keys) でAPI Keyを取得
2. 管理画面の「OpenAI API Key」フィールドに貼り付け
3. 「テスト」ボタンで接続確認
4. 「設定を保存」をクリック

### 6. Google Calendar認証情報を設定（オプション）

ミーティング機能でGoogle Calendarを使用する場合：

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Calendar APIを有効化
3. サービスアカウントを作成し、JSONキーをダウンロード
4. 管理画面の「Google Calendar認証情報（JSON）」フィールドにJSONの内容を貼り付け
5. 「JSON形式をテスト」ボタンで確認
6. 「設定を保存」をクリック

---

## Webhook URLの登録

Telegram BOTがメッセージを受信するには、Webhook URLを登録する必要があります。

### 方法1: ブラウザから登録（簡単）

以下のURLをブラウザで開きます（`YOUR_BOT_TOKEN` と `YOUR_WEBHOOK_URL` を置き換えてください）：

```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WEBHOOK_URL/api/telegram/webhook
```

**例**:
```
https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://your-app.manus.space/api/telegram/webhook
```

成功すると、以下のようなレスポンスが表示されます：
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 方法2: curlコマンドで登録

ターミナルで以下のコマンドを実行：

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WEBHOOK_URL/api/telegram/webhook"}'
```

### Webhook URLの確認

登録されているWebhook URLを確認するには：

```
https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

---

## 動作確認

### 1. Botとの1対1チャットで確認

1. Telegramで自分のBotを検索して開く
2. `/start` コマンドを送信
3. Botから応答があれば成功

### 2. グループチャットで確認

1. Botを追加したグループチャットを開く
2. 以下のメッセージを送信してみる：

```
【タスク】APIドキュメントの更新
担当: @username
期限: 明日
```

3. Botから担当者へのDMが送信され、期限設定ボタンが表示されれば成功

---

## トリガーキーワード一覧

### 1. 【タスク】トリガー

**使い方**:
```
【タスク】タスクの内容
担当: @username
期限: 今日中 / 明日 / 3日後 / 2024-01-28
```

**動作**:
1. タスクが仮登録される
2. 担当者にDMが送信される
3. 担当者が期限を選択（今日中、明日、3日後、日付指定、質問、却下）
4. 期限が確定したら、グループチャットに確定メッセージが投稿される
5. タスクの状態管理ボタン（進行中、ブロック、完了、期限変更）が表示される

**リマインド**:
- 期限の24時間前に通知
- 期限の1時間前に通知
- 期限超過後、設定した間隔でフォローアップ通知

---

### 2. 【ミーティング】トリガー

**使い方**:
```
【ミーティング】プロジェクトレビュー
日時: 2024-01-28 14:00
参加者: @user1 @user2 @user3
```

**動作**:
1. ミーティング情報がパースされる
2. 不足情報があれば確認ボタンが表示される
3. オンライン会議の確認（Google Meet、対面、その他）
4. Google Calendarにイベントが作成される（Meet リンクも自動生成）
5. グループチャットにミーティング登録メッセージが投稿される
6. 開始10分前に参加者全員にリマインド通知

---

### 3. 【AI】トリガー

**使い方**:
```
【AI】最近の議論をまとめて
```

**動作**:
1. 管理者ユーザーIDをチェック（権限がない場合はエラー）
2. 直近50件のチャット履歴を収集
3. OpenAI APIで下書きを生成
4. 管理者のDMに下書きが送信される
5. 管理者が「投稿」「編集」「破棄」を選択
6. 投稿を選択した場合、グループチャット選択画面が表示される
7. 選択したグループに投稿される

---

### 4. 【返答】トリガー

**使い方**:
```
【返答】
```

**動作**:
1. 管理者ユーザーIDをチェック
2. グループチャット内の未回答質問を抽出（「?」で終わるメッセージ）
3. 管理者のDMに質問リストが送信される
4. 管理者が返答する質問を選択
5. 選択した質問に対してOpenAI APIで返答下書きを生成
6. 管理者が「投稿」「編集」「破棄」を選択
7. 投稿を選択すると、元の質問に返信する形でグループに投稿される

**リマインド**:
- 未回答の質問は72時間後に管理者に通知

---

## トラブルシューティング

### Botがメッセージに反応しない

1. **Webhook URLが正しく登録されているか確認**:
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
   ```
   
2. **Bot TokenとWebhook URLが正しいか確認**

3. **グループチャットでBotに権限があるか確認**:
   - グループ設定 → 管理者 → Botを管理者に追加
   - または、グループ設定 → 権限 → 「メッセージを読む」権限を有効化

4. **開発サーバーのログを確認**:
   ```bash
   # ログファイルを確認
   tail -f .manus-logs/devserver.log
   ```

### テストボタンが失敗する

- **Telegram Bot Token**: BotFatherから取得したTokenが正しいか確認
- **OpenAI API Key**: OpenAI Platformで有効なAPI Keyか確認、課金設定がされているか確認
- **Google Calendar認証情報**: JSON形式が正しいか、サービスアカウントにCalendar APIの権限があるか確認

### グループチャットIDが分からない

1. **@RawDataBot** をグループに追加
2. `/start` コマンドを送信
3. 表示される `chat.id` をコピー（例: `-1001234567890`）
4. @RawDataBotをグループから削除してOK

---

## 次のステップ

1. **リマインダー設定のカスタマイズ**: 設定画面の「リマインダー」タブで通知間隔を調整
2. **AIモデル設定の調整**: 設定画面の「AIモデル」タブでTemperatureやMax Tokensを調整
3. **監査ログの確認**: 左サイドバーの「監査ログ」で全ての操作履歴を確認

---

## サポート

問題が解決しない場合は、以下を確認してください：

- `TELEGRAM_BOT_README.md` - 技術的な詳細
- `.manus-logs/` - サーバーログ
- 管理画面の「監査ログ」 - 操作履歴

---

**重要**: Bot Tokenは絶対に公開しないでください。第三者に知られると、Botが不正利用される可能性があります。
