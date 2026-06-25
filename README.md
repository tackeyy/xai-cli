**English** | [日本語](README.ja.md)

# xai-cli

A CLI tool wrapping the xAI API (Grok) `x_search` tool and X API v2. Easily search, analyze, post, and manage profiles on X (Twitter).

## Features

- Keyword search and LLM summarization via xAI (Grok) `x_search`
- Structured data retrieval via direct X API v2 calls (Bearer / OAuth1 / OAuth2 User tokens as appropriate)
- Image and screenshot OCR via Grok Vision
- Tweet posting, replies, thread posting, media attachments, and poll creation
- Followers / following lists, Lists operations, and bookmark management
- DM send/receive, mute / block operations (with dry-run safety confirmation)
- Trends, Spaces, and full-archive search (tier restrictions apply)

## Quick Start

```bash
git clone https://github.com/tackeyy/xai-cli.git
cd xai-cli
npm install
npm run build
npm link
```

## Environment Variables

### xAI API (for search commands)

```bash
export XAI_API_KEY="your-xai-api-key"
```

### X API OAuth 1.0a (for reply / post / post-thread / delete / update-profile / home-timeline commands)

```bash
export X_API_KEY="your-x-api-key"
export X_API_SECRET="your-x-api-secret"
export X_ACCESS_TOKEN="your-x-access-token"
export X_ACCESS_TOKEN_SECRET="your-x-access-token-secret"
```

### X API Bearer Token (for following / followers / timeline / tweet --raw, etc.)

```bash
export X_BEARER_TOKEN="your-bearer-token"
```

### X API OAuth 2.0 User Token (for bookmarks / dm-send / mute / block commands)

```bash
export X_OAUTH2_USER_TOKEN="your-oauth2-user-token"
# Optional: skip the /2/users/me API call
export X_OAUTH2_USER_ID="your-user-id"
```

### API Base URL (optional)

```bash
# Default: https://api.twitter.com
export X_API_BASE_URL="https://api.x.com"
```

## Commands

### Authentication Test

```bash
xai auth test
```

### Keyword Search

```bash
xai search "M&A AI"
xai search "M&A AI" --from 2026-03-01 --to 2026-03-22
xai search "AI" --exclude spammer1,spammer2
xai search "AI accounting" --count 100

# Get raw response from X API v2
xai search "AI" --raw
```

`--count N` sets the target number of results passed as a prompt to xAI `x_search` (max 1000).

### Fetch User Posts

```bash
xai user elonmusk
xai user @elonmusk --from 2026-03-01
xai user @elonmusk --count 100
xai --json user @elonmusk
```

`user` appends a `profile` field to JSON output when `X_BEARER_TOKEN` is available.

### DM Receivability Check

```bash
xai dm-check @maroncat11
xai --json dm-check @maroncat11
```

`dm-check` uses the X API v2 `receives_your_dm` / `connection_status` / `protected` fields to pre-check whether the authenticated user can send a DM to the target account. Requires `X_BEARER_TOKEN`.

### User Timeline (Structured)

```bash
# Specify by handle
xai timeline @elonmusk

# Paginate up to 100 results
xai timeline @elonmusk --count 100

# Specify fields
xai timeline @elonmusk --tweet-fields created_at,public_metrics

# JSON output
xai --json timeline @elonmusk --count 100
```

### Home Timeline

```bash
# Home timeline for the authenticated user (chronological, all follows)
xai home-timeline

# Exclude retweets and replies
xai home-timeline --exclude retweets,replies

# JSON output
xai --json home-timeline
```

> **Note**: Requires OAuth1.0a authentication (userId is resolved automatically from `X_ACCESS_TOKEN`).

### Mentions

```bash
# List mentions for the authenticated user (latest first)
xai mentions @yourhandle

# Specify max results
xai mentions @yourhandle --max-results 50 --count 200

# Retrieve next page using a pagination token
xai mentions @yourhandle --pagination-token <token>

# JSON output
xai --json mentions @yourhandle
```

> **Note**: `mentions` requires `X_BEARER_TOKEN` (default) or OAuth1.0a (`--auth oauth1`).

