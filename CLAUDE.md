# CLAUDE.md - Universal Project Guidelines

## Project Overview

<!-- プロジェクト固有の情報をここに記載 -->
- **Project Name**: [PROJECT_NAME]
- **Tech Stack**: [例: Next.js, Firebase, MySQL, etc.]
- **Repository**: [REPO_URL]

---

## 🎯 Core Principles

### Development Philosophy
1. **シンプルさを優先** - 複雑な解決策より、理解しやすく保守しやすいコードを選ぶ
2. **段階的な変更** - 大きな変更は小さなステップに分割して実行する
3. **既存パターンの尊重** - プロジェクト内の既存コードスタイルに従う
4. **確認してから実行** - 破壊的な操作の前は必ず確認する

---

## 🔒 Security Rules (MUST FOLLOW)

### 絶対に行ってはいけないこと
- [ ] `.env`、`.env.*` ファイルの内容を出力・表示しない
- [ ] APIキー、シークレット、パスワードをコードにハードコードしない
- [ ] 認証情報をログに出力しない
- [ ] `.gitignore` に含まれるファイルをコミットしない
- [ ] 本番データベースへの直接操作を行わない

### 機密ファイルパターン
```
# これらのファイルは読み取り・表示禁止
.env
.env.*
*.pem
*.key
*credentials*
*secret*
config/secrets.*
```

### セキュリティチェックリスト
変更を加える前に確認:
1. 認証情報が含まれていないか？
2. SQLインジェクションの脆弱性はないか？
3. XSS対策は適切か？
4. 入力値のバリデーションは実装されているか？

---

## 📁 Project Structure

### ディレクトリ構成の理解
```
# 変更前に必ず確認するディレクトリ
src/           # メインソースコード
tests/         # テストファイル
docs/          # ドキュメント
scripts/       # ユーティリティスクリプト
config/        # 設定ファイル（機密情報注意）
```

### ファイル命名規則
- コンポーネント: `PascalCase.tsx` (例: `UserProfile.tsx`)
- ユーティリティ: `camelCase.ts` (例: `formatDate.ts`)
- 定数: `SCREAMING_SNAKE_CASE`
- テスト: `*.test.ts` または `*.spec.ts`

---

## 🛠 Development Workflow

### コード変更の手順
1. **現状把握** - 関連ファイルを読んで理解する
2. **影響範囲の確認** - 変更が他の部分に与える影響を考慮
3. **最小限の変更** - 必要最小限の変更に留める
4. **テスト** - 変更後は必ずテストを実行

### Git操作ルール
```bash
# コミットメッセージ形式
<type>(<scope>): <subject>

# type: feat, fix, docs, style, refactor, test, chore
# 例: feat(auth): add password reset functionality
```

### ブランチ戦略
- `main` / `master` - 直接pushしない
- `develop` - 開発用統合ブランチ
- `feature/*` - 新機能開発
- `fix/*` - バグ修正
- `hotfix/*` - 緊急修正

---

## ✅ Quality Standards

### コードレビュー基準
- [ ] 単一責任の原則に従っているか
- [ ] エラーハンドリングは適切か
- [ ] コメントは必要十分か（過剰でも不足でもない）
- [ ] マジックナンバーは定数化されているか
- [ ] 重複コードはないか

### テスト要件
```
# テストカバレッジ目標
- 新規コード: 80%以上
- クリティカルパス: 100%
- ユーティリティ関数: 90%以上
```

### ドキュメント要件
- 公開API・関数にはJSDoc/TSDocを付ける
- 複雑なロジックには説明コメントを付ける
- READMEは常に最新の状態を保つ

---

## 🚫 Prohibited Actions

### 確認なしに実行してはいけない操作
1. **データベース操作**
   - `DROP`, `DELETE`, `TRUNCATE` (本番環境)
   - スキーマ変更 (`ALTER TABLE`)
   - マイグレーションの実行

