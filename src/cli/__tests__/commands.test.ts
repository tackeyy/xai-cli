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
  return {
    replyTweet: vi.fn().mockResolvedValue({ id: "987654321", text: "テスト返信" }),
  } as unknown as TwitterClient;
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