### Following List

```bash
xai following @zeimu_ai
xai following @zeimu_ai --all
xai following @zeimu_ai --user-fields description,public_metrics
xai --json following @zeimu_ai
```

### Followers List

```bash
xai followers @zeimu_ai
xai followers @zeimu_ai --all
xai followers @zeimu_ai --user-fields description,public_metrics
xai --json followers @zeimu_ai
```

### Lists Operations

```bash
# Get lists owned by a user
xai lists @elonmusk
xai --json lists @elonmusk

# Get tweets from a list
xai list-tweets 1234567890123456789
xai list-tweets 1234567890123456789 --max-results 50
xai --json list-tweets 1234567890123456789

# Get members of a list
xai list-members 1234567890123456789
xai --json list-members 1234567890123456789
```

### Batch Tweet Lookup

```bash
# Specify multiple IDs separated by spaces (max 100)
xai tweets 111111111 222222222 333333333

# Comma-separated string is also accepted
xai tweets 111111111,222222222,333333333

# JSON output
xai --json tweets 111111111 222222222
```

### Tweet Counts

Retrieve the number of matching tweets over time for the last 7 days.

```bash
# Daily counts (default)
xai counts "AI accounting"

# Hourly granularity
xai counts "ChatGPT" --granularity hour

# Specify a time range
xai counts "M&A" --from 2026-06-01T00:00:00Z --to 2026-06-07T00:00:00Z

# JSON output
xai --json counts "AI accounting"
```

### User Search

```bash
xai user-search "AI startup"
xai user-search "zeimu" --max-results 10
xai --json user-search "M&A"
```

