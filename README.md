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

### X API OAuth 1.0a（reply / post / update-profile コマンド用）

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

### DM 受信可否チェック

```bash
xai dm-check xat_t0b
xai dm-check @maroncat11 --json
xai --json dm-check @maroncat11
```

`dm-check` は X API v2 `/2/users/by/username/:username` の `receives_your_dm` / `connection_status` / `protected` を使い、認証ユーザーから対象アカウントへ DM できる可能性を事前確認します。
`can_receive_dm` は `"true"`, `"false"`, `"unknown"` の文字列で返します。`receives_your_dm` が返らない場合や、protected アカウントをフォローしていない場合は `unknown` です。
`X_BEARER_TOKEN` が必要です。`receives_your_dm` は認証ユーザーとの関係に依存するため、app-only Bearer では field が欠落する可能性があります。

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
# LLM 経由 (テキスト要約のみ)
xai tweet "https://x.com/elonmusk/status/123456789"

# X API v2 直叩き — 構造化 JSON (referenced_tweets / conversation_id 等)
xai tweet "https://x.com/elonmusk/status/123456789" --raw --json

# 任意フィールド指定
xai tweet 123456789 --raw \
  --tweet-fields conversation_id,referenced_tweets,public_metrics \
  --expansions author_id,referenced_tweets.id \
  --json
```

`--raw` モードは `X_BEARER_TOKEN` (`--auth bearer`、既定) または OAuth1.0a (`--auth oauth1`) を使用。

### 画像 OCR / Vision 解析 (--image)

画像が主体のツイート（スクリーンショット、資料画像、グラフ等）を Grok Vision で解析します。

```bash
# ツイート本文 + 添付画像の内容（文字起こし & 文脈説明）を Markdown で出力
xai tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image

# JSON 形式で出力
xai --json tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
```

**動作の流れ:**

1. xAI `x_search` でツイート本文を取得（従来通り）
2. X API v2 (`expansions=attachments.media_keys&media.fields=url`) で画像 URL を取得（最大 4 枚）
3. xAI Grok Vision (`grok-4.3`) で画像を分析し、OCR + 文脈説明を生成
4. Markdown で統合出力（`## ツイート本文` / `## 画像内容` セクション）

**必要な環境変数:**

| 環境変数 | 用途 |
|---|---|
| `XAI_API_KEY` | テキスト取得 + Vision 解析（必須） |
| `X_BEARER_TOKEN` | X API v2 で画像 URL 取得（任意。未設定時はテキストのみ出力） |

**フォールバック動作:**

- `X_BEARER_TOKEN` 未設定 → 画像 URL 取得をスキップし、テキストのみ出力（エラー終了なし）
- 画像なしツイート → 従来通りのテキスト出力
- Vision API エラー → 警告を stderr に出力し、テキストのみ出力にフォールバック

### スレッド全体取得（X API v2）

```bash
# Tweet ID または URL から会話全体（conversation_id 単位）を時系列で取得
xai thread 1234567890123456789 --json
xai thread "https://x.com/foo/status/1234567890" --json

# 100 件超のスレッドは --all で全ページネーション (上限 50 ページ)
xai thread 1234567890 --all --json

# 1 ページあたりの件数指定 (10-100)
xai thread 1234567890 --max-results 50
```

内部で `GET /2/tweets/:id` (親 tweet 取得) + `GET /2/tweets/search/recent?query=conversation_id:XXX` (スレッド全件) を呼ぶ。

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

### プロフィールを更新する

bio（自己紹介）・表示名・URL・場所を更新する。X API v2 にプロフィール更新エンドポイントが無いため、v1.1 `account/update_profile` を使用する。

```bash
# bio（自己紹介）を更新
xai update-profile --bio "元CTO / 経営者。AIで会社を作り直しています"

# 表示名・URL・場所をまとめて更新
xai update-profile --name "瀧田雄介" --url "https://example.com" --location "Tokyo"

# dry-run（送信せず、組み立てたリクエストを表示）
xai update-profile --dry-run --bio "test"

# JSON 形式で結果を出力
xai --json update-profile --bio "hi"
```

**フィールドと上限**:
- `--name` 表示名（最大 50 文字）
- `--bio` 自己紹介 / description（最大 160 文字）
- `--url` ウェブサイト URL（最大 100 文字）
- `--location` 場所（最大 30 文字）
- いずれか 1 つ以上を指定する必要がある（全て未指定は exit 1）

**エラーハンドリング**:
- 文字数超過: 送信前にローカル検証で弾く (exit 1)
- 401/403 (認証失敗 / ティア不足): メッセージに「Requires Elevated/paid tier access」を併記して exit 1
- 429 (rate limit): `retry-after` ヘッダ値を併記して exit 1

> **注意**: `update-profile` は `post` / `reply` と同じ X API OAuth 1.0a 認証が必要です。さらに v1.1 `account/update_profile` は X API の **Elevated / 有料ティア** でのみ利用できる場合があります（無料 / Basic では 401/403 になることがあります）。

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
