#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { XaiClient } from "../lib/client.js";
import { TwitterClient, TweetTooLongError } from "../lib/twitter-client.js";
import type { TwitterBookmarkResponse } from "../lib/twitter-types.js";
import { embedCommand } from "./embed.js";
import { computeTweetLength, TWEET_MAX_LENGTH } from "../lib/tweet-length.js";

function createClientFromEnv(): XaiClient {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("Error: XAI_API_KEY environment variable is not set");
    process.exit(1);
  }
  return new XaiClient({ apiKey });
}

function createTwitterClientFromEnv(): TwitterClient {
  return new TwitterClient({
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.X_BEARER_TOKEN,
    oauth2UserToken: process.env.X_OAUTH2_USER_TOKEN,
    baseUrl: process.env.X_API_BASE_URL,
  });
}

function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

function parseCount(value: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed > 1000) {
    throw new InvalidArgumentError("must be between 1 and 1000");
  }
  return parsed;
}

function parseCsv(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function stripAt(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

function buildPostInput(opts: {
  text: string;
  url?: string;
  replyTo?: string;
  maxLength?: number;
  lengthCheck?: boolean;
}): Parameters<TwitterClient["postTweet"]>[0] {
  const input: Parameters<TwitterClient["postTweet"]>[0] = {
    text: opts.text,
    url: opts.url,
    replyTo: opts.replyTo,
  };

  if (opts.maxLength !== undefined) {
    input.maxLength = opts.maxLength;
  }

  if (opts.lengthCheck === false) {
    input.noLengthCheck = true;
  }

  return input;
}

export function createProgram(injectedClient?: XaiClient, injectedTwitterClient?: TwitterClient): Command {
  const program = new Command();

  program
    .name("xai")
    .description("xAI API CLI tool")
    .version("0.1.0")
    .option("--json", "Output in JSON format")
    .option("--plain", "Output in plain text format");

  function getOutputMode(): "json" | "plain" | "human" {
    const opts = program.opts();
    if (opts.json) return "json";
    if (opts.plain) return "plain";
    return "human";
  }

  function getClient(): XaiClient {
    return injectedClient ?? createClientFromEnv();
  }

  function getTwitterClient(): TwitterClient {
    return injectedTwitterClient ?? createTwitterClientFromEnv();
  }

  // --- auth ---
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("test")
    .description("Test authentication with xAI API")
    .action(async () => {
      try {
        const client = getClient();
        const result = await client.authTest();
        const mode = getOutputMode();

        if (mode === "json") {
          jsonOutput(result);
        } else if (mode === "plain") {
          console.log(`${result.ok}\t${result.model}`);
        } else {
          console.log(`Authentication ok (model: ${result.model})`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- search ---
  program
    .command("search <query>")
    .description("Search X posts by keyword")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--exclude <handles>", "Exclude handles (comma-separated)")
    .option("--count <n>", "Target number of posts to collect (1-1000)", parseCount)
    .action(async (query, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.search(query, {
          fromDate: opts.from,
          toDate: opts.to,
          excludeHandles: opts.exclude?.split(","),
          count: opts.count,
        });

        if (mode === "json") {
          jsonOutput(result);
        } else {
          console.log(result.text);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- user ---
  program
    .command("user <handle>")
    .description("Get recent posts from a user")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--count <n>", "Target number of posts to collect (1-1000)", parseCount)
    .action(async (handle, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.getUser(handle, {
          fromDate: opts.from,
          toDate: opts.to,
          count: opts.count,
        });
        let profile: Awaited<ReturnType<TwitterClient["getUserProfileByUsername"]>> | null = null;
        let profileError: string | undefined;
        try {
          profile = await getTwitterClient().getUserProfileByUsername(stripAt(handle));
        } catch (err: any) {
          profileError = err?.message ?? String(err);
        }

        if (mode === "json") {
          jsonOutput({
            ...result,
            profile,
            ...(profileError && { profile_error: profileError }),
          });
        } else {
          if (profile) {
            console.log(`@${profile.username ?? stripAt(handle)}\tfollowers=${profile.followers_count ?? "null"}\tfollowing=${profile.following_count ?? "null"}\tverified=${profile.verified ?? "null"}`);
            if (profile.description) console.log(profile.description);
          }
          console.log(result.text);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- timeline ---
  program
    .command("timeline <user>")
    .description("Get a structured user timeline via X API v2")
    .option("--tweet-fields <csv>", "Tweet fields (comma-separated)", parseCsv)
    .option("--expansions <csv>", "Expansions (comma-separated)", parseCsv)
    .option("--user-fields <csv>", "User fields for expansions (comma-separated)", parseCsv)
    .option("--media-fields <csv>", "Media fields (comma-separated)", parseCsv)
    .option("--max-results <n>", "Max results per page (5-100)", parsePositiveInteger)
    .option("--pagination-token <token>", "Pagination token for single page")
    .option("--count <n>", "Fetch up to N tweets across pages (1-1000)", parseCount)
    .option("--auth <mode>", "Auth mode: bearer | oauth1", "bearer")
    .action(
      async (
        user: string,
        opts: {
          tweetFields?: string[];
          expansions?: string[];
          userFields?: string[];
          mediaFields?: string[];
          maxResults?: number;
          paginationToken?: string;
          count?: number;
          auth?: string;
        },
      ) => {
        try {
          if (opts.count && opts.paginationToken) {
            console.error("Error: --count and --pagination-token cannot be used together");
            process.exit(1);
            return;
          }

          const tc = getTwitterClient();
          const mode = getOutputMode();
          const authMode = (opts.auth === "oauth1" ? "oauth1" : "bearer") as "bearer" | "oauth1";

          let userId: string;
          let resolvedUser: { id: string; username: string; name?: string } | undefined;
          if (isNumericId(user)) {
            userId = user;
          } else {
            const username = stripAt(user);
            const lookup = await tc.getUserByUsername(username, { auth: authMode });
            userId = lookup.data.id;
            resolvedUser = { id: lookup.data.id, username: lookup.data.username ?? username, name: lookup.data.name };
          }

          const baseOpts = {
            tweetFields: opts.tweetFields,
            expansions: opts.expansions,
            userFields: opts.userFields,
            mediaFields: opts.mediaFields,
            maxResults: opts.maxResults,
            auth: authMode,
          };
          const result = opts.count
            ? await tc.getUserTimelineCount(userId, { ...baseOpts, count: opts.count })
            : await tc.getUserTimeline(userId, { ...baseOpts, paginationToken: opts.paginationToken });

          if (mode === "json") {
            jsonOutput({ resolved_user: resolvedUser, ...result });
          } else {
            console.log(`Timeline: ${result.meta?.result_count ?? result.data.length} tweets`);
            formatTimelineOutput(result.data);
            if (result.meta?.next_token) {
              console.log(`\n(next page: --pagination-token ${result.meta.next_token})`);
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  // --- tweet ---
  program
    .command("tweet <url>")
    .description("Get tweet content from URL")
    .action(async (url) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.getTweet(url);

        if (mode === "json") {
          jsonOutput(result);
        } else {
          console.log(result.text);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- ask ---
  program
    .command("ask <prompt>")
    .description("Run a custom prompt with x_search")
    .option("--allow <handles>", "Allowed handles (comma-separated)")
    .option("--exclude <handles>", "Excluded handles (comma-separated)")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .action(async (prompt, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.ask(prompt, {
          allowed_x_handles: opts.allow?.split(","),
          excluded_x_handles: opts.exclude?.split(","),
          from_date: opts.from,
          to_date: opts.to,
        });

        if (mode === "json") {
          jsonOutput(result);
        } else {
          console.log(result.text);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- reply ---
  program
    .command("reply <tweetId> <text>")
    .description("Reply to a tweet by ID")
    .option("--dry-run", "Show what would be posted without actually posting")
    .action(async (tweetId: string, text: string, opts: { dryRun?: boolean }) => {
      try {
        if (opts.dryRun) {
          console.log(`[dry-run] Would reply to tweet ${tweetId}:`);
          console.log(`[dry-run] text: ${text}`);
          return;
        }

        const tc = getTwitterClient();
        const mode = getOutputMode();
        const result = await tc.replyTweet(tweetId, text);

        if (mode === "json") {
          jsonOutput(result);
        } else {
          console.log(`Reply posted (id: ${result.id}): ${result.text}`);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // --- post ---
  program
    .command("post")
    .description("Post a tweet to X (Twitter)")
    .requiredOption(
      "--text <string>",
      `Tweet body (max ${TWEET_MAX_LENGTH} weighted chars by default; override with --max-length or XAI_MAX_TWEET_LENGTH)`,
    )
    .option("--url <string>", "Attach a URL (appended to the end of the body with a newline)")
    .option("--reply-to <tweet-id>", "Reply target tweet ID")
    .option(
      "--max-length <number>",
      `Override the local weighted character limit (default: ${TWEET_MAX_LENGTH})`,
      parsePositiveInteger,
    )
    .option("--no-length-check", "Skip local tweet-length validation")
    .option("--dry-run", "Do not actually post; print the request payload")
    .action(
      async (opts: {
        text: string;
        url?: string;
        replyTo?: string;
        maxLength?: number;
        lengthCheck?: boolean;
        dryRun?: boolean;
      }) => {
        try {
          if (opts.dryRun) {
            const dummy = new TwitterClient({
              apiKey: "dry-run",
              apiSecret: "dry-run",
              accessToken: "dry-run",
              accessTokenSecret: "dry-run",
            });
            const payload = dummy.buildPostPayload(buildPostInput(opts));
            const effectiveMaxLength = opts.lengthCheck === false ? null : (opts.maxLength ?? TWEET_MAX_LENGTH);
            const mode = getOutputMode();
            const summary = {
              dry_run: true,
              weighted_length: computeTweetLength(payload.text),
              max_length: effectiveMaxLength,
              endpoint: "POST https://api.twitter.com/2/tweets",
              payload,
            };
            if (mode === "json") {
              jsonOutput(summary);
            } else {
              console.log(
                effectiveMaxLength === null
                  ? `[dry-run] weighted length: ${summary.weighted_length}/unlimited`
                  : `[dry-run] weighted length: ${summary.weighted_length}/${effectiveMaxLength}`,
              );
              console.log(`[dry-run] endpoint: ${summary.endpoint}`);
              console.log(`[dry-run] payload: ${JSON.stringify(payload, null, 2)}`);
            }
            return;
          }

          const tc = getTwitterClient();
          const mode = getOutputMode();
          const result = await tc.postTweet(buildPostInput(opts));

          if (mode === "json") {
            jsonOutput({
              tweet_id: result.id,
              tweet_url: result.url,
              posted_at: result.posted_at,
              text: result.text,
            });
          } else {
            console.log(`Tweet posted (id: ${result.id})`);
            console.log(result.url);
          }
        } catch (err: any) {
          if (err instanceof TweetTooLongError) {
            console.error(`Error: ${err.message}`);
            process.exit(1);
            return;
          }
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  // --- following ---
  program
    .command("following <user>")
    .description("Get following list of a user")
    .option("--user-fields <csv>", "User fields (comma-separated)", parseCsv)
    .option("--expansions <csv>", "Expansions (comma-separated)", parseCsv)
    .option("--tweet-fields <csv>", "Tweet fields for expansions (comma-separated)", parseCsv)
    .option("--max-results <n>", "Max results per page (1-1000)", parsePositiveInteger)
    .option("--pagination-token <token>", "Pagination token for single page")
    .option("--all", "Fetch all pages")
    .option("--limit-pages <n>", "Max pages when using --all", parsePositiveInteger)
    .option("--auth <mode>", "Auth mode: bearer | oauth1", "bearer")
    .action(
      async (
        user: string,
        opts: {
          userFields?: string[];
          expansions?: string[];
          tweetFields?: string[];
          maxResults?: number;
          paginationToken?: string;
          all?: boolean;
          limitPages?: number;
          auth?: string;
        },
      ) => {
        try {
          if (opts.all && opts.paginationToken) {
            console.error("Error: --all and --pagination-token cannot be used together");
            process.exit(1);
            return;
          }

          const tc = getTwitterClient();
          const mode = getOutputMode();
          const authMode = (opts.auth === "oauth1" ? "oauth1" : "bearer") as "bearer" | "oauth1";

          let userId: string;
          let resolvedUser: { id: string; username: string; name?: string } | undefined;

          if (isNumericId(user)) {
            userId = user;
          } else {
            const username = stripAt(user);
            const lookup = await tc.getUserByUsername(username, { auth: authMode });
            userId = lookup.data.id;
            resolvedUser = { id: lookup.data.id, username: lookup.data.username ?? username, name: lookup.data.name };
          }

          if (opts.all) {
            const result = await tc.getAllFollowing(userId, {
              userFields: opts.userFields,
              expansions: opts.expansions,
              tweetFields: opts.tweetFields,
              maxResults: opts.maxResults,
              limitPages: opts.limitPages,
              auth: authMode,
            });

            if (mode === "json") {
              jsonOutput({ resolved_user: resolvedUser, ...result });
            } else {
              formatFollowingOutput(result.data, result.meta?.result_count ?? 0);
            }
          } else {
            const result = await tc.getFollowing(userId, {
              userFields: opts.userFields,
              expansions: opts.expansions,
              tweetFields: opts.tweetFields,
              maxResults: opts.maxResults,
              paginationToken: opts.paginationToken,
              auth: authMode,
            });

            if (mode === "json") {
              jsonOutput({ resolved_user: resolvedUser, ...result });
            } else {
              formatFollowingOutput(result.data, result.meta?.result_count ?? 0);
              if (result.meta?.next_token) {
                console.log(`\n(next page: --pagination-token ${result.meta.next_token})`);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  // --- bookmarks ---
  const bookmarksCmd = program.command("bookmarks").description("Bookmark commands (requires X_OAUTH2_USER_TOKEN)");

  async function resolveUserId(tc: TwitterClient): Promise<string> {
    const override = process.env.X_OAUTH2_USER_ID;
    if (override) return override;
    const me = await tc.getAuthenticatedUser();
    return me.data.id;
  }

  bookmarksCmd
    .command("list")
    .description("List bookmarks")
    .option("--tweet-fields <csv>", "Tweet fields (comma-separated)", parseCsv)
    .option("--expansions <csv>", "Expansions (comma-separated)", parseCsv)
    .option("--user-fields <csv>", "User fields (comma-separated)", parseCsv)
    .option("--media-fields <csv>", "Media fields (comma-separated)", parseCsv)
    .option("--max-results <n>", "Max results per page (1-100)", parsePositiveInteger)
    .option("--pagination-token <token>", "Pagination token")
    .option("--all", "Fetch all pages")
    .option("--limit-pages <n>", "Max pages when using --all", parsePositiveInteger)
    .action(
      async (opts: {
        tweetFields?: string[];
        expansions?: string[];
        userFields?: string[];
        mediaFields?: string[];
        maxResults?: number;
        paginationToken?: string;
        all?: boolean;
        limitPages?: number;
      }) => {
        try {
          const tc = getTwitterClient();
          const mode = getOutputMode();
          const userId = await resolveUserId(tc);

          if (opts.all) {
            const result = await tc.getAllBookmarks(userId, {
              tweetFields: opts.tweetFields,
              expansions: opts.expansions,
              userFields: opts.userFields,
              mediaFields: opts.mediaFields,
              maxResults: opts.maxResults,
              limitPages: opts.limitPages,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, ...result });
            } else {
              formatBookmarkOutput(result);
            }
          } else {
            const result = await tc.getBookmarks(userId, {
              tweetFields: opts.tweetFields,
              expansions: opts.expansions,
              userFields: opts.userFields,
              mediaFields: opts.mediaFields,
              maxResults: opts.maxResults,
              paginationToken: opts.paginationToken,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, ...result });
            } else {
              formatBookmarkOutput(result);
              if (result.meta?.next_token) {
                console.log(`\n(next page: --pagination-token ${result.meta.next_token})`);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  bookmarksCmd
    .command("folders")
    .description("List bookmark folders")
    .option("--max-results <n>", "Max results per page", parsePositiveInteger)
    .option("--pagination-token <token>", "Pagination token")
    .option("--all", "Fetch all pages")
    .option("--limit-pages <n>", "Max pages when using --all", parsePositiveInteger)
    .action(
      async (opts: {
        maxResults?: number;
        paginationToken?: string;
        all?: boolean;
        limitPages?: number;
      }) => {
        try {
          const tc = getTwitterClient();
          const mode = getOutputMode();
          const userId = await resolveUserId(tc);

          if (opts.all) {
            const result = await tc.getAllBookmarkFolders(userId, {
              maxResults: opts.maxResults,
              limitPages: opts.limitPages,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, ...result });
            } else {
              formatFolderOutput(result.data);
            }
          } else {
            const result = await tc.getBookmarkFolders(userId, {
              maxResults: opts.maxResults,
              paginationToken: opts.paginationToken,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, ...result });
            } else {
              formatFolderOutput(result.data);
              if (result.meta?.next_token) {
                console.log(`\n(next page: --pagination-token ${result.meta.next_token})`);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  bookmarksCmd
    .command("folder <folder-id>")
    .description("Get bookmarks from a specific folder")
    .option("--tweet-fields <csv>", "Tweet fields (comma-separated)", parseCsv)
    .option("--expansions <csv>", "Expansions (comma-separated)", parseCsv)
    .option("--user-fields <csv>", "User fields (comma-separated)", parseCsv)
    .option("--media-fields <csv>", "Media fields (comma-separated)", parseCsv)
    .option("--max-results <n>", "Max results per page (1-100)", parsePositiveInteger)
    .option("--pagination-token <token>", "Pagination token")
    .option("--all", "Fetch all pages")
    .option("--limit-pages <n>", "Max pages when using --all", parsePositiveInteger)
    .action(
      async (
        folderId: string,
        opts: {
          tweetFields?: string[];
          expansions?: string[];
          userFields?: string[];
          mediaFields?: string[];
          maxResults?: number;
          paginationToken?: string;
          all?: boolean;
          limitPages?: number;
        },
      ) => {
        try {
          const tc = getTwitterClient();
          const mode = getOutputMode();
          const userId = await resolveUserId(tc);

          if (opts.all) {
            const result = await tc.getAllBookmarksByFolder(userId, folderId, {
              tweetFields: opts.tweetFields,
              expansions: opts.expansions,
              userFields: opts.userFields,
              mediaFields: opts.mediaFields,
              maxResults: opts.maxResults,
              limitPages: opts.limitPages,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, folder_id: folderId, ...result });
            } else {
              formatBookmarkOutput(result);
            }
          } else {
            const result = await tc.getBookmarksByFolder(userId, folderId, {
              tweetFields: opts.tweetFields,
              expansions: opts.expansions,
              userFields: opts.userFields,
              mediaFields: opts.mediaFields,
              maxResults: opts.maxResults,
              paginationToken: opts.paginationToken,
            });

            if (mode === "json") {
              jsonOutput({ authenticated_user: userId, folder_id: folderId, ...result });
            } else {
              formatBookmarkOutput(result);
              if (result.meta?.next_token) {
                console.log(`\n(next page: --pagination-token ${result.meta.next_token})`);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  bookmarksCmd
    .command("grep <pattern>")
    .description("Search bookmarks by pattern (client-side filtering)")
    .option("--ignore-case", "Case-insensitive matching")
    .option("--field <field>", "Field to search: text | author | url | all", "all")
    .option("--folder-id <id>", "Search within a specific folder")
    .option("--plain-pattern", "Use plain string matching instead of regex")
    .option("--tweet-fields <csv>", "Tweet fields (comma-separated)", parseCsv)
    .option("--expansions <csv>", "Expansions (comma-separated)", parseCsv)
    .option("--user-fields <csv>", "User fields (comma-separated)", parseCsv)
    .option("--max-results <n>", "Max results per page", parsePositiveInteger)
    .option("--all", "Fetch all pages before filtering")
    .option("--limit-pages <n>", "Max pages when using --all", parsePositiveInteger)
    .action(
      async (
        pattern: string,
        opts: {
          ignoreCase?: boolean;
          field?: string;
          folderId?: string;
          plainPattern?: boolean;
          tweetFields?: string[];
          expansions?: string[];
          userFields?: string[];
          maxResults?: number;
          all?: boolean;
          limitPages?: number;
        },
      ) => {
        try {
          const tc = getTwitterClient();
          const mode = getOutputMode();
          const userId = await resolveUserId(tc);

          const defaultExpansions = opts.expansions ?? ["author_id"];
          const defaultUserFields = opts.userFields ?? ["id", "name", "username"];
          const defaultTweetFields = opts.tweetFields ?? ["created_at", "author_id", "text"];

          let source: TwitterBookmarkResponse;

          if (opts.folderId) {
            source = opts.all
              ? await tc.getAllBookmarksByFolder(userId, opts.folderId, {
                  tweetFields: defaultTweetFields,
                  expansions: defaultExpansions,
                  userFields: defaultUserFields,
                  maxResults: opts.maxResults,
                  limitPages: opts.limitPages,
                })
              : await tc.getBookmarksByFolder(userId, opts.folderId, {
                  tweetFields: defaultTweetFields,
                  expansions: defaultExpansions,
                  userFields: defaultUserFields,
                  maxResults: opts.maxResults,
                });
          } else {
            source = opts.all
              ? await tc.getAllBookmarks(userId, {
                  tweetFields: defaultTweetFields,
                  expansions: defaultExpansions,
                  userFields: defaultUserFields,
                  maxResults: opts.maxResults,
                  limitPages: opts.limitPages,
                })
              : await tc.getBookmarks(userId, {
                  tweetFields: defaultTweetFields,
                  expansions: defaultExpansions,
                  userFields: defaultUserFields,
                  maxResults: opts.maxResults,
                });
          }

          const filtered = tc.filterBookmarks(source, pattern, {
            ignoreCase: opts.ignoreCase,
            field: (opts.field ?? "all") as "text" | "author" | "url" | "all",
            plainPattern: opts.plainPattern,
          });

          if (mode === "json") {
            jsonOutput({
              pattern,
              match_count: filtered.meta.result_count,
              ...filtered,
            });
          } else {
            if (filtered.data.length === 0) {
              console.log(`No bookmarks matching "${pattern}"`);
            } else {
              console.log(`${filtered.data.length} bookmarks matching "${pattern}":`);
              formatBookmarkOutput(filtered);
            }
          }
        } catch (err: any) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
      },
    );

  // --- embed ---
  program
    .command("embed <url-or-id>")
    .description("X(Twitter) post を oEmbed API 経由で取得 (認証不要)")
    .option("-f, --format <format>", "出力形式: html | md | text", "html")
    .option("--theme <theme>", "テーマ: light | dark", "light")
    .option("--lang <lang>", "言語コード", "ja")
    .action(async (urlOrId: string, options) => {
      try {
        await embedCommand(urlOrId, options);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  return program;
}

function formatFollowingOutput(data: Array<{ id: string; username?: string; name?: string }>, totalCount: number): void {
  console.log(`Following: ${totalCount} users`);
  for (const user of data) {
    console.log(`@${user.username ?? "?"}\t${user.name ?? ""}\t${user.id}`);
  }
}

function formatBookmarkOutput(result: TwitterBookmarkResponse): void {
  const userMap = new Map<string, { name?: string; username?: string }>();
  if (result.includes?.users) {
    for (const u of result.includes.users) {
      userMap.set(u.id, { name: u.name, username: u.username });
    }
  }

  for (const tweet of result.data) {
    const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
    const authorStr = author ? `@${author.username ?? "?"}` : "";
    const textSnippet = (tweet.text ?? "").slice(0, 100).replace(/\n/g, " ");
    const url = `https://x.com/i/status/${tweet.id}`;
    console.log(`${tweet.id}\t${tweet.created_at ?? ""}\t${authorStr}\t${textSnippet}\t${url}`);
  }
}

function formatTimelineOutput(data: Array<{
  id: string;
  text?: string;
  created_at?: string;
  retweet_count?: number | null;
  reply_count?: number | null;
  quote_count?: number | null;
  like_count?: number | null;
  bookmark_count?: number | null;
  view_count?: number | null;
}>): void {
  for (const tweet of data) {
    const textSnippet = (tweet.text ?? "").slice(0, 100).replace(/\n/g, " ");
    console.log(
      [
        tweet.id,
        tweet.created_at ?? "",
        `rt=${tweet.retweet_count ?? "null"}`,
        `reply=${tweet.reply_count ?? "null"}`,
        `quote=${tweet.quote_count ?? "null"}`,
        `like=${tweet.like_count ?? "null"}`,
        `bookmark=${tweet.bookmark_count ?? "null"}`,
        `view=${tweet.view_count ?? "null"}`,
        textSnippet,
      ].join("\t"),
    );
  }
}

function formatFolderOutput(data: Array<{ id: string; name: string }>): void {
  for (const folder of data) {
    console.log(`${folder.id}\t${folder.name}`);
  }
}

// Only parse when this module is the entry point
import { realpathSync } from "node:fs";

export function checkIsMain(scriptPath: string): boolean {
  const resolved = (() => {
    try {
      return realpathSync(scriptPath);
    } catch {
      return scriptPath;
    }
  })();
  return resolved.endsWith("index.js") || resolved.endsWith("index.ts");
}

const isMain = checkIsMain(process.argv[1] ?? "");
if (isMain) {
  createProgram().parse();
}
