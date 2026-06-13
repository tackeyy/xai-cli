# X API と xai-cli のギャップ分析 — 不足機能と優先度

> X API v2（一部 v1.1）が提供する機能と、`xai-cli` の現状実装を突き合わせ、**不足している機能**を洗い出した一覧です。
> 優先度は ①瀧田の普段使い（`x-search` / `x-quote` / `x-tweet` 等の CLI スキル）と ②`~/dev/smart-social`（X運用SaaS / 引用エンゲージメント自動化）が必要とする機能カテゴリ、の両軸で付けています。

調査日: 2026-06-13 / 対象 xai-cli HEAD: `f7ef04b`（profile-get / banner-crud マージ後）

> ⚠️ ティア要件・課金額の記述は2026年時点の公開情報ベースで、**X Developer Portal で最終確認を推奨**（X API のティア区分は変動が速い）。「要確認」と明記した項目は特に未検証。

---

## 1. xai-cli の実装済み機能（基準）

| カテゴリ | CLI コマンド | 叩いている X API |
|---|---|---|
| Grok | `ask <prompt>` | xAI API（X検索付き）|
| 認証確認 | `auth test` | 認証情報の疎通確認 |
| 検索 | `search <query>` | `GET /2/tweets/search/recent` |
| ユーザー | `user <handle>` | `GET /2/users/by/username/:username`（public_metrics 含む）|
| プロフィール取得 | `profile get <handle>` | `GET /2/users/by/username/:username`（bio/name/metrics, 字数・行数表示, `--json`）|
| 自分 | （内部）| `GET /2/users/me` |
| タイムライン | `timeline <user>` | `GET /2/users/:id/tweets` |
| ホームTL | `home-timeline [userId]` | `GET /2/users/:id/timelines/reverse_chronological` |
| メンション | `mentions <user>` | `GET /2/users/:id/mentions` |
| ツイート取得 | `tweet <url>` / `thread <idOrUrl>` | `GET /2/tweets/:id`（メディアURL含む）/ 会話取得 |
| 投稿 | `post`（`--reply-to` / `--quote-tweet-id` 対応）| `POST /2/tweets` |
| 返信 | `reply <tweetId> <text>` | `POST /2/tweets` |
| プロフィール更新 | `update-profile` | `POST /1.1/account/update_profile.json` |
| バナー | `banner get/set/backup/restore/remove`（`restore` は `set` の alias）| `GET /1.1/users/profile_banner.json` / `POST /1.1/account/update_profile_banner.json`（OAuth1.0a + Elevated/有料ティア）|
| フォロー中 | `following <user>` | `GET /2/users/:id/following` |
| ブックマーク | `bookmarks list/folders/folder/grep` | `GET /2/users/:id/bookmarks(/folders)` ＋ ローカル grep 絞り込み |
| DM | `dm-check <username>` / `dm-history` | `GET /2/dm_events`（取得のみ）|
| 埋め込み | `embed <url-or-id>` | oEmbed API（`publish.twitter.com/oembed`・認証不要・無料・ローカルキャッシュ）|

**投稿系のポイント**: テキスト・返信・引用（`quote_tweet_id`）投稿は実装済み。**メディア添付・投票・スレッド連投・削除は非対応**。

---

## 2. 不足機能一覧（優先度順）

> 「規模」列 = 実装工数の目安（S=数時間 / M=1日前後 / L=数日。chunked upload や状態管理を伴うものは L）。

### 🔴 優先度【高】— 普段使い or smart-social の中核機能で未実装

