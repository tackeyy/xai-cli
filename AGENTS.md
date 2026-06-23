# xai-cli - xAI API CLI

xAI API (Grok) の x_search ツールおよび X API v2 をラップする CLI ツール。

## 開発ルール

### TDD（テスト駆動開発）

機能追加・バグ修正は **TDD（Red-Green-Refactor）** で進める。

1. テストリストを作成
2. 失敗するテストを書く（Red）
3. テストを通す最小の実装（Green）
4. リファクタリング（Refactor）

### テスト実行

```bash
npm test           # 全テスト
npm run build      # TypeScriptビルド
```

### プロジェクト構成

```
src/
  cli/index.ts           # CLI エントリポイント（commander）
  cli/embed.ts           # embed コマンド実装
  cli/stdin.ts           # 標準入力読み取りユーティリティ
  lib/client.ts          # XaiClient（xAI API ラッパー）
  lib/twitter-client.ts  # TwitterClient（X API v2 ラッパー）
  lib/twitter-types.ts   # X API 関連型定義
  lib/types.ts           # 共通型定義
  lib/retry.ts           # リトライロジック（429/5xx）
  lib/tweet-length.ts    # ツイート文字数計算（weighted）
  __tests__/             # テストファイル
  __tests__/helpers/mock-fetch.ts  # 共通モック
```

### 主要コマンド一覧

xAI/Grok 系（`XAI_API_KEY` 使用）:
- `auth test`, `search`, `user`, `tweet` (LLMモード), `tweet --image`, `ask`

X API v2 読み取り系（Bearer Token 主体）:
- `profile get`, `dm-check`, `timeline`, `home-timeline`, `mentions`, `thread`
- `following`, `followers`, `lists`, `list-tweets`, `list-members`
- `tweets <ids...>`, `counts`, `user-search` (Pro), `search-all` (Pro+)
- `trends`, `spaces` (仕様流動的)

X API v2 書き込み系（OAuth1 / OAuth2 User Token 主体）:
- `post`, `post --media`, `post --poll`, `reply`, `post-thread`
- `delete`, `dm-send`, `update-profile`, `banner *`
- `bookmarks add`, `bookmarks remove`
- `mute`, `unmute`, `block`, `unblock`（dry-run のみ）

### ティア制約の注意

- `search-all`: 2026-06 に現アカウントで動作確認済み（一般には Pro+ / Academic Research とされるが必須の断定は緩和）
- `user-search`: **認証方式の制約**。User Context 必須（OAuth1 / OAuth2 User Context）で App-only Bearer は 403。403 はティアでなく認証方式が原因（#22）
- `tweet --metrics`: 自分の投稿のみ・要 Basic+ ティア（未検証）
- `trends` / `spaces`: 2026-06 に動作確認済み（trends 20 件 / spaces 41 件）。仕様は流動的で将来変動の可能性あり
- 書き込み系全般: `--dry-run` で事前確認を推奨
- いいね / リツイート / フォロー操作: Enterprise 限定（未実装）

### npm link

`npm link` で `~/dev/xai-cli` がグローバルにリンクされる。ビルド後すぐに `xai` コマンドに反映される。

### ローカル X 系スキル互換 contract

`x-search` / `x-tweet` / `x-quote` / `linkedin-post` などのローカルスキルは、X / xAI API への入口を必ず `xai` CLI に固定する。スキル側で `curl`、直接 HTTP、独自の一時スクリプトによる回避実装を追加しない。

`xai` に不足機能がある場合は、スキルを迂回させず、このリポジトリで CLI コマンド・オプション・JSON 出力・trace 機能を追加する。既存スキル互換のため、少なくとも次の contract は破壊的に変更しない。

- コマンド: `xai ask`, `xai search`, `xai tweet`, `xai tweet --raw --json`, `xai thread --json`, `xai user`
- 主要オプション: `--from`, `--to`, `--allow`, `--exclude`, `--json`, `--plain`, `--raw`, `--auth`
- trace flags: `--trace-jsonl`, `--trace-dir`, `--trace-response`, `--no-trace-redact-prompts`
- `x_search` 系 JSON 出力: `text` を必須とし、`usage`, `cost_usd`, `ontology` は後方互換な追加メタデータとして扱う

互換確認の最低 smoke test:

```bash
xai ask "test" --from 2026-06-01 --to 2026-06-24
xai search "AI" --json
xai tweet "https://x.com/{user}/status/{id}" --raw --json
xai thread "{tweetId}" --json
xai user "{handle}" --from 2026-06-01
xai ask "test" --trace-jsonl --trace-dir /tmp/xai-trace --trace-response
```

### ドキュメント

- `README.md` — 英語ドキュメント（主要ドキュメント）
- `README.ja.md` — 日本語ドキュメント
- `docs/x-api-gap-analysis.md` — X API エンドポイント実装状況一覧
