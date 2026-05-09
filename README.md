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

### X API Bearer Token（following コマンド用）

```bash
export X_BEARER_TOKEN="your-bearer-token"
```

### X API OAuth 2.0 User Token（bookmarks コマンド用）

```bash
export X_OAUTH2_USER_TOKEN="your-oauth2-user-token"
# オプション: /2/users/me の API 呼び出しを省略
export X_OAUTH2_USER_ID="your-user-id"
```

### API Base URL（任意）

```bash
# デフォルト: https://api.twitter.com
export X_API_BASE_URL="https://api.x.com"
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
xai search "AI 会計" --count 100
```

`--count N` は xAI `x_search` への取得目標件数としてプロンプトに反映します（上限 1000）。

### ユーザーの投稿取得

```bash
xai user elonmusk
xai user @elonmusk --from 2026-03-01
xai user @elonmusk --count 100
xai --json user @elonmusk
```

`user` は X API Bearer Token (`X_BEARER_TOKEN`) が利用可能な場合、JSON 出力に `profile` を追加します。
`profile` には `followers_count`, `following_count`, `verified`, `created_at`, `description` が含まれます。
Bearer Token がない場合でも、従来どおり xAI `x_search` の投稿取得は継続します。

### ユーザータイムライン取得（構造化）

```bash
# ハンドル指定
xai timeline @elonmusk

# ユーザーID指定
xai timeline 2244994945

# 複数ページをたどって最大100件取得
xai timeline @elonmusk --count 100

# フィールド指定
xai timeline @elonmusk --tweet-fields created_at,author_id,public_metrics,organic_metrics

# JSON 出力
xai --json timeline @elonmusk --count 100
```

`timeline` は X API v2 `/2/users/:id/tweets` を使用します。`retweet_count`, `reply_count`, `quote_count`, `like_count`, `bookmark_count`, `view_count` は、取得できない場合も `null` として明示されます。
`--count N` はページネーションで最大 N 件まで集約します（上限 1000）。API 側に追加ページがない場合は、取得できた範囲を `meta.partial=true` として返します。

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

# 長文投稿（X Premium などで上限を引き上げる）
xai post --text "..." --max-length 25000

# ローカルの文字数チェックを無効化
xai post --text "..." --no-length-check

# dry-run（実際には投稿せず、組み立てた payload と weighted 文字数を表示）
xai post --dry-run --text "チェック" --url "https://example.com"

# JSON 形式で結果を出力（自動化スクリプトから使う場合）
xai --json post --text "hi"
# => { "tweet_id": "...", "tweet_url": "https://x.com/i/status/...", "posted_at": "...", "text": "hi" }
```

**文字数カウント**:
- URL は長さに関わらず **23 文字** として扱う (t.co 短縮を前提)
- 日本語・中国語・絵文字は **1 文字 = 2** として扱う (Twitter 公式の weighted 数え方)
- 上限は **280 weighted chars** がデフォルト。`XAI_MAX_TWEET_LENGTH` または `--max-length` で変更できる
- `--no-length-check` を付けるとローカルの文字数チェックをスキップできる

**エラーハンドリング**:
- 280 文字超過: 投稿前にローカル検証で弾く (exit 1)。`--max-length` で上限を引き上げた場合はその値を使う
- 401/403 (認証失敗): 明確なメッセージを stderr に出力 (exit 1)
- 429 (rate limit): `retry-after` ヘッダ値を併記して exit 1。スクリプト側で待機判断を
- ネットワーク / 5xx: `TwitterClient.postTweet` レベルでは投げる (リトライは呼び出し側で `withRetry` を利用)

> **注意**: `post` コマンドには `reply` と同じ X API OAuth 1.0a 認証が必要です。

### フォロー一覧を取得

```bash
# ハンドル指定
xai following @zeimu_ai

# ユーザーID指定
xai following 2244994945

# 全件取得
xai following @zeimu_ai --all

# フィールド指定
xai following @zeimu_ai --user-fields description,location,public_metrics

# ページサイズ・ページ制限
xai following @zeimu_ai --all --max-results 1000 --limit-pages 10

# OAuth 1.0a 認証を使用（デフォルトは bearer）
xai following @zeimu_ai --auth oauth1

# JSON 出力
xai --json following @zeimu_ai
```

> **注意**: `following` コマンドには `X_BEARER_TOKEN` が必要です（`--auth oauth1` 指定時は OAuth 1.0a 認証を使用）。

### ブックマーク操作

```bash
# ブックマーク一覧
xai bookmarks list
xai bookmarks list --all --max-results 100

# フォルダ一覧
xai bookmarks folders

# 特定フォルダ内のブックマーク
xai bookmarks folder 1146654567674912769

# ブックマーク検索（クライアント側フィルタリング）
xai bookmarks grep "税理士法人" --all --ignore-case
xai bookmarks grep "freee" --folder-id 1146654567674912769
xai bookmarks grep "AI" --field text --plain-pattern

# JSON 出力
xai --json bookmarks list
xai --json bookmarks grep "test"
```

> **注意**: `bookmarks` コマンドには `X_OAUTH2_USER_TOKEN` が必要です（本人のブックマークのみアクセス可能）。  
> サーバー側検索 API がないため、`grep` はブックマークを取得してからローカルでフィルタリングします。

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
