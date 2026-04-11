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

### X API OAuth 1.0a（reply / post コマンド用）

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

### ツイートを投稿する

```bash
# テキストのみ
xai post --text "今日の気づき: 280文字の壁は意外と厳しい"

# URL 添付（本文末尾に改行区切りで追記される）
xai post --text "新しい記事を公開しました" --url "https://zeimu.ai/columns/newsletter/vol-0005/"

# 返信として投稿
xai post --text "ありがとうございます" --reply-to 1234567890123456789

# dry-run（実際には投稿せず、組み立てた payload と weighted 文字数を表示）
xai post --dry-run --text "チェック" --url "https://example.com"

# JSON 形式で結果を出力（自動化スクリプトから使う場合）
xai --json post --text "hi"
# => { "tweet_id": "...", "tweet_url": "https://x.com/i/status/...", "posted_at": "...", "text": "hi" }
```

**文字数カウント**:
- URL は長さに関わらず **23 文字** として扱う (t.co 短縮を前提)
- 日本語・中国語・絵文字は **1 文字 = 2** として扱う (Twitter 公式の weighted 数え方)
- 上限は **280 weighted chars**。超過時はローカルで即エラー (fetch を発火させない)

**エラーハンドリング**:
- 280 文字超過: 投稿前にローカル検証で弾く (exit 1)
- 401/403 (認証失敗): 明確なメッセージを stderr に出力 (exit 1)
- 429 (rate limit): `retry-after` ヘッダ値を併記して exit 1。スクリプト側で待機判断を
- ネットワーク / 5xx: `TwitterClient.postTweet` レベルでは投げる (リトライは呼び出し側で `withRetry` を利用)

> **注意**: `post` コマンドには `reply` と同じ X API OAuth 1.0a 認証が必要です。

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
