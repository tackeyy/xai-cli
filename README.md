# xai-cli

xAI API (Grok) の `x_search` ツールをラップする CLI ツール。X (Twitter) の投稿検索・分析を簡単に実行できます。

## インストール

```bash
git clone https://github.com/tackeyy/xai-cli.git
cd xai-cli
npm install
npm run build
npm link
```

## 環境変数

### xAI API（検索コマンド用）

```bash
export XAI_API_KEY="your-xai-api-key"
```

### X API OAuth 1.0a（reply コマンド用）

```bash
export X_API_KEY="your-x-api-key"
export X_API_SECRET="your-x-api-secret"
export X_ACCESS_TOKEN="your-x-access-token"
export X_ACCESS_TOKEN_SECRET="your-x-access-token-secret"
```

## コマンド

### 認証テスト

```bash
xai auth test
```

### キーワード検索

```bash
xai search "M&A AI"
xai search "M&A AI" --from 2026-03-01 --to 2026-03-22
xai search "AI" --exclude spammer1,spammer2
```

### ユーザーの投稿取得

```bash
xai user elonmusk
xai user @elonmusk --from 2026-03-01
```

### ツイートURL から内容取得

```bash
xai tweet "https://x.com/elonmusk/status/123456789"
```

### 汎用プロンプト

```bash
xai ask "AIスタートアップのトレンドを教えてください"
xai ask "query" --allow user1,user2 --from 2026-01-01
```

### ツイートにリプライ

```bash
# リプライを投稿
xai reply 1234567890123456789 "素晴らしい記事ですね！"

# dry-run（実際には投稿せずに内容を確認）
xai reply --dry-run 1234567890123456789 "素晴らしい記事ですね！"

# JSON形式で結果を出力
xai --json reply 1234567890123456789 "素晴らしい記事ですね！"
```

> **注意**: `reply` コマンドには X API OAuth 1.0a 認証が必要です。`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` を設定してください。

### 出力フォーマット

```bash
xai --json search "AI"    # JSON出力
xai --plain search "AI"   # プレーンテキスト出力
xai search "AI"           # ヒューマンリーダブル（デフォルト）
```

## ライブラリとして使用

```typescript
import { XaiClient } from "xai-cli";

const client = new XaiClient({ apiKey: process.env.XAI_API_KEY! });
const result = await client.search("AI");
console.log(result.text);
```

## 開発

```bash
npm test          # テスト実行
npm run build     # ビルド
npm run test:watch # テスト（ウォッチモード）
```

## License

MIT
