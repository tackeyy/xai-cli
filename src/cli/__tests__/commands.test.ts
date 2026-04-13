import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProgram } from "../index.js";
import type { XaiClient } from "../../lib/client.js";
import type { TwitterClient } from "../../lib/twitter-client.js";

function createMockClient(): XaiClient {
  return {
    search: vi.fn().mockResolvedValue({ text: "search results" }),
    getUser: vi.fn().mockResolvedValue({ text: "user tweets" }),
    getTweet: vi.fn().mockResolvedValue({ text: "tweet content" }),
    ask: vi.fn().mockResolvedValue({ text: "answer" }),
    authTest: vi.fn().mockResolvedValue({ ok: true, model: "grok-4-1-fast" }),
  } as unknown as XaiClient;
}

function createMockTwitterClient(): TwitterClient {
  const mock: any = {
    replyTweet: vi.fn().mockResolvedValue({ id: "987654321", text: "テスト返信" }),
    postTweet: vi.fn().mockResolvedValue({
      id: "111222333",
      text: "hello",
      url: "https://x.com/i/status/111222333",
      posted_at: "2026-04-11T00:00:00.000Z",
    }),
    // buildPostPayload は dry-run 時に CLI から呼ばれる (実 TwitterClient を dummy で new するため、モックは不要)
  };
  return mock as TwitterClient;
}