> **Note**: Requires **User Context authentication** (OAuth 1.0a or OAuth 2.0 User Context). App-only Bearer returns 403 — the 403 is caused by the auth method, **not** the tier (verified 2026-06, see [#22](https://github.com/tackeyy/xai-cli/issues/22)).

### Full-Archive Tweet Search

```bash
xai search-all "M&A AI" --from 2023-01-01T00:00:00Z --to 2023-12-31T23:59:59Z
xai search-all "OpenAI" --max-results 100
xai --json search-all "AI accounting"
```

> **Note**: Verified working in 2026-06 on the current account. Often documented as **Pro+ tier (Academic Research access)**, but the hard requirement is relaxed here based on the live check (X API tiers change frequently — confirm in the Developer Portal).

### Trends

```bash
# Japan trends (WOEID: 23424856)
xai trends 23424856

# Tokyo trends (WOEID: 1118370)
xai trends 1118370

# JSON output
xai --json trends 23424856
```

> **Note**: Verified working in 2026-06 (retrieved 20 Japan trends). Endpoint specification is still in flux and may change in the future.

### Twitter Spaces Search

```bash
xai spaces "AI accounting"
xai spaces "startup" --max-results 20
xai --json spaces "M&A"
```

> **Note**: Verified working in 2026-06 (retrieved 41 results). Endpoint specification is still in flux and may change in the future.

### Fetch Tweet by URL

```bash
# Via LLM (text summary only)
xai tweet "https://x.com/elonmusk/status/123456789"

# Direct X API v2 call (structured JSON)
xai tweet "https://x.com/elonmusk/status/123456789" --raw --json

# Media/quote investigation preset
xai tweet "https://x.com/elonmusk/status/123456789" --raw --preset media --json

# Human-readable structure summary for uploaded media and quoted tweets
xai tweet "https://x.com/elonmusk/status/123456789" --inspect
xai --json tweet "https://x.com/elonmusk/status/123456789" --inspect

# Non-public metrics (own tweets only, requires OAuth1, requires Basic+)
# Retrieves non-public metrics such as impression counts
xai tweet 1234567890123456789 --raw --metrics
```

`--preset media` expands the X API lookup fields needed for attached media, media
variants, entities, and quoted tweets. `--inspect` uses the same preset and
returns a normalized summary such as `uploaded_video_with_quoted_tweet` without
downloading media files.

### Image OCR / Vision Analysis (--image)

```bash
xai tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
xai --json tweet "https://x.com/yonkuro_svc/status/2059579175858827763" --image
```

**Required environment variables:**

| Variable | Purpose |
|---|---|
| `XAI_API_KEY` | Text retrieval + Vision analysis (required) |
| `X_BEARER_TOKEN` | Fetch image URLs via X API v2 (optional) |

When `X_BEARER_TOKEN` is not set, image retrieval is skipped and only text output is returned.

### Thread Retrieval (X API v2)

```bash
xai thread 1234567890123456789 --json
xai thread "https://x.com/foo/status/1234567890" --json
xai thread 1234567890 --all --json
```

### General Prompt

```bash
xai ask "What are the latest trends in AI startups?"
xai ask "query" --allow user1,user2 --from 2026-01-01
```

### Reply to a Tweet

```bash
xai reply 1234567890123456789 "Great article!"
xai reply --dry-run 1234567890123456789 "Great article!"
```

### Post a Tweet

```bash
# Text only
xai post --text "Today's insight"

# With URL attachment
xai post --text "New article" --url "https://example.com/"

# Post as a reply
xai post --text "Thank you!" --reply-to 1234567890123456789

# Quote tweet
xai post --text "Interesting!" --quote-tweet-id 1234567890123456789

# Dry-run (verify payload without actually posting)
xai post --dry-run --text "Check" --url "https://example.com"

# JSON output (for use in automation scripts)
xai --json post --text "hi"
```

**Character count**: URLs are always counted as 23 characters (t.co shortening assumed). Japanese characters and emoji count as 2 per character (Twitter official weighted counting). Default limit is 280 weighted chars (can be changed with `XAI_MAX_TWEET_LENGTH` or `--max-length`).

### Post Tweet with Media

```bash
# Attach a single image
xai post --text "Screenshot" --media /path/to/image.png

# Attach multiple files (up to 4)
xai post --text "Photo collection" --media img1.jpg img2.jpg img3.jpg

# With alt text
xai post --text "Chart" --media chart.png --alt-text "AI market growth chart"

# Dry-run
xai post --dry-run --text "test" --media /path/to/image.png
```

### Post Tweet with Poll

```bash
# 2-choice poll (default: 1440 minutes = 24 hours)
xai post --text "Which do you prefer?" --poll "TypeScript" "Python"

# 4-choice, 12 hours
xai post --text "Favorite language?" --poll "TS" "Python" "Rust" "Go" --poll-duration 720

# Dry-run
xai post --dry-run --text "test poll" --poll "Yes" "No"
```

### Post a Thread

```bash
# Dry-run (recommended)
xai post-thread "First tweet" "Continuation..." "Summary" --dry-run

# Actually post
xai post-thread "First tweet" "Continuation..." "Summary"
```

> **Note**: Recommended to use `--dry-run` first since this posts multiple tweets in sequence.

### Delete a Tweet

```bash
# Dry-run (recommended)
xai delete 1234567890123456789 --dry-run

# Actually delete
xai delete 1234567890123456789
```

> **Note**: Recommended to use `--dry-run` first as this is a destructive operation.

### Send a DM

```bash
# Dry-run (recommended)
xai dm-send @username "Hello" --dry-run

# Send with OAuth2 user token (default)
xai dm-send @username "Hello"

# Send with OAuth1
xai dm-send @username "Hello" --auth oauth1
```

### DM History

```bash
xai dm-history
xai dm-history --max-results 50
xai dm-history --dm-conversation-id conv_id
```

> **Note**: Requires OAuth1.0a + Elevated / paid tier.

### Mute / Block Operations

> **Currently only `--dry-run` is supported** (actual operations are on hold for safety). `--dry-run` is a required option.

```bash
xai mute @username --dry-run
xai unmute @username --dry-run
xai block @username --dry-run
xai unblock @username --dry-run
```

### Bookmark Operations

```bash
# List bookmarks
xai bookmarks list
xai bookmarks list --all --max-results 100

# List folders
xai bookmarks folders

# Bookmarks in a specific folder
xai bookmarks folder 1146654567674912769

# Search bookmarks (client-side filtering)
xai bookmarks grep "tax firm" --all --ignore-case
xai bookmarks grep "AI" --field text --plain-pattern

# Add bookmark (dry-run recommended)
xai bookmarks add 1234567890123456789 --dry-run
xai bookmarks add 1234567890123456789

# Remove bookmark (dry-run recommended)
xai bookmarks remove 1234567890123456789 --dry-run
xai bookmarks remove 1234567890123456789
```

### Update Profile

```bash
xai update-profile --bio "Former CTO / Executive. Rebuilding the company with AI."
xai update-profile --name "Your Name" --url "https://example.com" --location "Tokyo"
xai update-profile --dry-run --bio "test"
```

### Profile Banner Operations

```bash
xai banner get
xai banner get --handle @elonmusk --save banner.jpg
xai banner set /path/to/banner.jpg
xai banner set /path/to/banner.jpg --dry-run
xai banner backup
xai banner backup --dir /path/to/backup/dir

# Restore from backup (alias for set)
xai banner restore /path/to/banner-backup.jpg
xai banner restore /path/to/banner-backup.jpg --dry-run

xai banner remove --dry-run
```

### Get Profile Information

```bash
xai profile get @elonmusk
xai --json profile get @elonmusk
```

### Fetch Post via oEmbed

```bash
xai embed "https://x.com/elonmusk/status/123456789"
xai embed 123456789 --format md
xai embed 123456789 --theme dark --lang en
```

### Output Format

```bash
xai --json search "AI"    # JSON output
xai --plain search "AI"   # Plain text output
xai search "AI"           # Human-readable (default)
```

### Local Skill Compatibility Contract

Local X-related skills use `xai` as their only X / xAI API boundary. If a skill needs a missing endpoint, option, JSON field, or trace capability, add it to `xai-cli` first instead of adding `curl`, direct HTTP, or one-off scripts to the skill.

Keep these commands and options backward compatible for skill users:

- `xai ask`, `xai search`, `xai tweet`, `xai tweet --raw --json`, `xai thread --json`, `xai user`
- `--from`, `--to`, `--allow`, `--exclude`, `--json`, `--plain`, `--raw`, `--auth`
- `--trace-jsonl`, `--trace-dir`, `--trace-response`, `--no-trace-redact-prompts`

Minimum smoke checks before changing CLI behavior:

```bash
xai ask "test" --from 2026-06-01 --to 2026-06-24
xai search "AI" --json
xai tweet "https://x.com/{user}/status/{id}" --raw --json
xai thread "{tweetId}" --json
xai user "{handle}" --from 2026-06-01
xai ask "test" --trace-jsonl --trace-dir /tmp/xai-trace --trace-response
```

## Intentionally Unimplemented Features

The following features are intentionally not implemented.

| Feature | Reason |
|---|---|
| Like / Unlike | Enterprise tier only as of 2026 ($42,000+/month). Not practical to test. |
| Retweet / Unretweet | Same (Enterprise only) |
| Follow / Unfollow | Same (Enterprise only) |
| Filtered Stream | Pro+ tier only and requires a long-running process. Incompatible with single-invocation CLI design. |
| Sampled Stream | Same |
| Note Tweet (long-form posts) | X API specification is in flux and not yet finalized. |

> `mute` / `block` / `unmute` / `unblock` are implemented, but in the current version only `--dry-run` is functional (actual operations are on hold pending safety confirmation).

## Configuration

See the [Environment Variables](#environment-variables) section for detailed configuration.

## Architecture

```
src/
  cli/index.ts          # CLI entry point (commander)
  lib/client.ts         # XaiClient (xAI API wrapper)
  lib/twitter-client.ts # TwitterClient (X API v2 wrapper)
  lib/twitter-types.ts  # X API type definitions
  lib/types.ts          # Common type definitions
  lib/retry.ts          # Retry logic (429/5xx)
  lib/tweet-length.ts   # Tweet character count (weighted)
  __tests__/            # Test files
```

## Contributing

Contributions are welcome. Before making changes, please open an issue first to discuss the proposal.

```bash
git clone https://github.com/tackeyy/xai-cli.git
cd xai-cli
npm install
npm test
```

## License

[MIT](LICENSE)
