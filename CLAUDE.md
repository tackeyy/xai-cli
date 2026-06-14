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

- `search-all`: 要 Pro+ ティア（Academic Research アクセス）
- `user-search`: 要 Pro ティア（公式に Pro plan で提供）
- `tweet --metrics`: 自分の投稿のみ・要 Basic+ ティア
- `trends` / `spaces`: エンドポイント仕様が流動的・ティア制約の可能性
- 書き込み系全般: `--dry-run` で事前確認を推奨
- いいね / リツイート / フォロー操作: Enterprise 限定（未実装）

### npm link

`npm link` で `~/dev/xai-cli` がグローバルにリンクされる。ビルド後すぐに `xai` コマンドに反映される。

### ドキュメント

- `README.md` — 英語ドキュメント（主要ドキュメント）
- `README.ja.md` — 日本語ドキュメント
- `docs/x-api-gap-analysis.md` — X API エンドポイント実装状況一覧