describe("CLI commands", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function run(args: string[], client?: XaiClient, twitterClient?: TwitterClient) {
    const mockXaiClient = client ?? createMockClient();
    const mockTwitterClient = twitterClient ?? createMockTwitterClient();
    const program = createProgram(mockXaiClient, mockTwitterClient);
    program.exitOverride();
    await program.parseAsync(["node", "xai", ...args]);
    return { xaiClient: mockXaiClient, twitterClient: mockTwitterClient };
  }

  describe("auth test", () => {
    it("should display auth success in human mode", async () => {
      await run(["auth", "test"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("ok"));
    });

    it("should display auth success in json mode", async () => {
      await run(["--json", "auth", "test"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.ok).toBe(true);
      expect(parsed.model).toBe("grok-4-1-fast");
    });
  });

  describe("search", () => {
    it("should call client.search with query", async () => {
      const { xaiClient } = await run(["search", "AI"]);
      expect(xaiClient.search).toHaveBeenCalledWith("AI", expect.any(Object));
    });

    it("should pass date options", async () => {
      const { xaiClient } = await run([
        "search",
        "AI",
        "--from",
        "2026-03-01",
        "--to",
        "2026-03-22",
      ]);
      expect(xaiClient.search).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({
          fromDate: "2026-03-01",
          toDate: "2026-03-22",
        }),
      );
    });

    it("should pass exclude option", async () => {
      const { xaiClient } = await run(["search", "AI", "--exclude", "spam1,spam2"]);
      expect(xaiClient.search).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({
          excludeHandles: ["spam1", "spam2"],
        }),
      );
    });

    it("should output text in human mode", async () => {
      await run(["search", "AI"]);
      expect(logSpy).toHaveBeenCalledWith("search results");
    });

    it("should output JSON in json mode", async () => {
      await run(["--json", "search", "AI"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.text).toBe("search results");
    });

    it("should output plain text in plain mode", async () => {
      await run(["--plain", "search", "AI"]);
      expect(logSpy).toHaveBeenCalledWith("search results");
    });
  });

  describe("user", () => {
    it("should call client.getUser with handle", async () => {
      const { xaiClient } = await run(["user", "elonmusk"]);
      expect(xaiClient.getUser).toHaveBeenCalledWith("elonmusk", expect.any(Object));
    });

    it("should pass date options", async () => {
      const { xaiClient } = await run(["user", "elonmusk", "--from", "2026-03-01"]);
      expect(xaiClient.getUser).toHaveBeenCalledWith(
        "elonmusk",
        expect.objectContaining({ fromDate: "2026-03-01" }),
      );
    });
  });

  describe("tweet", () => {
    it("should call client.getTweet with URL", async () => {
      const url = "https://x.com/elonmusk/status/123";
      const { xaiClient } = await run(["tweet", url]);
      expect(xaiClient.getTweet).toHaveBeenCalledWith(url);
    });
  });

  describe("ask", () => {
    it("should call client.ask with prompt", async () => {
      const { xaiClient } = await run(["ask", "What is trending?"]);
      expect(xaiClient.ask).toHaveBeenCalledWith("What is trending?", expect.any(Object));
    });

    it("should pass allow and exclude options", async () => {
      const { xaiClient } = await run([
        "ask",
        "query",
        "--allow",
        "user1,user2",
        "--from",
        "2026-01-01",
      ]);
      expect(xaiClient.ask).toHaveBeenCalledWith(
        "query",
        expect.objectContaining({
          allowed_x_handles: ["user1", "user2"],
          from_date: "2026-01-01",
        }),
      );
    });
  });

  describe("reply", () => {
    it("should call twitterClient.replyTweet with tweetId and text", async () => {
      const { twitterClient } = await run(["reply", "123456789", "テスト返信"]);
      expect(twitterClient.replyTweet).toHaveBeenCalledWith("123456789", "テスト返信");
    });

    it("should output reply result in human mode", async () => {
      await run(["reply", "123456789", "テスト返信"]);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("987654321"),
      );
    });

    it("should output JSON in json mode", async () => {
      await run(["--json", "reply", "123456789", "テスト返信"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe("987654321");
      expect(parsed.text).toBe("テスト返信");
    });

    it("should NOT call replyTweet in dry-run mode", async () => {
      const { twitterClient } = await run(["reply", "--dry-run", "123456789", "テスト返信"]);
      expect(twitterClient.replyTweet).not.toHaveBeenCalled();
    });

    it("should output dry-run info when --dry-run is set", async () => {
      await run(["reply", "--dry-run", "123456789", "テスト返信"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("123456789"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("テスト返信"));
    });

    it("should print error and exit 1 on replyTweet failure", async () => {
      const tc = createMockTwitterClient();
      (tc.replyTweet as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden"),
      );
      await run(["reply", "123456789", "テスト"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("X API error 403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("post", () => {
    it("calls twitterClient.postTweet with text only", async () => {
      const { twitterClient } = await run(["post", "--text", "hello"]);
      expect(twitterClient.postTweet).toHaveBeenCalledWith(
        expect.objectContaining({ text: "hello" }),
      );
    });

    it("passes --url and --reply-to through", async () => {
      const { twitterClient } = await run([
        "post",
        "--text",
        "check",
        "--url",
        "https://example.com",
        "--reply-to",
        "999",
      ]);
      expect(twitterClient.postTweet).toHaveBeenCalledWith({
        text: "check",
        url: "https://example.com",
        replyTo: "999",
      });
    });

    it("passes --max-length through to postTweet", async () => {
      const { twitterClient } = await run([
        "post",
        "--text",
        "hi",
        "--max-length",
        "25000",
      ]);
      expect(twitterClient.postTweet).toHaveBeenCalledWith(
        expect.objectContaining({ maxLength: 25000 }),
      );
    });

    it("passes --no-length-check through to postTweet", async () => {
      const { twitterClient } = await run([
        "post",
        "--text",
        "hi",
        "--no-length-check",
      ]);
      expect(twitterClient.postTweet).toHaveBeenCalledWith(
        expect.objectContaining({ noLengthCheck: true }),
      );
    });

    it("outputs tweet id and url in human mode", async () => {
      await run(["post", "--text", "hi"]);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("111222333"),
      );
      expect(logSpy).toHaveBeenCalledWith("https://x.com/i/status/111222333");
    });

    it("outputs JSON in json mode with tweet_id/tweet_url/posted_at", async () => {
      await run(["--json", "post", "--text", "hi"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.tweet_id).toBe("111222333");
      expect(parsed.tweet_url).toBe("https://x.com/i/status/111222333");
      expect(parsed.posted_at).toBe("2026-04-11T00:00:00.000Z");
    });

    it("prints error and exit 1 on postTweet failure", async () => {
      const tc = createMockTwitterClient();
      (tc.postTweet as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 429 (retry-after: 60s): rate limit"),
      );
      await run(["post", "--text", "x"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("X API error 429"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("rejects a 281-char ASCII body without calling postTweet (dry-run)", async () => {
      // dry-run は injected client を使わないので、builder が TweetTooLongError を投げる
      await run(["post", "--dry-run", "--text", "a".repeat(281)]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/exceeds 280/));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("rejects a 141-char Japanese body without calling postTweet (dry-run)", async () => {
      await run(["post", "--dry-run", "--text", "あ".repeat(141)]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/exceeds 280/));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("dry-run does NOT call postTweet and prints payload", async () => {
      const { twitterClient } = await run(["post", "--dry-run", "--text", "hi"]);
      expect(twitterClient.postTweet).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
    });

    it("dry-run + --json outputs structured JSON summary", async () => {
      await run(["--json", "post", "--dry-run", "--text", "hi"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.dry_run).toBe(true);
      expect(parsed.weighted_length).toBe(2);
      expect(parsed.max_length).toBe(280);
      expect(parsed.payload).toEqual({ text: "hi" });
      expect(parsed.endpoint).toMatch(/^POST /);
    });

    it("dry-run honors --max-length in JSON summary", async () => {
      await run([
        "--json",
        "post",
        "--dry-run",
        "--text",
        "hi",
        "--max-length",
        "25000",
      ]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.max_length).toBe(25000);
    });

    it("dry-run shows unlimited when --no-length-check is set", async () => {
      await run([
        "--json",
        "post",
        "--dry-run",
        "--text",
        "hi",
        "--no-length-check",
      ]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.max_length).toBeNull();
    });

    it("dry-run appends url to payload text", async () => {
      await run([
        "--json",
        "post",
        "--dry-run",
        "--text",
        "see",
        "--url",
        "https://example.com/article",
      ]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.payload.text).toBe("see\nhttps://example.com/article");
      // "see\n" = 4 + URL 23 = 27
      expect(parsed.weighted_length).toBe(27);
    });

    it("dry-run includes reply.in_reply_to_tweet_id", async () => {
      await run([
        "--json",
        "post",
        "--dry-run",
        "--text",
        "t",
        "--reply-to",
        "42",
      ]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.payload.reply).toEqual({ in_reply_to_tweet_id: "42" });
    });
  });

  describe("error handling", () => {
    it("should print error and exit 1 on failure", async () => {
      const client = createMockClient();
      (client.search as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API failed"),
      );
      await run(["search", "test"], client);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("API failed"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
