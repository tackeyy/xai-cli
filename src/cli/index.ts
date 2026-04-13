#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { XaiClient } from "../lib/client.js";
import { TwitterClient, TweetTooLongError } from "../lib/twitter-client.js";
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
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.error(
      "Error: X API credentials not found.\n" +
      "Please set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in ~/.secrets",
    );
    process.exit(1);
  }

  return new TwitterClient({ apiKey, apiSecret, accessToken, accessTokenSecret });
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
    .action(async (query, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.search(query, {
          fromDate: opts.from,
          toDate: opts.to,
          excludeHandles: opts.exclude?.split(","),
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
    .action(async (handle, opts) => {
      try {
        const client = getClient();
        const mode = getOutputMode();
        const result = await client.getUser(handle, {
          fromDate: opts.from,
          toDate: opts.to,
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
          // --- dry-run は Twitter 認証情報を要求せず、ローカルで payload を組み立てる ---
          if (opts.dryRun) {
            // 認証は一切不要なので、バリデーションのためだけにダミー資格情報で client を作る
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