2. **ファイル操作**
   - `rm -rf` (特に `/`, `~`, プロジェクトルート)
   - 設定ファイルの上書き
   - `.git` ディレクトリの操作

3. **外部サービス操作**
   - 本番APIへのリクエスト
   - 課金が発生する操作
   - ユーザーへの通知送信

### 実行前に必ず確認を求める操作
```bash
# これらのコマンドは実行前に確認
git push origin main
npm publish
docker push
kubectl apply (production)
```

---

## 🔧 Tool-Specific Guidelines

### パッケージマネージャー
```bash
# 使用するパッケージマネージャーを指定
# npm / yarn / pnpm から選択
PACKAGE_MANAGER=npm

# 依存関係の追加時は必ず理由を説明
# セキュリティ脆弱性のあるパッケージは使用しない
```

### リンター・フォーマッター
```bash
# コミット前に必ず実行
npm run lint
npm run format

# 自動修正を試みる
npm run lint:fix
```

### テスト実行
```bash
# 変更に関連するテストを実行
npm test -- --related

# 全テスト実行
npm test
```

---

## 📝 Communication Guidelines

### 質問・確認のタイミング
以下の場合は実行前に確認を求める:
- 要件が曖昧な場合
- 複数の実装方法が考えられる場合
- 破壊的な変更を行う場合
- セキュリティに関わる変更の場合

### レスポンス形式
- 変更内容は具体的に説明する
- 影響範囲を明示する
- 代替案がある場合は提示する
- 不明点は正直に伝える

---

## 🌐 Environment-Specific Rules

### Development
- デバッグログ有効
- モックデータ使用可
- ホットリロード有効

### Staging
- 本番に近い設定
- テストデータのみ使用
- 外部サービスはサンドボックス

### Production
- **読み取り専用アクセスのみ**
- 変更は必ずCI/CDパイプライン経由
- 直接的なデータ操作は禁止

---

## 📚 Project-Specific Knowledge

### 重要なファイル
```
# プロジェクトを理解するために読むべきファイル
README.md          - プロジェクト概要
CONTRIBUTING.md    - 貢献ガイドライン
docs/ARCHITECTURE.md - アーキテクチャ説明
```

### よく使うコマンド
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト
npm test

# リント
npm run lint
```

### 外部ドキュメント
- [フレームワーク公式ドキュメント]
- [API仕様書]
- [デザインシステム]

---

## ⚡ Performance Guidelines

### 避けるべきパターン
- N+1クエリ
- 不要な再レンダリング
- 巨大なバンドルサイズ
- メモリリーク

### 推奨パターン
- 適切なキャッシュ戦略
- 遅延読み込み (Lazy Loading)
- 画像の最適化
- データベースインデックスの活用

---

## 🆘 Troubleshooting

### よくある問題と解決策
1. **ビルドエラー** → `node_modules` 削除して再インストール
2. **型エラー** → `tsconfig.json` の設定確認
3. **テスト失敗** → モックの設定確認

### エスカレーション
解決できない問題が発生した場合:
1. エラーメッセージを完全に記録
2. 再現手順を文書化
3. チームリーダーに報告

---

## 📋 Checklist Templates

### PR作成前チェックリスト
- [ ] コードは既存のスタイルに従っている
- [ ] テストが追加/更新されている
- [ ] ドキュメントが更新されている
- [ ] セキュリティ上の問題がない
- [ ] パフォーマンスへの影響を考慮した

### リリース前チェックリスト
- [ ] 全テストがパス
- [ ] ステージング環境で動作確認済み
- [ ] ロールバック手順が準備されている
- [ ] 関係者への通知が完了

---

## 🔄 Version History

| Date | Version | Changes |
|------|---------|---------|
| YYYY-MM-DD | 1.0.0 | Initial version |

---

**Note**: このファイルはプロジェクトの成長とともに更新してください。
チーム全員がこのガイドラインを理解し、遵守することで、品質の高い開発が可能になります。
