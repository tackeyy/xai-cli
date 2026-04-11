import { describe, it, expect } from "vitest";
import { computeTweetLength, TWEET_MAX_LENGTH, URL_WEIGHTED_LENGTH } from "../tweet-length.js";

describe("computeTweetLength", () => {
  describe("ASCII text", () => {
    it("counts empty string as 0", () => {
      expect(computeTweetLength("")).toBe(0);
    });

    it("counts ASCII characters as 1 each", () => {
      expect(computeTweetLength("hello")).toBe(5);
      expect(computeTweetLength("a".repeat(280))).toBe(280);
    });

    it("counts a 281-char ASCII string as 281", () => {
      expect(computeTweetLength("a".repeat(281))).toBe(281);
    });
  });

  describe("CJK multibyte characters", () => {
    it("counts each Japanese character as 2 (weighted count)", () => {
      expect(computeTweetLength("あ")).toBe(2);
      expect(computeTweetLength("こんにちは")).toBe(10);
    });

    it("counts 140 Japanese characters exactly as 280", () => {
      expect(computeTweetLength("あ".repeat(140))).toBe(280);
    });

    it("counts 141 Japanese characters as 282 (over limit)", () => {
      expect(computeTweetLength("あ".repeat(141))).toBe(282);
    });

    it("mixes ASCII and Japanese correctly", () => {
      // "Hello世界" = 5 + 2 + 2 = 9
      expect(computeTweetLength("Hello世界")).toBe(9);
    });
  });

  describe("URL handling (t.co weighted count)", () => {
    it("counts a URL as 23 regardless of its real length", () => {
      expect(computeTweetLength("https://example.com")).toBe(URL_WEIGHTED_LENGTH);
      expect(computeTweetLength("https://example.com/a/very/long/path?query=1&foo=bar")).toBe(
        URL_WEIGHTED_LENGTH,
      );
    });

    it("counts http:// URLs as 23", () => {
      expect(computeTweetLength("http://example.com")).toBe(URL_WEIGHTED_LENGTH);
    });

    it("counts text with one URL correctly", () => {
      // "See " = 4 chars, URL = 23, total = 27
      expect(computeTweetLength("See https://example.com")).toBe(27);
    });

    it("counts text with multiple URLs", () => {
      // "A " = 2, 23, " B " = 3, 23 -> 51
      expect(computeTweetLength("A https://example.com B https://example.org")).toBe(51);
    });

    it("counts Japanese + URL", () => {
      // "記事: " = 4 + 2 = 6, URL = 23, total = 29
      // "記事" = 4, ": " = 2, URL = 23 → 29
      expect(computeTweetLength("記事: https://example.com")).toBe(29);
    });
  });

  describe("constants", () => {
    it("exposes max length of 280", () => {
      expect(TWEET_MAX_LENGTH).toBe(280);
    });

    it("exposes URL weighted length of 23", () => {
      expect(URL_WEIGHTED_LENGTH).toBe(23);
    });
  });
});
