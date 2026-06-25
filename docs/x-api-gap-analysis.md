# X API Gap Analysis / 実装状況と優先度の背景

xai-cli が対象とする X API v2 エンドポイントの**実装状況**（Part A）と、その優先度をどう判断したかの**設計背景**（Part B: 普段使い・smart-social 依存・ティア制約）をまとめたドキュメント。

> ⚠️ ティア要件・課金額は2026年時点の公開情報ベース。X API のティア区分は変動が速いため **X Developer Portal で最終確認を推奨**。

---

# Part A. 実装状況

## ステータス凡例

| 記号 | 意味 |
|---|---|
| ✅ 実装済み | コマンドとして動作する |
| ⚠️ dry-run のみ | --dry-run のみ。実操作は安全確認のため保留 |
| ❌ 未実装 | 実装していない（理由あり） |
| 🔒 ティア制限 | 実装済みだが高ティア限定 |

---

## L1: 読み取り系（Search / Timeline / Lookup）

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L1-1 | GET /2/tweets/search/recent | ✅ 実装済み | `search` (`--raw`), `thread` | Bearer |
| L1-2 | GET /2/tweets/search/all | ✅ 実装済み | `search-all` | **実 API で動作確認済み（2026-06、現アカウントで取得成功）**。Pro+ 必須の断定は緩和（ティア区分は変動する点に留意） |
| L1-3 | GET /2/tweets/:id | ✅ 実装済み | `tweet --raw` | Bearer / OAuth1 |
| L1-4 | GET /2/tweets (bulk lookup) | ✅ 実装済み | `tweets <ids...>` | 最大 100 件 |
| L1-5 | GET /2/tweets/counts/recent | ✅ 実装済み | `counts <query>` | 直近 7 日間 |
| L1-6 | GET /2/users/:id/tweets | ✅ 実装済み | `timeline <user>` | Bearer / OAuth1 |
| L1-7 | GET /2/users/:id/timelines/reverse_chronological | ✅ 実装済み | `home-timeline` | OAuth1 必須 |
| L1-8 | GET /2/users/:id/mentions | ✅ 実装済み | `mentions <user>` | Bearer / OAuth1 |

