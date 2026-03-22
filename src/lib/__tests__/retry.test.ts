import { describe, it, expect, vi } from "vitest";
import { XaiApiError, withRetry } from "../retry.js";

describe("XaiApiError", () => {
  it("should store status and message", () => {
    const err = new XaiApiError(429, "Rate limited");
    expect(err.status).toBe(429);
    expect(err.message).toBe("Rate limited");
    expect(err.name).toBe("XaiApiError");
  });

  it("should store optional retryAfter", () => {
    const err = new XaiApiError(429, "Rate limited", 5);
    expect(err.retryAfter).toBe(5);
  });

  it("should be instanceof Error", () => {
    const err = new XaiApiError(500, "Server error");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should throw non-retryable errors immediately", async () => {
    const err = new XaiApiError(401, "Unauthorized");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on 429 and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new XaiApiError(429, "Rate limited"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on 5xx and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new XaiApiError(500, "Server error"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after maxRetries exhausted", async () => {
    const err = new XaiApiError(429, "Rate limited");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should not retry non-Error throws", async () => {
    const fn = vi.fn().mockRejectedValue("string error");
    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 })).rejects.toBe("string error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should use retryAfter delay when available", async () => {
    const err = new XaiApiError(429, "Rate limited", 2);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10000 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
