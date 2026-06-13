# X API Gap Analysis

xai-cli が対象とする X API v2 エンドポイントの実装状況を追跡するドキュメント。

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
| L1-2 | GET /2/tweets/search/all | 🔒 実装済み | `search-all` | **Pro+ ティア必須**。低ティアは 403 |
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
| L2-2 | GET /2/users/search | 🔒 実装済み | `user-search <query>` | **Basic+ ティアが必要な可能性** |
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
| L4-1 | GET /2/tweets/search/all | 🔒 実装済み | `search-all <query>` | **Pro+ ティア必須** |

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
| L7-1 | GET /2/trends/by/woeid/:woeid | ✅ 実装済み | `trends <woeid>` | **エンドポイント仕様が流動的・ティア制約の可能性** |
| L7-2 | GET /2/spaces/search | ✅ 実装済み | `spaces <query>` | **エンドポイント仕様が流動的・ティア制約の可能性** |

## M: 書き込み / 投稿系

| # | エンドポイント / 機能 | ステータス | コマンド | 備考 |
|---|---|---|---|---|
| M1 | POST /2/tweets | ✅ 実装済み | `post`, `reply`, `post-thread` | OAuth1 必須 |
| M1a | POST /2/tweets（メディア添付） | ✅ 実装済み | `post --media <path...>` | `--alt-text` も対応 |
| M1b | POST /2/tweets（投票） | ✅ 実装済み | `post --poll <opt...>` | `--poll-duration` で期間指定 |
| M2 | DELETE /2/tweets/:id | ✅ 実装済み | `delete <tweetId>` | `--dry-run` 推奨 |
| M3 | POST /2/dm_conversations/with/:id/messages | ✅ 実装済み | `dm-send <username> <text>` | `--dry-run` 推奨 |
| M4 | POST /2/users/:id/bookmarks | ✅ 実装済み | `bookmarks add <tweetId>` | `--dry-run` 推奨 |
| M4b | DELETE /2/users/:id/bookmarks/:tweet_id | ✅ 実装済み | `bookmarks remove <tweetId>` | `--dry-run` 推奨 |
| M5 | POST /1.1/account/update_profile | ✅ 実装済み | `update-profile` | Elevated+ ティア推奨 |
| M6 | POST /2/tweets（スレッド） | ✅ 実装済み | `post-thread <texts...>` | `--dry-run` 推奨 |
| M7 | GET /2/users/search | 🔒 実装済み | `user-search <query>` | **Basic+ ティアが必要な可能性** |
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

---

## ティア別機能まとめ

| ティア | 利用可能なコマンド（主なもの） |
|---|---|
| Free | `auth test`, `grok`, `ask`, `embed` |
| Basic | `search`, `user`, `tweet`, `timeline`, `following`, `followers`, `profile get`, `bookmarks *`, `post`, `reply`, `delete`, `dm-send`, `dm-check`, `update-profile` など |
| Basic+ (推定) | `user-search`, `tweet --metrics` |
| Pro+ | `search-all`, （`trends` / `spaces` は要確認） |
| Enterprise | いいね / リツイート / フォロー操作（$42,000/月級） |

---

## 修正履歴

| 日時 | 内容 |
|---|---|
| 2026-06-13 | 初版作成 — feat/x-api-full-coverage ブランチの実装内容を元に全エンドポイントを整理 |