| # | 不足機能 | X API | 規模 | なぜ高優先 | 認証 |
|---|---|---|:--:|---|---|
| H1 | **メディアアップロード + メディア付き投稿** | `POST /2/media/upload`（chunked + alt text）→ `POST /2/tweets` の `media.media_ids` | **L** | smart-social の投稿機能の中核（画像/動画なし投稿はSNS運用で致命的）。x-tweet でも画像添付ニーズあり。**現状 post はテキストのみ** | OAuth1.0a / OAuth2(media.write) |
| H2 | **リスト取得系**（owned_lists / list tweets / members）| `GET /2/users/:id/owned_lists` / `GET /2/lists/:id/tweets` / `GET /2/lists/:id/members` | **M** | smart-social の引用エンゲージメント自動化が「Xリスト由来の対象収集」を前提（`app/api/quote-target-sources/lists` で owned_lists を直叩き中）。CLI からのリスト運用も未対応 | Bearer / OAuth |
| H3 | **followers 取得** | `GET /2/users/:id/followers` | **S** | `following` はあるが `followers` がない。普段使いのフォロワー棚卸しに加え、smart-social でもフォロワー流入分析・引用エンゲージメント対象の発見に使える対の機能。実装容易 | Bearer / OAuth |
| H4 | **ツイート削除** | `DELETE /2/tweets/:id` | **S** | 誤投稿・予約投稿の取り消しに必須級。投稿できて消せないのは運用上の片肺。最小実装で安全性が上がるため**最初に着手推奨** | OAuth |

### 🟡 優先度【中】— あると効率化・運用幅が広がる

| # | 不足機能 | X API | 規模 | 用途 | 認証 |
|---|---|---|:--:|---|---|
| M1a | **公開メトリクス一括取得**（最大100件）| `GET /2/tweets?ids=...&tweet.fields=public_metrics` | **S** | smart-social のスケジューラは投稿後メトリクスを1件ずつ取得中。一括化でレート消費・往復を削減 | Bearer / OAuth |
| M1b | **非公開メトリクス取得**（impression / engagement 等）| `GET /2/tweets/:id?tweet.fields=non_public_metrics,organic_metrics` | **S** | 自分の投稿の表示回数・エンゲージメント率の取得。※ **Basic+ ティア限定の可能性（要確認）**。M1a とは性質・ティアが異なるため分離 | OAuth(自分の投稿のみ) |
| M2 | **ツイートカウント** | `GET /2/tweets/counts/recent` | **S** | キーワードの言及量トラッキング（リサーチ・トレンド把握）| Bearer |
| M3 | **DM送信** | `POST /2/dm_conversations/.../messages` | **M** | `dm_events` 取得はあるが送信がない。アウトバウンド運用に欠ける。※ smart-social の引用エンゲージメント後のフォローアップ手段として需要が顕在化すれば**高に格上げ余地** | OAuth |
| M4 | **ブックマーク作成/削除** | `POST` / `DELETE /2/users/:id/bookmarks` | **S** | 取得（read）のみ実装。あとで読む運用の write 側が欠ける | OAuth2(bookmark.write) |
| M5 | **投票（poll）投稿** | `POST /2/tweets` の `poll`（options + duration_minutes）| **S** | エンゲージメント施策の定番。post の payload に未対応 | OAuth |
| M6 | **スレッド連投（投稿）** | `POST /2/tweets` を、直前ツイートIDを body の `reply.in_reply_to_tweet_id` に指定して連鎖呼び出し | **M** | `thread` は取得専用。長文を分割連投する投稿側がない | OAuth |
| M7 | **ユーザー検索** | `GET /2/users/search` | **S** | ハンドル不明時の探索。※ **ティア制約要確認（Basic+ 限定の可能性）** | Bearer / OAuth |

### 🟢 優先度【低】— ティア制約が重い / ニーズが薄い

