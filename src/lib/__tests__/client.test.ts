import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { XaiClient } from "../client.js";
import { XaiApiError } from "../retry.js";
import {
  mockXaiResponse,
  mockXaiError,
} from "../../__tests__/helpers/mock-fetch.js";

describe("XaiClient", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should throw if apiKey is empty", () => {
      expect(() => new XaiClient({ apiKey: "" })).toThrow("XAI_API_KEY is required");
    });

    it("should create client with valid apiKey", () => {
      const client = new XaiClient({ apiKey: "test-key" });
      expect(client).toBeInstanceOf(XaiClient);
    });
  });

  describe("search", () => {
    it("should send correct request for keyword search", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("Found tweets about AI"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.search("AI");

      expect(result.text).toBe("Found tweets about AI");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.x.ai/v1/responses");
      const body = JSON.parse(opts.body);
      expect(body.model).toBe("grok-4-1-fast");
      expect(body.input[0].content).toContain("AI");
      expect(body.tools[0].type).toBe("x_search");
    });

    it("should include date range when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("results"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.search("AI", { fromDate: "2026-03-01", toDate: "2026-03-22" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].from_date).toBe("2026-03-01");
      expect(body.tools[0].to_date).toBe("2026-03-22");
    });

    it("should include excluded handles when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("results"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.search("AI", { excludeHandles: ["spammer1", "spammer2"] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].excluded_x_handles).toEqual(["spammer1", "spammer2"]);
    });

    it("should include requested count in the prompt when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("results"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.search("AI", { count: 100 });

      expect(result.requested_count).toBe(100);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input[0].content).toContain("最大100件");
    });

    it("should reject count over the maximum", async () => {
      const client = new XaiClient({ apiKey: "test-key" });
      await expect(client.search("AI", { count: 1001 })).rejects.toThrow("count must be between 1 and 1000");
    });
  });

  describe("getUser", () => {
    it("should set allowed_x_handles with the handle", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("User tweets"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.getUser("elonmusk");

      expect(result.text).toBe("User tweets");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].allowed_x_handles).toEqual(["elonmusk"]);
    });

    it("should strip @ prefix from handle", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("User tweets"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.getUser("@elonmusk");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].allowed_x_handles).toEqual(["elonmusk"]);
    });

    it("should include date range when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("results"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.getUser("elonmusk", { fromDate: "2026-03-01" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].from_date).toBe("2026-03-01");
    });

    it("should include requested count in the user prompt when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("User tweets"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.getUser("elonmusk", { count: 10 });

      expect(result.requested_count).toBe(10);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input[0].content).toContain("最大10件");
    });
  });

  describe("getTweet", () => {
    it("should extract handle from tweet URL and set allowed_x_handles", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("Tweet content"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.getTweet("https://x.com/elonmusk/status/123456789");

      expect(result.text).toBe("Tweet content");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].allowed_x_handles).toEqual(["elonmusk"]);
      expect(body.input[0].content).toContain("https://x.com/elonmusk/status/123456789");
    });

    it("should handle twitter.com URLs", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("Tweet content"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.getTweet("https://twitter.com/user123/status/999");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].allowed_x_handles).toEqual(["user123"]);
    });

    it("should throw on invalid tweet URL", async () => {
      const client = new XaiClient({ apiKey: "test-key" });
      await expect(client.getTweet("https://example.com/foo")).rejects.toThrow(
        "Invalid tweet URL",
      );
    });
  });

  describe("ask", () => {
    it("should send prompt as-is", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("Answer"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.ask("What is trending in AI?");

      expect(result.text).toBe("Answer");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input[0].content).toBe("What is trending in AI?");
      expect(body.tools[0].type).toBe("x_search");
    });

    it("should include tool options when specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("Answer"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      await client.ask("query", {
        allowed_x_handles: ["user1"],
        from_date: "2026-01-01",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools[0].allowed_x_handles).toEqual(["user1"]);
      expect(body.tools[0].from_date).toBe("2026-01-01");
    });

    it("should throw if both allowed and excluded handles are specified", async () => {
      const client = new XaiClient({ apiKey: "test-key" });
      await expect(
        client.ask("query", {
          allowed_x_handles: ["a"],
          excluded_x_handles: ["b"],
        }),
      ).rejects.toThrow("allowed_x_handles and excluded_x_handles cannot be used together");
    });
  });

  describe("authTest", () => {
    it("should return ok:true on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("test"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.authTest();

      expect(result.ok).toBe(true);
      expect(result.model).toBe("grok-4-1-fast");
    });

    it("should throw XaiApiError on 401", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiError(401, "Unauthorized"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "bad-key" });
      await expect(client.authTest()).rejects.toThrow(XaiApiError);
    });
  });

  describe("error handling", () => {
    it("should throw XaiApiError with status on API error", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiError(400, "Bad request"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      try {
        await client.search("test");
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(XaiApiError);
        expect((err as XaiApiError).status).toBe(400);
      }
    });
  });

  describe("response parsing", () => {
    it("should concatenate multiple message outputs", async () => {
      const body = {
        output: [
          { type: "tool_use", content: [] },
          { type: "message", content: [{ type: "text", text: "Part 1. " }] },
          { type: "tool_result" },
          { type: "message", content: [{ type: "text", text: "Part 2." }] },
        ],
      };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.search("test");
      expect(result.text).toBe("Part 1. Part 2.");
    });

    it("should parse output_text content type from xAI Responses API", async () => {
      // Real xAI API returns custom_tool_call + output_text (not message + text)
      const body = {
        output: [
          {
            type: "custom_tool_call",
            call_id: "xs_call_123",
            name: "x_keyword_search",
            input: '{"query":"test"}',
            status: "completed",
          },
          {
            content: [
              {
                type: "output_text",
                text: "Search results from xAI API",
                annotations: [],
              },
            ],
          },
        ],
      };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key" });
      const result = await client.search("test");
      expect(result.text).toBe("Search results from xAI API");
    });
  });

  describe("custom options", () => {
    it("should use custom baseUrl", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("ok"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({
        apiKey: "test-key",
        baseUrl: "https://custom.api.example.com",
      });
      await client.search("test");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://custom.api.example.com/v1/responses");
    });

    it("should use custom model", async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockXaiResponse("ok"));
      globalThis.fetch = mockFetch;

      const client = new XaiClient({ apiKey: "test-key", model: "grok-3" });
      await client.search("test");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("grok-3");
    });
  });
});
