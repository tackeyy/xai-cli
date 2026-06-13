# xai-cli

xAI API (Grok) の `x_search` ツールおよび X API v2 をラップする CLI ツール。X (Twitter) の投稿検索・分析・投稿・プロフィール管理などを簡単に実行できます。

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

### X API OAuth 1.0a（reply / post / post-thread / delete / update-profile / home-timeline コマンド用）

```bash
export X_API_KEY="your-x-api-key"
export X_API_SECRET="your-x-api-secret"
export X_ACCESS_TOKEN="your-x-access-token"
export X_ACCESS_TOKEN_SECRET="your-x-access-token-secret"
```

### X API Bearer Token（following / followers / timeline / tweet --raw など）

```bash
export X_BEARER_TOKEN="your-bearer-token"
```

### X API OAuth 2.0 User Token（bookmarks / dm-send / mute / block コマンド用）

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

# ブックマーク追加（--dry-run 推奨）
xai bookmarks add 1234567890123456789 --dry-run
xai bookmarks add 1234567890123456789

# ブックマーク削除（--dry-run 推奨）
xai bookmarks remove 1234567890123456789 --dry-run
xai bookmarks remove 1234567890123456789

# JSON 出力
xai --json bookmarks list
xai --json bookmarks grep "test"
```

> **注意**: `bookmarks` コマンドには `X_OAUTH2_USER_TOKEN` が必要です（本人のブックマークのみアクセス可能）。  
> サーバー側検索 API がないため、`grep` はブックマークを取得してからローカルでフィルタリングします。  
> `add` / `remove` は書き込み操作のため `--dry-run` で事前確認を推奨します。

### フォロワー一覧を取得

```bash
# ハンドル指定
xai followers @zeimu_ai

# ユーザーID指定
xai followers 2244994945

# 全件取得
xai followers @zeimu_ai --all

# フィールド指定
xai followers @zeimu_ai --user-fields description,public_metrics

# JSON 出力
xai --json followers @zeimu_ai
```

> **注意**: `followers` コマンドには `X_BEARER_TOKEN` が必要です。

### Lists 操作

```bash
# ユーザーの所有リスト取得
xai lists @elonmusk
xai lists @elonmusk --list-fields description,member_count
xai --json lists @elonmusk

# リストのツイート取得
xai list-tweets 1234567890123456789
xai list-tweets 1234567890123456789 --max-results 50
xai --json list-tweets 1234567890123456789

# リストのメンバー取得
xai list-members 1234567890123456789
xai list-members 1234567890123456789 --user-fields description
xai --json list-members 1234567890123456789
```

### 複数ツイートの一括取得

```bash
# スペース区切りで複数 ID を指定（最大 100 件）
xai tweets 111111111 222222222 333333333

# カンマ区切り文字列でも可
xai tweets 111111111,222222222,333333333

# フィールド指定
xai tweets 111111111 222222222 --tweet-fields created_at,public_metrics --expansions author_id

# JSON 出力
xai --json tweets 111111111 222222222
```

### ツイートカウント取得

直近 7 日間のクエリにマッチするツイート数を時系列で取得します（X API v2 `GET /2/tweets/counts/recent`）。

```bash
# 日次カウント（デフォルト）
xai counts "AI 会計"

# 時間単位で取得
xai counts "ChatGPT" --granularity hour

# 期間指定
xai counts "M&A" --from 2026-06-01T00:00:00Z --to 2026-06-07T00:00:00Z

# JSON 出力
xai --json counts "AI 会計"
```

出力例（human モード）:
```
Total tweets: 1234
2026-06-07T00:00:00.000Z	2026-06-07T23:59:59.000Z	456
...
```

### ユーザー検索

```bash
# クエリでユーザーを検索
xai user-search "AI startup"
xai user-search "zeimu" --max-results 10

# JSON 出力
xai --json user-search "M&A"
```

> **注意**: `user-search` は `GET /2/users/search` を使用します。**Basic+ ティア以上が必要な可能性があります**。低いティアでは 403 が返ることがあります。

### 全期間ツイート検索

```bash
# 全期間検索（Academic Research アーカイブ）
xai search-all "M&A AI" --from 2023-01-01T00:00:00Z --to 2023-12-31T23:59:59Z
xai search-all "OpenAI" --max-results 100

# JSON 出力
xai --json search-all "AI 会計"
```

> **重要**: `search-all` は `GET /2/tweets/search/all` を使用します。**Pro+ ティア（Academic Research アクセス）が必須**です。低いティアでは 403 が返ります。

### トレンド取得

WOEID（Where On Earth ID）でエリアのトレンドを取得します。

```bash
# 日本のトレンド（WOEID: 23424856）
xai trends 23424856

# 東京のトレンド（WOEID: 1118370）
xai trends 1118370

# JSON 出力
xai --json trends 23424856
```

主な WOEID 一覧: 日本=23424856, 東京=1118370, 米国=23424977, 全世界=1

> **注意**: `trends` は `GET /2/trends/by/woeid/:woeid` を使用します。**エンドポイント仕様が流動的**であり、ティア制約の可能性があります。

### Twitter Spaces 検索

```bash
# キーワードで Spaces を検索
xai spaces "AI 会計"
xai spaces "startup" --max-results 20

# JSON 出力
xai --json spaces "M&A"
```

> **注意**: `spaces` は `GET /2/spaces/search` を使用します。**エンドポイント仕様が流動的**であり、ティア制約の可能性があります。

### ツイートを削除する

```bash
# dry-run（削除せずにリクエスト内容を確認）
xai delete 1234567890123456789 --dry-run

