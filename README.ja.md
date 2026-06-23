[English](README.md) | **日本語**

# xai-cli

xAI API (Grok) の `x_search` ツールおよび X API v2 をラップする CLI ツール。X (Twitter) の投稿検索・分析・投稿・プロフィール管理などを簡単に実行できます。

## 特徴

- xAI (Grok) `x_search` を使ったキーワード検索・LLM 要約
- X API v2 を直接呼び出す構造化データ取得（認証トークン別に Bearer / OAuth1 / OAuth2 User を使い分け）
- Grok Vision による画像・スクリーンショット OCR
- ツイート投稿・返信・スレッド投稿・メディア添付・投票作成
- フォロワー / フォロー一覧・Lists 操作・ブックマーク管理
- DM 送受信・ミュート / ブロック操作（dry-run 安全確認付き）
- トレンド・Spaces・全期間検索（ティア制約あり）

## クイックスタート

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

# X API v2 の生レスポンスを取得
xai search "AI" --raw
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

### DM 受信可否チェック

```bash
xai dm-check @maroncat11
xai --json dm-check @maroncat11
```

`dm-check` は X API v2 の `receives_your_dm` / `connection_status` / `protected` を使い、認証ユーザーから対象アカウントへ DM できる可能性を事前確認します。`X_BEARER_TOKEN` が必要です。

### ユーザータイムライン取得（構造化）

```bash
# ハンドル指定
xai timeline @elonmusk

# 複数ページをたどって最大 100 件取得
xai timeline @elonmusk --count 100

# フィールド指定
xai timeline @elonmusk --tweet-fields created_at,public_metrics

# JSON 出力
xai --json timeline @elonmusk --count 100
```

### ホームタイムライン取得

```bash
# 認証ユーザーのホームタイムライン（フォロー全体・時系列）
xai home-timeline

# リツイート・リプライを除外
xai home-timeline --exclude retweets,replies

# JSON 出力
xai --json home-timeline
```

> **注意**: OAuth1.0a 認証が必要です（`X_ACCESS_TOKEN` から userId を自動解決）。

### メンション取得

```bash
# 認証ユーザーへのメンション一覧（最新順）
xai mentions @yourhandle

# 最大件数を指定
xai mentions @yourhandle --max-results 50 --count 200

# 次ページトークンを指定して続きを取得
xai mentions @yourhandle --pagination-token <token>

# JSON 出力
xai --json mentions @yourhandle
```

> **注意**: `mentions` は `X_BEARER_TOKEN`（デフォルト）または OAuth1.0a（`--auth oauth1`）が必要です。

### フォロー一覧を取得

```bash
xai following @zeimu_ai
xai following @zeimu_ai --all
xai following @zeimu_ai --user-fields description,public_metrics
xai --json following @zeimu_ai
```

### フォロワー一覧を取得

```bash
xai followers @zeimu_ai
xai followers @zeimu_ai --all
xai followers @zeimu_ai --user-fields description,public_metrics
xai --json followers @zeimu_ai
```

### Lists 操作

```bash
# ユーザーの所有リスト取得
xai lists @elonmusk
xai --json lists @elonmusk

# リストのツイート取得
xai list-tweets 1234567890123456789
xai list-tweets 1234567890123456789 --max-results 50
xai --json list-tweets 1234567890123456789

# リストのメンバー取得
xai list-members 1234567890123456789
xai --json list-members 1234567890123456789
```

### 複数ツイートの一括取得

```bash
# スペース区切りで複数 ID を指定（最大 100 件）
xai tweets 111111111 222222222 333333333

# カンマ区切り文字列でも可
xai tweets 111111111,222222222,333333333

# JSON 出力
xai --json tweets 111111111 222222222
```

### ツイートカウント取得

直近 7 日間のクエリにマッチするツイート数を時系列で取得します。

```bash
# 日次カウント（デフォルト）
xai counts "AI 会計"

# 時間単位
xai counts "ChatGPT" --granularity hour

# 期間指定
xai counts "M&A" --from 2026-06-01T00:00:00Z --to 2026-06-07T00:00:00Z

# JSON 出力
xai --json counts "AI 会計"
```

### ユーザー検索

```bash
xai user-search "AI startup"
xai user-search "zeimu" --max-results 10
xai --json user-search "M&A"
```

