import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embedCommand } from "../embed.js";

// fetch をモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const MOCK_OEMBED = {
  url: "https://x.com/jack/status/20",
  author_name: "jack",
  author_url: "https://x.com/jack",
  html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://twitter.com/jack/status/20">March 21, 2006</a></blockquote>',
  width: 550,
  type: "rich",
  provider_name: "Twitter",
};

describe("embedCommand", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const cacheDir = `${process.env.HOME}/.cache/xai-cli/oembed`;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_OEMBED,
    });
    // キャッシュをクリアするためにfs.existsSyncをモック
    vi.mock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>();
      return {
        ...actual,
        existsSync: vi.fn((p: string) => {
          // キャッシュファイルは存在しないとみなす（テスト用）
          if (p.includes(".cache/xai-cli/oembed")) return false;
          return actual.existsSync(p);
        }),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches oEmbed and outputs html by default", async () => {
    await embedCommand("https://x.com/jack/status/20", {});
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://publish.twitter.com/oembed")
    );
    expect(logSpy).toHaveBeenCalledWith(MOCK_OEMBED.html);
  });

  it("outputs html format", async () => {
    await embedCommand("https://x.com/jack/status/20", { format: "html" });
    expect(logSpy).toHaveBeenCalledWith(MOCK_OEMBED.html);
  });

  it("outputs md format", async () => {
    await embedCommand("https://x.com/jack/status/20", { format: "md" });
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("> **jack**");
    expect(output).toContain("[投稿を見る →]");
  });

  it("outputs text format", async () => {
    await embedCommand("https://x.com/jack/status/20", { format: "text" });
    const output = logSpy.mock.calls[0][0] as string;
    // HTML タグが除去されている
    expect(output).not.toContain("<blockquote");
    expect(output).toContain("just setting up my twttr");
  });

  it("accepts tweet ID as number string", async () => {
    await embedCommand("20", { format: "html" });
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("publish.twitter.com/oembed");
    expect(decodeURIComponent(calledUrl)).toContain("x.com/i/status/20");
  });

  it("throws on unknown format", async () => {
    await expect(
      embedCommand("https://x.com/jack/status/20", { format: "csv" })
    ).rejects.toThrow("Unknown format: csv");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await expect(
      embedCommand("https://x.com/jack/status/20", {})
    ).rejects.toThrow("oEmbed API error: 404 Not Found");
  });

  it("throws on invalid URL", async () => {
    await expect(
      embedCommand("not-a-url-or-id", {})
    ).rejects.toThrow("Invalid tweet URL or ID");
  });
});