# 実際に削除する
xai delete 1234567890123456789
```

> **注意**: `delete` は X API OAuth 1.0a 認証が必要です（`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`）。**破壊操作のため `--dry-run` で事前確認を推奨します**。

### DM を送信する

```bash
# dry-run（送信せずにリクエスト内容を確認）
xai dm-send @username "こんにちは" --dry-run

# OAuth2 ユーザートークンで送信（デフォルト）
xai dm-send @username "こんにちは"

# OAuth1 で送信
xai dm-send @username "こんにちは" --auth oauth1
```

> **注意**: `dm-send` には `X_OAUTH2_USER_TOKEN` (デフォルト) または OAuth1.0a 認証が必要です。**破壊操作のため `--dry-run` で事前確認を推奨します**。

### スレッドを投稿する

```bash
# 3 件のツイートをスレッドとして投稿（dry-run）
xai post-thread "最初のツイート" "続き..." "まとめ" --dry-run

# 実際に投稿する
xai post-thread "最初のツイート" "続き..." "まとめ"

# JSON 出力
xai --json post-thread "tweet1" "tweet2"
```

各引数が 1 件のツイートになり、順番に返信チェーンとして投稿されます。  
> **注意**: `post-thread` には X API OAuth 1.0a 認証が必要です。**複数ツイートを連続投稿する破壊操作のため `--dry-run` で事前確認を推奨します**。

### ミュート / ブロック操作

これらのコマンドはすべて `--dry-run` が**必須**です（`requiredOption` で強制）。

```bash
# ミュート（dry-run のみ）
xai mute @username --dry-run

# アンミュート（dry-run のみ）
xai unmute @username --dry-run

# ブロック（dry-run のみ）
xai block @username --dry-run

# アンブロック（dry-run のみ）
xai unblock @username --dry-run

# OAuth1 認証を明示
xai mute @username --auth oauth1 --dry-run
```

> **注意**: `mute` / `unmute` / `block` / `unblock` は高影響操作のため、現在は `--dry-run` のみ対応しています（実際の操作は dry-run オプションを外しても実行されません）。認証には `X_OAUTH2_USER_TOKEN` (デフォルト) または OAuth1.0a が必要です。

### ツイートにメディアを添付する（post コマンド拡張）

```bash
# 画像 1 枚を添付して投稿
xai post --text "スクリーンショット" --media /path/to/image.png

# 複数ファイルを添付（最大 4 枚）
xai post --text "写真まとめ" --media img1.jpg img2.jpg img3.jpg

# alt テキスト付き
xai post --text "グラフ" --media chart.png --alt-text "AI市場の成長グラフ"

# dry-run でペイロード確認
xai post --dry-run --text "test" --media /path/to/image.png
```

> メディアは `POST https://upload.twitter.com/1.1/media/upload.json` でアップロード後、tweet に紐付けられます。

### 投票（Poll）付きツイートを投稿する（post コマンド拡張）

```bash
# 2 択の投票を作成（デフォルト: 1440 分 = 24 時間）
xai post --text "どちらが好き？" --poll "TypeScript" "Python"

# 4 択、12 時間
xai post --text "好きな言語は？" --poll "TS" "Python" "Rust" "Go" --poll-duration 720

# dry-run
xai post --dry-run --text "test poll" --poll "Yes" "No"
```

### 非公開メトリクスの取得（tweet コマンド拡張）

```bash
# 非公開メトリクス + organic_metrics を含めて取得（OAuth1 必須）
xai tweet 1234567890123456789 --raw --metrics

# JSON 出力
xai --json tweet 1234567890123456789 --raw --metrics
```

`--metrics` を指定すると `non_public_metrics`（impression_count 等）と `organic_metrics` が追加されます。  
> **注意**: 非公開メトリクスは **Basic+ ティア以上が必要な可能性があります**。また自分が投稿したツイートのみ取得可能です。

### ホームタイムライン取得

```bash
# 認証ユーザーのホームタイムライン（フォロー全体・時系列）
xai home-timeline

# OAuth1 Access Token から userId を自動導出
xai home-timeline --max-results 20

# 明示的に userId を指定
xai home-timeline 2244994945

# リツイート・リプライを除外
xai home-timeline --exclude retweets,replies

# JSON 出力
xai --json home-timeline
```

> **注意**: `home-timeline` は OAuth1.0a 認証が必要です（`X_ACCESS_TOKEN` から userId を自動解決）。

### 出力フォーマット

```bash
xai --json search "AI"    # JSON出力
xai --plain search "AI"   # プレーンテキスト出力
xai search "AI"           # ヒューマンリーダブル（デフォルト）
```

## 未実装機能とその理由

以下の機能は意図的に未実装です。

| 機能 | 理由 |
|---|---|
| いいね（Like）作成・取消 | 2026年時点で Enterprise ティア限定（$42,000/月級）。動作確認が現実的でないため未実装 |
| リツイート作成・取消 | 同上（Enterprise 限定） |
| フォロー・アンフォロー操作 | 同上（Enterprise 限定） |
| Filtered Stream | Pro+ ティア限定かつ常駐プロセス前提。単発実行の CLI 設計と噛み合わないため未実装 |
| Sampled Stream | 同上 |
| Note Tweet（長文投稿） | X API 仕様が流動的・未確定のため見送り |

> `mute` / `block` / `unmute` / `unblock` は実装済みですが、現バージョンでは `--dry-run` のみ動作します（実際の操作は安全確認のため保留）。

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
