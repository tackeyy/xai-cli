import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProgram } from "../index.js";
import type { XaiClient } from "../../lib/client.js";

function createMockClient(): XaiClient {
  return {
    search: vi.fn().mockResolvedValue({ text: "search results" }),
    getUser: vi.fn().mockResolvedValue({ text: "user tweets" }),
    getTweet: vi.fn().mockResolvedValue({ text: "tweet content" }),
    ask: vi.fn().mockResolvedValue({ text: "answer" }),
    authTest: vi.fn().mockResolvedValue({ ok: true, model: "grok-4-1-fast" }),
  } as unknown as XaiClient;
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

  async function run(args: string[], client?: XaiClient) {
    const mockClient = client ?? createMockClient();
    const program = createProgram(mockClient);
    program.exitOverride();
    await program.parseAsync(["node", "xai", ...args]);
    return mockClient;
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
      const client = await run(["search", "AI"]);
      expect(client.search).toHaveBeenCalledWith("AI", expect.any(Object));
    });

    it("should pass date options", async () => {
      const client = await run([
        "search",
        "AI",
        "--from",
        "2026-03-01",
        "--to",
        "2026-03-22",
      ]);
      expect(client.search).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({
          fromDate: "2026-03-01",
          toDate: "2026-03-22",
        }),
      );
    });

    it("should pass exclude option", async () => {
      const client = await run(["search", "AI", "--exclude", "spam1,spam2"]);
      expect(client.search).toHaveBeenCalledWith(
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
      const client = await run(["user", "elonmusk"]);
      expect(client.getUser).toHaveBeenCalledWith("elonmusk", expect.any(Object));
    });

    it("should pass date options", async () => {
      const client = await run(["user", "elonmusk", "--from", "2026-03-01"]);
      expect(client.getUser).toHaveBeenCalledWith(
        "elonmusk",
        expect.objectContaining({ fromDate: "2026-03-01" }),
      );
    });
  });

  describe("tweet", () => {
    it("should call client.getTweet with URL", async () => {
      const url = "https://x.com/elonmusk/status/123";
      const client = await run(["tweet", url]);
      expect(client.getTweet).toHaveBeenCalledWith(url);
    });
  });

  describe("ask", () => {
    it("should call client.ask with prompt", async () => {
      const client = await run(["ask", "What is trending?"]);
      expect(client.ask).toHaveBeenCalledWith("What is trending?", expect.any(Object));
    });

    it("should pass allow and exclude options", async () => {
      const client = await run([
        "ask",
        "query",
        "--allow",
        "user1,user2",
        "--from",
        "2026-01-01",
      ]);
      expect(client.ask).toHaveBeenCalledWith(
        "query",
        expect.objectContaining({
          allowed_x_handles: ["user1", "user2"],
          from_date: "2026-01-01",
        }),
      );
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