## L2: ユーザー情報

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L2-1 | GET /2/users/by/username/:username | ✅ 実装済み | `profile get <handle>` | Bearer |
| L2-2 | GET /2/users/search | ⚠️ 実装済み | `user-search <query>` | **認証: User Context 必須**（OAuth 1.0a / OAuth 2.0 User Context）。App-only Bearer は 403（実測 2026-06）。403 はティアでなく認証方式が原因（[#22](https://github.com/tackeyy/xai-cli/issues/22)） |
| L2-3 | GET /2/users/:id/following | ✅ 実装済み | `following <user>` | Bearer / OAuth1 |
| L2-4 | GET /2/users/:id/followers | ✅ 実装済み | `followers <user>` | Bearer / OAuth1 |
| L2-5 | GET /2/users/:id/dm_status | ✅ 実装済み | `dm-check <username>` | Bearer |
| L2-6 | POST /2/users/:id/following | ❌ 未実装 | — | Enterprise 限定（$42k/月級）。動作確認不能 |
| L2-7 | DELETE /2/users/:id/following/:target | ❌ 未実装 | — | 同上 |

## L3: ミュート / ブロック

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L3-1 | POST /2/users/:id/muting | ⚠️ dry-run のみ | `mute <username> --dry-run` | 実操作は保留 |
| L3-2 | DELETE /2/users/:id/muting/:target | ⚠️ dry-run のみ | `unmute <username> --dry-run` | 同上 |
| L3-3 | POST /2/users/:id/blocking | ⚠️ dry-run のみ | `block <username> --dry-run` | 同上 |
| L3-4 | DELETE /2/users/:id/blocking/:target | ⚠️ dry-run のみ | `unblock <username> --dry-run` | 同上 |

## L4: 全期間検索（Pro+）

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L4-1 | GET /2/tweets/search/all | ✅ 実装済み | `search-all <query>` | **実 API で動作確認済み（2026-06）**。Pro+ 必須の断定は緩和 |

## L5: いいね / リツイート（Enterprise 限定）

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L5-1 | POST /2/users/:id/likes | ❌ 未実装 | — | 2026年時点 Enterprise 限定。動作確認不能 |
| L5-2 | DELETE /2/users/:id/likes/:tweet_id | ❌ 未実装 | — | 同上 |
| L5-3 | POST /2/users/:id/retweets | ❌ 未実装 | — | 同上 |
| L5-4 | DELETE /2/users/:id/retweets/:tweet_id | ❌ 未実装 | — | 同上 |

## L6: Stream（Pro+ / 常駐プロセス前提）

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L6-1 | GET /2/tweets/search/stream (Filtered Stream) | ❌ 未実装 | — | Pro+ 限定 + 常駐プロセス前提。CLI（単発実行）と設計が噛み合わない |
| L6-2 | GET /2/tweets/sample/stream (Sampled Stream) | ❌ 未実装 | — | 同上 |

## L7: トレンド / Spaces（仕様流動的）

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| L7-1 | GET /2/trends/by/woeid/:woeid | ✅ 実装済み | `trends <woeid>` | **動作確認済み（2026-06、日本トレンド 20 件取得）**。仕様は流動的なので将来変動の可能性は残る |
| L7-2 | GET /2/spaces/search | ✅ 実装済み | `spaces <query>` | **動作確認済み（2026-06、41 件取得）**。仕様は流動的なので将来変動の可能性は残る |

## M: 書き込み / 投稿系

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| M1 | POST /2/tweets | ✅ 実装済み | `post`, `reply`, `post-thread` | OAuth1 必須 |
| M1a | POST /2/tweets（メディア添付） | ✅ 実装済み | `post --media <path...>` | `--alt-text` は `POST /2/media/metadata` で反映（実装済み） |
| M1b | POST /2/tweets（投票） | ✅ 実装済み | `post --poll <opt...>` | `--poll-duration` で期間指定 |
| M2 | DELETE /2/tweets/:id | ✅ 実装済み | `delete <tweetId>` | `--dry-run` 推奨 |
| M3 | POST /2/dm_conversations/with/:id/messages | ✅ 実装済み | `dm-send <username> <text>` | `--dry-run` 推奨 |
| M4 | POST /2/users/:id/bookmarks | ✅ 実装済み | `bookmarks add <tweetId>` | `--dry-run` 推奨 |
| M4b | DELETE /2/users/:id/bookmarks/:tweet_id | ✅ 実装済み | `bookmarks remove <tweetId>` | `--dry-run` 推奨 |
| M5 | POST /1.1/account/update_profile | ✅ 実装済み | `update-profile` | Elevated+ ティア推奨 |
| M6 | POST /2/tweets（スレッド） | ✅ 実装済み | `post-thread <texts...>` | `--dry-run` 推奨 |
| M7 | GET /2/users/search | ⚠️ 実装済み | `user-search <query>` | **認証: User Context 必須**。App-only Bearer は 403（実測 2026-06）。403 はティアでなく認証方式が原因（[#22](https://github.com/tackeyy/xai-cli/issues/22)） |
| M8 | Note Tweet（長文投稿） | ❌ 未実装 | — | API 仕様が流動的・未確定のため見送り |

## D: DM / メッセージ系

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| D1 | GET /2/users/by/username (dm_status) | ✅ 実装済み | `dm-check <username>` | Bearer |
| D2 | POST /2/dm_conversations/with/:id/messages | ✅ 実装済み | `dm-send <username> <text>` | `--dry-run` 推奨 |
| D3 | GET /2/dm_events | ✅ 実装済み | `dm-history` | OAuth1 + Elevated+ 必要 |

## B: ブックマーク系

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| B1 | GET /2/users/:id/bookmarks | ✅ 実装済み | `bookmarks list` | OAuth2 User Token 必須 |
| B2 | POST /2/users/:id/bookmarks | ✅ 実装済み | `bookmarks add <tweetId>` | `--dry-run` 推奨 |
| B3 | DELETE /2/users/:id/bookmarks/:tweet_id | ✅ 実装済み | `bookmarks remove <tweetId>` | `--dry-run` 推奨 |
| B4 | GET /2/users/:id/bookmarks/folders | ✅ 実装済み | `bookmarks folders` | OAuth2 User Token 必須 |
| B5 | GET /2/users/:id/bookmarks (folder filter) | ✅ 実装済み | `bookmarks folder <id>` | OAuth2 User Token 必須 |
| B6 | クライアント側フィルタリング | ✅ 実装済み | `bookmarks grep <pattern>` | regex / plain pattern 対応 |

## Lists 系

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| Ls1 | GET /2/users/:id/owned_lists | ✅ 実装済み | `lists <user>` | Bearer / OAuth1 / OAuth2 User |
| Ls2 | GET /2/lists/:id/tweets | ✅ 実装済み | `list-tweets <listId>` | Bearer / OAuth1 / OAuth2 User |
| Ls3 | GET /2/lists/:id/members | ✅ 実装済み | `list-members <listId>` | Bearer / OAuth1 / OAuth2 User |

## メディアアップロード

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| Md1 | POST /2/media/upload/{initialize,{id}/append,{id}/finalize} | ✅ 実装済み | `post --media <path...>` 経由 | v2 **dedicated endpoints** で実装（command 方式は deprecated のため移行済み）。対応拡張子は `jpg`/`jpeg`/`jpe`/`jfif`/`jif`/`jfi`/`png`/`webp`/`gif`/`mp4`/`mov`。STATUS 相当のポーリングは動画/GIF のみ。alt-text は `POST /2/media/metadata` |

---

## ティア別機能まとめ

| ティア | 利用可能なコマンド（主なもの） |
|---|---|
| Free | `auth test`, `ask`, `embed` |
| Basic | `search`, `user`, `tweet`, `timeline`, `following`, `followers`, `profile get`, `bookmarks *`, `post`, `reply`, `delete`, `dm-send`, `dm-check`, `update-profile` など |
| Basic+ | `tweet --metrics`（自分の投稿の非公開メトリクス・未検証） |
| Pro+ | `search-all`（2026-06 実測で動作確認済み・断定は緩和） |
| 認証方式の制約 | `user-search` は User Context 必須（Bearer 不可・ティアではなく認証方式） |
| 動作確認済み（2026-06） | `search-all` / `trends` / `spaces`（仕様は流動的） |
| Enterprise | いいね / リツイート / フォロー操作（$42,000/月級・未実装） |

---

# Part B. 設計判断の背景（優先度の根拠）

> 実装前に「何を優先するか」を ①瀧田の普段使い（`x-search` / `x-quote` / `x-tweet` 等の CLI スキル）と ②`~/dev/smart-social`（X運用SaaS / 引用エンゲージメント自動化）の両軸で判断した記録。Part A の実装は、この優先度に沿って進めた。

## 優先度の分類（実装前のギャップ）

実装着手時点で不足していた機能を、以下の優先度で分類した。

**🔴 高優先**: H1 メディア投稿（規模L）/ H2 リスト取得（M）/ H3 followers（S）/ H4 削除（S）
→ smart-social の中核（メディア投稿・リスト由来の対象収集）と普段使いの基本（削除・フォロワー棚卸し）。すべて Part A で実装済み。

**🟡 中優先**: M1a 一括取得 / M1b 非公開メトリクス / M2 カウント / M3 DM送信 / M4 ブックマーク write / M5 投票 / M6 スレッド連投 / M7 ユーザー検索
→ 効率化・運用幅の拡張。すべて実装済み（書き込み系は dry-run）。

**🟢 低優先**: L3 ミュート/ブロック / L4 全期間検索 / L7 trends・spaces は実装。L1 いいね/RT・L2 フォロー操作・L5 Stream・L6 Note Tweet は未実装（下記理由）。

## 普段使い（CLIスキル）の依存実態
- 最頻出は `ask`（Grok）。次いで `search` / `user` / `thread` / `tweet`（いずれも取得系で実装済み）。
- 投稿系は `x-tweet` / `x-quote` が `post` / `reply` / 引用を使用 → 引用投稿は元から充足。残る投稿ニーズはメディア添付（H1）で、本実装で解消。
- `bizreach` は xai-cli を使わず Playwright ベース（X API 依存なし）。

## smart-social の依存実態
- smart-social は Next.js Web アプリのため**アーキ上 CLI（xai-cli）を直接呼ばず**、`lib/x/`・`app/api/x/` で X API を自前で直叩きしている。
- したがって「smart-social が直叩き＝xai-cli の欠落」とは限らない（Webアプリが CLI を呼ばないのは当然）。
- ただし**どの X API 機能を実運用で必要としているか**は優先度の有力な参考になる。実際に直叩きしている機能のうち xai-cli にも無かったもの = メディアアップロード（H1）と owned_lists / リスト系（H2）であり、両者を【高】に置いた根拠となった。

## ティア制約と未実装の判断（2026年・要 Developer Portal 確認）
- X API は2026年に新規 Free 廃止 → Pay-per-use 中心。**いいね/RT/フォロー操作は Enterprise 限定**（$42k/月級で動作確認不能）→ 未実装。
- **Filtered/Sampled Stream は Pro+ 限定かつ常駐プロセス前提** → CLI（単発実行）と設計が噛み合わず未実装。
- **Note Tweet は API 仕様が流動的・未確定** → 見送り。
- **実 API 疎通確認（2026-06）の実測**: `search-all` / `trends` / `spaces` は現アカウントで動作確認済み（Pro+ 断定は緩和）。`user-search` の 403 は**ティアでなく認証方式**（User Context 必須・Bearer 不可、[#22](https://github.com/tackeyy/xai-cli/issues/22)）。`tweet --metrics`（Basic+・自分の投稿のみ）は未検証。

---

<a id="残タスク"></a>
## 残タスク / 既知の制約

| # | 項目 | 内容 |
|---|---|---|
| T1 | ~~alt-text のメタデータ反映~~ | ✅ 完了（#24）。`uploadMedia` 後に `POST /2/media/metadata` を呼び alt_text を反映 |
| T2 | ~~メディアアップロードの新方式移行~~ | ✅ 完了（#25）。dedicated endpoints（`/2/media/upload/initialize`・`/{id}/append`・`/{id}/finalize`）へ移行済み |
| T3 | 実 API 疎通確認 | ✅ 一部完了（#23）。`search-all` / `trends` / `spaces` は 2026-06 に動作確認済み。`user-search` は認証方式の問題と判明（#22）。`tweet --metrics`(Basic+・自分の投稿のみ) は未検証 |
| T4 | 書き込み系の実操作フロー | `mute`/`block` 等は `--dry-run` 必須。将来実操作を許可するなら `--force` 等のフロー設計が必要 |
| T5 | ティア変更時の再検討 | L1 いいね/RT・L2 フォロー操作・L5 Stream は、アカウントが Enterprise/Pro+ になった場合に実装を再検討 |

---

## 修正履歴

| 日時 | 内容 |
|------|------|
| 2026-06-13 | 初版（ギャップ分析・優先度付け版を main にコミット）と実装状況一覧版（feat/x-api-full-coverage）を別々に作成 |
| 2026-06-14 | 両版を統合（Part A: 実装状況 / Part B: 優先度の背景 / 残タスク）。PR #19 で全優先度の不足機能を実装完了（529テスト緑）。alt-text 等の残タスクを明文化 |