| # | 不足機能 | X API | なぜ低優先 | 認証 |
|---|---|---|---|---|
| L1 | いいね / リツイート（作成・取消）| `POST /2/users/:id/likes` 等 | **Enterprise 限定とされる（要確認・$42k/月級）**。コスト的に非現実的 | OAuth |
| L2 | フォロー / アンフォロー操作 | `POST /2/users/:id/following` | 同上 **Enterprise 限定とされる（要確認）** | OAuth |
| L3 | ミュート / ブロック | `POST /2/users/:id/muting` 等 | 自動化ニーズが薄い。手動UIで足りる | OAuth |
| L4 | Full Archive Search（全期間検索）| `GET /2/tweets/search/all` | **Pro+ 限定**。recent(7日)で日常運用は足りる | Bearer |
| L5 | Filtered / Sampled Stream | `GET /2/tweets/search/stream` 等 | **Pro+ 限定** かつ常駐プロセスが必要。CLI 向きでない | Bearer |
| L6 | Note Tweet（長文投稿）| `POST /2/tweets`（card系）| 仕様が流動的・需要限定 | OAuth |
| L7 | Trends / Spaces / Communities | `GET /2/trends/...` 等 | 仕様未確定領域。優先度低 | Bearer / OAuth |

---

## 3. 優先度判断の根拠と注記

### 普段使い（CLIスキル）の依存実態
- 最頻出は `ask`（Grok）。次いで `search` / `user` / `thread` / `tweet`（いずれも**取得系**で実装済み）。
- 投稿系は `x-tweet` / `x-quote` が `post` / `reply` / 引用を使用 → **引用投稿は実装済みで充足**。残る投稿ニーズは**メディア添付（H1）**。
- `bizreach` は xai-cli を使わず Playwright ベース（X API 依存なし）。

### smart-social の依存実態（重要な注記）
- smart-social は Next.js Web アプリのため**アーキ上 CLI（xai-cli）を直接呼ばず**、`lib/x/`・`app/api/x/` で X API を**自前で直叩き**している。
- したがって「smart-social が直叩きしている＝xai-cli の欠落」とは限らない（Webアプリが CLI を呼ばないのは当然）。
- ただし**どの X API 機能を実運用で必要としているか**は優先度の有力な参考になる。実際に直叩きしている機能のうち、xai-cli にも無いもの = **メディアアップロード（H1）** と **owned_lists / リスト系（H2）** が該当し、両者を【高】に置いた根拠となっている。
- 一方 `public_metrics` 付きユーザー取得・引用投稿（`quote_tweet_id`）は xai-cli に既にあり、機能カテゴリとしては充足している。

### ティア制約（2026年・要 Developer Portal 確認）
- X API は2026年に新規 Free 廃止 → Pay-per-use 中心とされる。**いいね/RT/フォロー操作は Enterprise 限定**、**全期間検索・ストリームは Pro+ 限定**、**user search / 非公開メトリクスは Basic+ 限定の可能性**。これらは実装してもアカウントのティア次第で使えないため低優先・要確認とした。

---

## 4. 推奨アクション（実装順の提案）

| 順 | 項目 | 規模 | 理由 |
|:--:|---|:--:|---|
| 1 | **H4 ツイート削除** | S | 最小実装で運用安全性が大きく上がる（投稿の対）|
| 2 | **H3 followers 取得** | S | H4 と同じく小さく、`following` の対で実装容易。先に低コスト施策を消化 |
| 3 | **H2 リスト取得系** | M | owned_lists / list tweets で引用対象収集を CLI 側でも完結可能に |
| 4 | **H1 メディアアップロード + メディア付き投稿** | L | chunked upload のコストは高いが SNS 運用の中核。smart-social とも共通価値 |
| 5+ | 中優先（M1a 一括取得 → M3 DM送信 → M5/M6 投稿拡張）| S〜M | 需要に応じて |

> 補足: H1 は規模 L のため、H4/H3（S）→ H2（M）で素早く価値を出してから腰を据えて着手する順が現実的。

---

## 修正履歴

| 日時 | 内容 |
|------|------|
| 2026-06-13 | 初版作成（X API v2 カタログ × xai-cli 実装の突き合わせ、普段使い・smart-social 軸で優先度付け）|
| 2026-06-13 | ピアレビュー反映: 実装済み表に `profile get` / `banner` 群を追加・`grep`を`bookmarks`配下に訂正・`embed`をoEmbed明記、各表に規模(S/M/L)列追加、M1を公開/非公開メトリクスに分割、tier記述に要確認注記、推奨アクションを工数考慮の順に再構成 |
