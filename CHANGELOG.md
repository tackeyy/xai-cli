# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **`xai following <user>` コマンド**: 指定ユーザーのフォロー一覧を取得。
  - `@handle` / `handle` / numeric user ID 指定に対応
  - `--user-fields`, `--expansions`, `--tweet-fields` でレスポンスフィールドを制御
  - `--all` で全ページ取得、`--limit-pages` で安全弁
  - `--pagination-token` で単ページ取得の continuation
  - `--auth bearer|oauth1` で認証方式を選択（デフォルト: bearer）
  - `--json` で raw API response を出力
- **`xai bookmarks` サブコマンド群**: 本人のブックマーク操作（OAuth 2.0 User Token 必須）。
  - `bookmarks list`: ブックマーク一覧取得
  - `bookmarks folders`: フォルダ一覧取得
  - `bookmarks folder <folder-id>`: 特定フォルダ内のブックマーク取得
  - `bookmarks grep <pattern>`: ブックマークのクライアント側検索
    - `--ignore-case`, `--field text|author|url|all`, `--plain-pattern`
    - `--folder-id` でフォルダ内を対象に検索
  - 全サブコマンドで `--all`, `--limit-pages`, `--pagination-token`, `--json` に対応
- `TwitterClient` に汎用 GET ヘルパーと複数認証方式（Bearer / OAuth 2.0 User Token / OAuth 1.0a）を追加
- OAuth 1.0a 署名を GET query parameters 対応に修正
- `TwitterClientOptions` を optional credential 方式に拡張
- `src/lib/twitter-types.ts`: X API GET response 用の型定義
- 新規環境変数: `X_BEARER_TOKEN`, `X_OAUTH2_USER_TOKEN`, `X_OAUTH2_USER_ID`, `X_API_BASE_URL`
- **`xai post` subcommand**: ツイートを投稿する新コマンド。
  - `--text <string>` (必須): 本文。280 weighted chars 制限をローカル検証
  - `--url <string>`: 本文末尾に改行区切りで URL を追記
  - `--reply-to <tweet-id>`: 返信先ツイート ID
  - `--max-length <number>`: ローカルの weighted character limit を上書き（`XAI_MAX_TWEET_LENGTH` でも既定値を変更可能）
  - `--no-length-check`: ローカルの文字数バリデーションをスキップ
  - `--dry-run`: 実際には投稿せず、組み立てた API payload と weighted 文字数を出力
  - `--json`: 成功時に `tweet_id` / `tweet_url` / `posted_at` / `text` を JSON 出力
  - 認証は既存の `reply` コマンドと同じ X API OAuth 1.0a (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`)
- `src/lib/tweet-length.ts`: Twitter 公式の weighted character count 実装。
  - URL は長さに関わらず 23 文字として扱う
  - 日本語・中国語・絵文字は 1 文字 = 2 として扱う (weighted range に基づく)
  - `computeTweetLength(text)` / `isWithinTweetLimit(text, maxLength?)` / 定数 `DEFAULT_TWEET_MAX_LENGTH` / `TWEET_MAX_LENGTH` / `URL_WEIGHTED_LENGTH` を export
- `TwitterClient.postTweet(input)`: X API v2 `POST /2/tweets` を叩くメソッド。
  - ローカルで weighted chars の事前バリデーション (fetch を発火させない)
  - `maxLength` / `noLengthCheck` に対応し、X Premium の長文投稿やチェック無効化を許可
  - 成功時に `id` / `text` / `url` (https://x.com/i/status/...) / `posted_at` を返す
  - 失敗時は HTTP status と `retry-after` ヘッダ値を含む Error を投げる
- `TwitterClient.buildPostPayload(input)`: dry-run / テスト用に送信ボディだけを組み立てるヘルパ
- `TweetTooLongError`: 超過した上限値を含めて投げる専用エラー

### Tests
- `src/lib/__tests__/tweet-length.test.ts` (15 tests): ASCII / CJK / URL / 境界値 / env override
- `src/lib/__tests__/twitter-client.test.ts` (44 tests): postTweet / GET helper / getUserByUsername / getFollowing / getAllFollowing / getAuthenticatedUser / getBookmarks / getAllBookmarks / getBookmarkFolders / getBookmarksByFolder / filterBookmarks
- `src/cli/__tests__/commands.test.ts` (60 tests): 全 CLI コマンドのテスト（following / bookmarks list / folders / folder / grep 含む）

### Docs
- README.md に `following`, `bookmarks` コマンドセクションを追加
- README.md に新規環境変数（`X_BEARER_TOKEN`, `X_OAUTH2_USER_TOKEN`, `X_OAUTH2_USER_ID`, `X_API_BASE_URL`）を追加
- 既存の reply セクション見出しに `post` を併記

---

## [0.1.0] - 2026 初版

### Added
- `xai auth test`: xAI API 認証テスト
- `xai search <query>`: X 投稿検索
- `xai user <handle>`: ユーザーの最近の投稿取得
- `xai tweet <url>`: ツイート本文取得
- `xai ask <prompt>`: grok に任意プロンプト
- `xai reply <tweetId> <text>`: OAuth 1.0a でツイート返信
- `xai embed <url-or-id>`: oEmbed API 経由で X 投稿取得 (認証不要)
