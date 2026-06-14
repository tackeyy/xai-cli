import type {
  XaiClientOptions,
  XaiRequest,
  XaiResponse,
  XaiVisionRequest,
  XSearchTool,
  SearchResult,
} from "./types.js";
import { XaiApiError, withRetry } from "./retry.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TWEET_URL_RE = /(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/;
const MAX_COUNT = 1000;
const VISION_MODEL = "grok-4.3";
export const MAX_TWEET_IMAGES = 4;

export class XaiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: XaiClientOptions) {
    if (!opts.apiKey) {
      throw new Error("XAI_API_KEY is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://api.x.ai";
    this.model = opts.model ?? "grok-4-1-fast";
    this.timeoutMs = opts.timeoutMs ?? 60000;
  }

  private async fetchApi(body: XaiRequest): Promise<XaiResponse> {
    return withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}/v1/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorBody = await res.text();
          const retryAfter = res.headers.get("Retry-After");
          throw new XaiApiError(
            res.status,
            `xAI API error ${res.status}: ${errorBody}`,
            retryAfter ? parseFloat(retryAfter) : undefined,
          );
        }

        const json = (await res.json()) as XaiResponse;
        this.maybeDumpResponse(json);
        return json;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /**
   * XAI_DEBUG_DUMP_RESPONSE が設定されている場合、生レスポンスを
   * ~/.cache/xai-cli/last-response.json に書き出す（デバッグ用）。
   * output[].type / content[].type の実採取に使う。失敗は本処理に影響させない。
   */
  private maybeDumpResponse(response: XaiResponse): void {
    if (!process.env.XAI_DEBUG_DUMP_RESPONSE) return;
    try {
      const dir = join(homedir(), ".cache", "xai-cli");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "last-response.json"), JSON.stringify(response, null, 2));
    } catch {
      // ダンプ失敗はデバッグ補助なので握りつぶす
    }
  }

  private extractText(response: XaiResponse): string {
    return response.output
      .filter((o) => o.content && Array.isArray(o.content))
      .flatMap((o) => o.content!)
      .filter((c) => c.type === "text" || c.type === "output_text")
      .map((c) => c.text)
      .join("");
  }

  private buildTool(overrides?: Partial<Omit<XSearchTool, "type">>): XSearchTool {
    const tool: XSearchTool = { type: "x_search", ...overrides };
    if (tool.allowed_x_handles && tool.excluded_x_handles) {
      throw new Error(
        "allowed_x_handles and excluded_x_handles cannot be used together",
      );
    }
    return tool;
  }

  private stripAt(handle: string): string {
    return handle.replace(/^@/, "");
  }

  private validateCount(count: number | undefined): number | undefined {
    if (count === undefined) return undefined;
    if (!Number.isInteger(count) || count <= 0 || count > MAX_COUNT) {
      throw new Error(`count must be between 1 and ${MAX_COUNT}`);
    }
    return count;
  }

  private countInstruction(count: number | undefined): string {
    return count === undefined
      ? ""
      : ` 最大${count}件を目標に、投稿URL・投稿日時・投稿本文・エンゲージメント指標が分かる場合は含めてください。`;
  }

  async search(
    query: string,
    opts?: {
      fromDate?: string;
      toDate?: string;
      excludeHandles?: string[];
      count?: number;
    },
  ): Promise<SearchResult> {
    const count = this.validateCount(opts?.count);
    const tool = this.buildTool({
      from_date: opts?.fromDate,
      to_date: opts?.toDate,
      excluded_x_handles: opts?.excludeHandles?.map((h) => this.stripAt(h)),
    });

    const response = await this.fetchApi({
      model: this.model,
      input: [
        {
          role: "user",
          content: `「${query}」に関するXの投稿を検索してください。${this.countInstruction(count)}`,
        },
      ],
      tools: [tool],
    });

    return { text: this.extractText(response), ...(count !== undefined && { requested_count: count }) };
  }

  async getUser(
    handle: string,
    opts?: { fromDate?: string; toDate?: string; count?: number },
  ): Promise<SearchResult> {
    const cleanHandle = this.stripAt(handle);
    const count = this.validateCount(opts?.count);
    const tool = this.buildTool({
      allowed_x_handles: [cleanHandle],
      from_date: opts?.fromDate,
      to_date: opts?.toDate,
    });

    const response = await this.fetchApi({
      model: this.model,
      input: [
        {
          role: "user",
          content: `@${cleanHandle}の最近の投稿を教えてください。${this.countInstruction(count)}`,
        },
      ],
      tools: [tool],
    });

    return { text: this.extractText(response), ...(count !== undefined && { requested_count: count }) };
  }

  async getTweet(url: string): Promise<SearchResult> {
    const match = url.match(TWEET_URL_RE);
    if (!match) {
      throw new Error(`Invalid tweet URL: ${url}`);
    }

    const handle = match[1];
    const tool = this.buildTool({
      allowed_x_handles: [handle],
    });

    const response = await this.fetchApi({
      model: this.model,
      input: [
        {
          role: "user",
          content: `以下のX投稿の内容を正確に取得してください。投稿本文、投稿者名、投稿日時を含めてください。URL: ${url}`,
        },
      ],
      tools: [tool],
    });

    return { text: this.extractText(response) };
  }

  private async fetchVisionApi(body: XaiVisionRequest): Promise<XaiResponse> {
    return withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorBody = await res.text();
          const retryAfter = res.headers.get("Retry-After");
          throw new XaiApiError(
            res.status,
            `xAI Vision API error ${res.status}: ${errorBody}`,
            retryAfter ? parseFloat(retryAfter) : undefined,
          );
        }

        // Chat completions returns a different shape — adapt to XaiResponse
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content ?? "";
        return {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text }],
            },
          ],
        } satisfies XaiResponse;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async getTweetWithImages(url: string, imageUrls: string[]): Promise<SearchResult> {
    const capped = imageUrls.slice(0, MAX_TWEET_IMAGES);

    const imageContents = capped.map((imageUrl) => ({
      type: "image_url" as const,
      image_url: { url: imageUrl },
    }));

    const response = await this.fetchVisionApi({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text",
              text: `以下のX投稿のURL: ${url}\n\n添付画像を詳しく分析してください。\n\n出力フォーマット（Markdown）:\n## 画像内容\n画像に含まれるテキストの文字起こし（OCR）と、画像の内容・文脈の説明を画像ごとに記載してください。`,
            },
          ],
        },
      ],
    });

    return { text: this.extractText(response) };
  }

  async ask(
    prompt: string,
    toolOpts?: Partial<Omit<XSearchTool, "type">>,
  ): Promise<SearchResult> {
    const tool = this.buildTool(toolOpts);

    const response = await this.fetchApi({
      model: this.model,
      input: [{ role: "user", content: prompt }],
      tools: [tool],
    });

    return { text: this.extractText(response) };
  }

  async authTest(): Promise<{ ok: boolean; model: string }> {
    await this.fetchApi({
      model: this.model,
      input: [{ role: "user", content: "test" }],
      tools: [{ type: "x_search" }],
    });
    return { ok: true, model: this.model };
  }
}
