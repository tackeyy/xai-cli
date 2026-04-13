# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
- `src/lib/__tests__/twitter-client.test.ts` (16 tests): postTweet の正常系・URL 付与・reply・エラー分類・長文オプション
- `src/cli/__tests__/commands.test.ts`: post コマンドのテストを追加 (全 35 tests)

### Docs
- README.md に `post` コマンドセクションを追加
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
