import type {
  XaiClientOptions,
  XaiRequest,
  XaiResponse,
  XSearchTool,
  SearchResult,
} from "./types.js";
import { XaiApiError, withRetry } from "./retry.js";

const TWEET_URL_RE = /(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/;

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

        return (await res.json()) as XaiResponse;
      } finally {
        clearTimeout(timer);
      }
    });
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

  async search(
    query: string,
    opts?: {
      fromDate?: string;
      toDate?: string;
      excludeHandles?: string[];
    },
  ): Promise<SearchResult> {
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
          content: `「${query}」に関するXの投稿を検索してください`,
        },
      ],
      tools: [tool],
    });

    return { text: this.extractText(response) };
  }

  async getUser(
    handle: string,
    opts?: { fromDate?: string; toDate?: string },
  ): Promise<SearchResult> {
    const cleanHandle = this.stripAt(handle);
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
          content: `@${cleanHandle}の最近の投稿を教えてください`,
        },
      ],
      tools: [tool],
    });

    return { text: this.extractText(response) };
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