> **注意**: **User Context 認証が必須**です（OAuth 1.0a または OAuth 2.0 User Context）。App-only Bearer では 403 になります。この 403 はティアではなく**認証方式**が原因です（2026-06 実測・[#22](https://github.com/tackeyy/xai-cli/issues/22)）。

### 全期間ツイート検索

```bash
xai search-all "M&A AI" --from 2023-01-01T00:00:00Z --to 2023-12-31T23:59:59Z
xai search-all "OpenAI" --max-results 100
xai --json search-all "AI 会計"
```

> **注意**: 2026-06 に現アカウントで動作確認済みです。一般には **Pro+ ティア（Academic Research アクセス）** とされますが、実測に基づき必須要件の断定は緩和しています（X API のティア区分は変動が速いため Developer Portal で最終確認を推奨）。

### トレンド取得

```bash
# 日本のトレンド（WOEID: 23424856）
xai trends 23424856

# 東京のトレンド（WOEID: 1118370）
xai trends 1118370

# JSON 出力
xai --json trends 23424856
```

> **注意**: 2026-06 に動作確認済みです（日本トレンド 20 件取得）。エンドポイント仕様は依然流動的であり、将来変動の可能性があります。

### Twitter Spaces 検索

```bash
xai spaces "AI 会計"
xai spaces "startup" --max-results 20
xai --json spaces "M&A"
```

> **注意**: 2026-06 に動作確認済みです（41 件取得）。エンドポイント仕様は依然流動的であり、将来変動の可能性があります。

### ツイートURL から内容取得

```bash
# LLM 経由（テキスト要約のみ）
xai tweet "https://x.com/elonmusk/status/123456789"

# X API v2 直叩き（構造化 JSON）
xai tweet "https://x.com/elonmusk/status/123456789" --raw --json

# 非公開メトリクス取得（自分の投稿のみ、OAuth1 必須、要 Basic+）
# impression 数などの非公開メトリクスを取得できます
xai tweet 1234567890123456789 --raw --metrics
```

### 画像 OCR / Vision 解析 (--image)

```bash
xai tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
xai --json tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
```

**必要な環境変数:**

| 環境変数 | 用途 |
|---|---|
| `XAI_API_KEY` | テキスト取得 + Vision 解析（必須） |
| `X_BEARER_TOKEN` | X API v2 で画像 URL 取得（任意）|

`X_BEARER_TOKEN` 未設定時は画像取得をスキップし、テキストのみ出力します。

### スレッド全体取得（X API v2）

```bash
xai thread 1234567890123456789 --json
xai thread "https://x.com/foo/status/1234567890" --json
xai thread 1234567890 --all --json
```

### 汎用プロンプト

```bash
xai ask "AIスタートアップのトレンドを教えてください"
xai ask "query" --allow user1,user2 --from 2026-01-01
```

### ツイートにリプライ

```bash
xai reply 1234567890123456789 "素晴らしい記事ですね！"
xai reply --dry-run 1234567890123456789 "素晴らしい記事ですね！"
```

### ツイートを投稿する

```bash
# テキストのみ
xai post --text "今日の気づき"

# URL 添付
xai post --text "新しい記事" --url "https://example.com/"

# 返信として投稿
xai post --text "ありがとうございます" --reply-to 1234567890123456789

# 引用投稿（Quote Tweet）
xai post --text "これは興味深い！" --quote-tweet-id 1234567890123456789

# dry-run（実際には投稿せずペイロードを確認）
xai post --dry-run --text "チェック" --url "https://example.com"

# JSON 出力（自動化スクリプトから使う場合）
xai --json post --text "hi"
```

**文字数カウント**: URL は長さに関わらず 23 文字扱い。日本語・絵文字は 1 文字 = 2 としてカウント。上限は 280 weighted chars（`XAI_MAX_TWEET_LENGTH` または `--max-length` で変更可）。

### メディア添付ツイート

```bash
# 画像 1 枚を添付
xai post --text "スクリーンショット" --media /path/to/image.png

# 複数ファイルを添付（最大 4 枚）
xai post --text "写真まとめ" --media img1.jpg img2.jpg img3.jpg

# alt テキスト付き
xai post --text "グラフ" --media chart.png --alt-text "AI市場の成長グラフ"

# dry-run
xai post --dry-run --text "test" --media /path/to/image.png
```

### 投票（Poll）付きツイートを投稿する

```bash
# 2 択（デフォルト: 1440 分 = 24 時間）
xai post --text "どちらが好き？" --poll "TypeScript" "Python"

# 4 択、12 時間
xai post --text "好きな言語は？" --poll "TS" "Python" "Rust" "Go" --poll-duration 720

# dry-run
xai post --dry-run --text "test poll" --poll "Yes" "No"
```

### スレッドを投稿する

```bash
# dry-run（推奨）
xai post-thread "最初のツイート" "続き..." "まとめ" --dry-run

# 実際に投稿
xai post-thread "最初のツイート" "続き..." "まとめ"
```

> **注意**: 複数ツイートを連続投稿する破壊操作のため `--dry-run` で事前確認を推奨します。

### ツイートを削除する

```bash
# dry-run（推奨）
xai delete 1234567890123456789 --dry-run

# 実際に削除
xai delete 1234567890123456789
```

> **注意**: 破壊操作のため `--dry-run` で事前確認を推奨します。

### DM を送信する

```bash
# dry-run（推奨）
xai dm-send @username "こんにちは" --dry-run

# OAuth2 ユーザートークンで送信（デフォルト）
xai dm-send @username "こんにちは"

# OAuth1 で送信
xai dm-send @username "こんにちは" --auth oauth1
```

### DM 履歴を取得する

```bash
xai dm-history
xai dm-history --max-results 50
xai dm-history --dm-conversation-id conv_id
```

> **注意**: OAuth1.0a + Elevated/有料ティアが必要です。

### ミュート / ブロック操作

> **現在は `--dry-run` のみ動作**（実際の操作は安全確認のため保留）。`--dry-run` は必須オプションです。

```bash
xai mute @username --dry-run
xai unmute @username --dry-run
xai block @username --dry-run
xai unblock @username --dry-run
```

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
xai bookmarks grep "AI" --field text --plain-pattern

# ブックマーク追加（dry-run 推奨）
xai bookmarks add 1234567890123456789 --dry-run
xai bookmarks add 1234567890123456789

# ブックマーク削除（dry-run 推奨）
xai bookmarks remove 1234567890123456789 --dry-run
xai bookmarks remove 1234567890123456789
```

### プロフィールを更新する

```bash
xai update-profile --bio "元CTO / 経営者。AIで会社を作り直しています"
xai update-profile --name "名前" --url "https://example.com" --location "Tokyo"
xai update-profile --dry-run --bio "test"
```

### プロフィールバナー操作

```bash
xai banner get
xai banner get --handle @elonmusk --save banner.jpg
xai banner set /path/to/banner.jpg
xai banner set /path/to/banner.jpg --dry-run
xai banner backup
xai banner backup --dir /path/to/backup/dir

# バックアップから復元（set の alias）
xai banner restore /path/to/banner-backup.jpg
xai banner restore /path/to/banner-backup.jpg --dry-run

xai banner remove --dry-run
```

### プロフィール情報を取得する

```bash
xai profile get @elonmusk
xai --json profile get @elonmusk
```

### oEmbed で投稿を取得する

```bash
xai embed "https://x.com/elonmusk/status/123456789"
xai embed 123456789 --format md
xai embed 123456789 --theme dark --lang en
```

### 出力フォーマット

```bash
xai --json search "AI"    # JSON 出力
xai --plain search "AI"   # プレーンテキスト出力
xai search "AI"           # ヒューマンリーダブル（デフォルト）
```

### ローカルスキル互換 contract

X 関連のローカルスキルは、X / xAI API への入口を `xai` CLI に固定します。スキルが不足している endpoint、option、JSON 項目、trace 機能を必要とする場合は、スキル内に `curl`・直接 HTTP・一時スクリプトを追加せず、先に `xai-cli` を拡張してください。

スキル利用者向けに、少なくとも以下のコマンドとオプションは後方互換を維持します。

- `xai ask`, `xai search`, `xai tweet`, `xai tweet --raw --json`, `xai thread --json`, `xai user`
- `--from`, `--to`, `--allow`, `--exclude`, `--json`, `--plain`, `--raw`, `--auth`
- `--trace-jsonl`, `--trace-dir`, `--trace-response`, `--no-trace-redact-prompts`

CLI 挙動を変更する前の最低 smoke check:

```bash
xai ask "test" --from 2026-06-01 --to 2026-06-24
xai search "AI" --json
xai tweet "https://x.com/{user}/status/{id}" --raw --json
xai thread "{tweetId}" --json
xai user "{handle}" --from 2026-06-01
xai ask "test" --trace-jsonl --trace-dir /tmp/xai-trace --trace-response
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

## 設定

詳細な環境変数の設定は「環境変数」セクションを参照してください。

## アーキテクチャ

```
src/
  cli/index.ts          # CLI エントリポイント（commander）
  lib/client.ts         # XaiClient（xAI API ラッパー）
  lib/twitter-client.ts # TwitterClient（X API v2 ラッパー）
  lib/twitter-types.ts  # X API 関連型定義
  lib/types.ts          # 共通型定義
  lib/retry.ts          # リトライロジック（429/5xx）
  lib/tweet-length.ts   # ツイート文字数計算
  __tests__/            # テストファイル
```

## コントリビューション

コントリビューションを歓迎します。変更を加える前に、まず Issue を作成して議論してください。

```bash
git clone https://github.com/tackeyy/xai-cli.git
cd xai-cli
npm install
npm test
```

## ライセンス

[MIT](LICENSE)
