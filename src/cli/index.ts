#!/usr/bin/env node
import { Command } from "commander";
import { XaiClient } from "../lib/client.js";

function createClientFromEnv(): XaiClient {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("Error: XAI_API_KEY environment variable is not set");
    process.exit(1);
  }
  return new XaiClient({ apiKey });
}

function jsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function createProgram(injectedClient?: XaiClient): Command {
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
