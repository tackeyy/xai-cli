/**
 * maybeDumpResponse (XAI_DEBUG_DUMP_RESPONSE) のテスト。
 *
 * node:fs / node:os をモックするために vi.mock をトップレベルで使う専用ファイル。
 * ESM では vi.spyOn でネイティブモジュールを書き換えられないため、
 * vi.mock ファクトリで差し替える方式を採用している。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/mock-home"),
}));

// node:fs / node:os のモックが差し込まれた後に XaiClient をインポートする
const { XaiClient } = await import("../client.js");
const { mockXaiResponse } = await import("../../__tests__/helpers/mock-fetch.js");

describe("XaiClient > maybeDumpResponse (XAI_DEBUG_DUMP_RESPONSE)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.mocked(mkdirSync).mockReset();
    vi.mocked(writeFileSync).mockReset();
    vi.mocked(homedir).mockReturnValue("/mock-home");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.XAI_DEBUG_DUMP_RESPONSE;
  });

  it("should write last-response.json when XAI_DEBUG_DUMP_RESPONSE is set", async () => {
    process.env.XAI_DEBUG_DUMP_RESPONSE = "1";
    globalThis.fetch = vi.fn().mockResolvedValue(mockXaiResponse("dump test"));

    const client = new XaiClient({ apiKey: "test-key" });
    await client.search("test");

    expect(homedir).toHaveBeenCalled();
    expect(mkdirSync).toHaveBeenCalledWith(
      "/mock-home/.cache/xai-cli",
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      "/mock-home/.cache/xai-cli/last-response.json",
      expect.stringContaining("dump test"),
    );
  });

  it("should not write any file when XAI_DEBUG_DUMP_RESPONSE is unset", async () => {
    delete process.env.XAI_DEBUG_DUMP_RESPONSE;
    globalThis.fetch = vi.fn().mockResolvedValue(mockXaiResponse("no dump"));

    const client = new XaiClient({ apiKey: "test-key" });
    await client.search("test");

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("should continue and return text even if dump write fails", async () => {
    process.env.XAI_DEBUG_DUMP_RESPONSE = "1";
    vi.mocked(mkdirSync).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockXaiResponse("continues after error"));

    const client = new XaiClient({ apiKey: "test-key" });
    const result = await client.search("test");

    // ダンプ失敗でも本処理（テキスト抽出）は継続される
    expect(result.text).toBe("continues after error");
  });
});
