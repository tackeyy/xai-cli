/**
 * xai embed <url_or_id> [--format html|md|text] [--theme light|dark] [--lang ja]
 *
 * X(Twitter) oEmbed APIを使いツイートのHTML/MD/TEXTを取得する。
 * エンドポイント: https://publish.twitter.com/oembed (認証不要・無料)
 * キャッシュ: ~/.cache/xai-cli/oembed/{tweet_id}.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE_DIR = join(homedir(), ".cache", "xai-cli", "oembed");

interface OEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  type: string;
  provider_name: string;
}

function extractTweetId(urlOrId: string): string {
  // URLからIDを抽出（数字のみならそのまま返す）
  const match = urlOrId.match(/status\/(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(urlOrId)) return urlOrId;
  throw new Error(`Invalid tweet URL or ID: ${urlOrId}`);
}

function normalizeToUrl(urlOrId: string): string {
  if (/^\d+$/.test(urlOrId)) {
    return `https://x.com/i/status/${urlOrId}`;
  }
  return urlOrId;
}

function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToMd(oEmbed: OEmbedResponse, tweetUrl: string): string {
  const text = htmlToText(oEmbed.html);
  return `> **${oEmbed.author_name}**\n>\n> ${text}\n>\n> [投稿を見る →](${tweetUrl})`;
}

async function fetchOEmbed(
  tweetUrl: string,
  theme: string,
  lang: string
): Promise<OEmbedResponse> {
  const tweetId = extractTweetId(tweetUrl);
  const cacheFile = join(CACHE_DIR, `${tweetId}.json`);

  // キャッシュがあれば返す
  if (existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, "utf-8"));
  }

  const params = new URLSearchParams({
    url: tweetUrl,
    omit_script: "true",
    theme,
    lang,
    dnt: "true",
  });
  const endpoint = `https://publish.twitter.com/oembed?${params}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`oEmbed API error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as OEmbedResponse;

  // キャッシュ保存
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  return data;
}

export async function embedCommand(
  urlOrId: string,
  options: { format?: string; theme?: string; lang?: string }
): Promise<void> {
  const format = options.format ?? "html";
  const theme = options.theme ?? "light";
  const lang = options.lang ?? "ja";

  const tweetUrl = normalizeToUrl(urlOrId);
  const oEmbed = await fetchOEmbed(tweetUrl, theme, lang);

  switch (format) {
    case "html":
      console.log(oEmbed.html);
      break;
    case "md":
      console.log(htmlToMd(oEmbed, tweetUrl));
      break;
    case "text":
      console.log(htmlToText(oEmbed.html));
      console.log(`\n— ${oEmbed.author_name} (${tweetUrl})`);
      break;
    default:
      throw new Error(`Unknown format: ${format}. Use html, md, or text.`);
  }
}
