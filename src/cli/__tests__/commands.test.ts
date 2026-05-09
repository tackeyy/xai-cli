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
    getUserByUsername: vi.fn().mockResolvedValue({
      data: { id: "12345", username: "zeimu_ai", name: "Zeimu AI" },
    }),
    getUserProfileByUsername: vi.fn().mockResolvedValue({
      id: "12345",
      username: "zeimu_ai",
      name: "Zeimu AI",
      description: "AI tax",
      verified: true,
      created_at: "2024-01-01T00:00:00.000Z",
      followers_count: 100,
      following_count: 50,
    }),
    getUserDmStatus: vi.fn().mockResolvedValue({
      username: "zeimu_ai",
      user_id: "12345",
      can_receive_dm: "false",
      reason: "receives_your_dm=false",
      receives_your_dm: false,
      connection_status: ["followed_by"],
      protected: false,
      fetched_at: "2026-05-09T11:55:00.000Z",
    }),
    getUserTimeline: vi.fn().mockResolvedValue({
      data: [{ id: "t1", text: "hello", like_count: 1, retweet_count: null, reply_count: null, quote_count: null, bookmark_count: null, view_count: null }],
      meta: { result_count: 1 },
    }),
    getUserTimelineCount: vi.fn().mockResolvedValue({
      data: [{ id: "t1", text: "hello" }, { id: "t2", text: "world" }],
      meta: { result_count: 2, requested_count: 2 },
    }),
    getFollowing: vi.fn().mockResolvedValue({
      data: [
        { id: "100", username: "user1", name: "User One" },
        { id: "200", username: "user2", name: "User Two" },
      ],
      meta: { result_count: 2 },
    }),
    getAllFollowing: vi.fn().mockResolvedValue({
      data: [
        { id: "100", username: "user1", name: "User One" },
        { id: "200", username: "user2", name: "User Two" },
        { id: "300", username: "user3", name: "User Three" },
      ],
      meta: { result_count: 3 },
    }),
    getAuthenticatedUser: vi.fn().mockResolvedValue({
      data: { id: "me123", username: "myself", name: "Me" },
    }),
    getBookmarks: vi.fn().mockResolvedValue({
      data: [
        { id: "t1", text: "bookmark1", author_id: "a1", created_at: "2026-01-01" },
      ],
      includes: { users: [{ id: "a1", name: "Author", username: "author1" }] },
      meta: { result_count: 1 },
    }),
    getAllBookmarks: vi.fn().mockResolvedValue({
      data: [
        { id: "t1", text: "bookmark1", author_id: "a1" },
        { id: "t2", text: "bookmark2", author_id: "a2" },
      ],
      includes: { users: [{ id: "a1", name: "A1", username: "a1" }, { id: "a2", name: "A2", username: "a2" }] },
      meta: { result_count: 2 },
    }),
    getBookmarkFolders: vi.fn().mockResolvedValue({
      data: [{ id: "f1", name: "AI" }, { id: "f2", name: "Tax" }],
      meta: { result_count: 2 },
    }),
    getAllBookmarkFolders: vi.fn().mockResolvedValue({
      data: [{ id: "f1", name: "AI" }, { id: "f2", name: "Tax" }],
      meta: { result_count: 2 },
    }),
    getBookmarksByFolder: vi.fn().mockResolvedValue({
      data: [{ id: "t3", text: "folder tweet", author_id: "a1" }],
      meta: { result_count: 1 },
    }),
    getAllBookmarksByFolder: vi.fn().mockResolvedValue({
      data: [{ id: "t3", text: "folder tweet", author_id: "a1" }],
      meta: { result_count: 1 },
    }),
    filterBookmarks: vi.fn().mockReturnValue({
      data: [{ id: "t1", text: "matched", author_id: "a1" }],
      meta: { result_count: 1 },
    }),
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

    it("passes --count to client.search", async () => {
      const { xaiClient } = await run(["search", "AI", "--count", "100"]);
      expect(xaiClient.search).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({ count: 100 }),
      );
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

    it("passes --count to client.getUser", async () => {
      const { xaiClient } = await run(["user", "elonmusk", "--count", "10"]);
      expect(xaiClient.getUser).toHaveBeenCalledWith(
        "elonmusk",
        expect.objectContaining({ count: 10 }),
      );
    });

    it("adds profile fields in JSON output when X API lookup succeeds", async () => {
      await run(["--json", "user", "zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.profile.followers_count).toBe(100);
      expect(parsed.profile.following_count).toBe(50);
      expect(parsed.profile.verified).toBe(true);
    });
  });

  describe("dm-check", () => {
    it("checks DM status for a username without @ prefix", async () => {
      const { twitterClient } = await run(["dm-check", "@zeimu_ai"]);
      expect(twitterClient.getUserDmStatus).toHaveBeenCalledWith("zeimu_ai", expect.any(Object));
    });

    it("outputs dm-check JSON when command --json is set", async () => {
      await run(["dm-check", "zeimu_ai", "--json"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed).toMatchObject({
        username: "zeimu_ai",
        user_id: "12345",
        can_receive_dm: "false",
        reason: "receives_your_dm=false",
        receives_your_dm: false,
        connection_status: ["followed_by"],
        protected: false,
      });
    });

    it("outputs dm-check JSON when global --json is set", async () => {
      await run(["--json", "dm-check", "zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.can_receive_dm).toBe("false");
    });

    it("outputs human-readable dm-check result", async () => {
      await run(["dm-check", "zeimu_ai"]);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DM Check Result for @zeimu_ai"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("can_receive_dm: false"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("reason: receives_your_dm=false"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("connection_status: [followed_by]"));
    });

    it("prints error and exits 1 on dm-check failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getUserDmStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 404: Not Found"),
      );

      await run(["dm-check", "deleted"], undefined, tc);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("X API error 404"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("timeline", () => {
    it("resolves handle and calls getUserTimeline", async () => {
      const { twitterClient } = await run(["timeline", "@zeimu_ai"]);
      expect(twitterClient.getUserByUsername).toHaveBeenCalledWith("zeimu_ai", expect.objectContaining({ auth: "bearer" }));
      expect(twitterClient.getUserTimeline).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("passes --count to getUserTimelineCount", async () => {
      const { twitterClient } = await run(["timeline", "12345", "--count", "2"]);
      expect(twitterClient.getUserTimelineCount).toHaveBeenCalledWith(
        "12345",
        expect.objectContaining({ count: 2 }),
      );
    });

    it("outputs normalized timeline JSON", async () => {
      await run(["--json", "timeline", "12345"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.data[0]).toHaveProperty("retweet_count");
      expect(parsed.meta.result_count).toBe(1);
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

  describe("following", () => {
    it("calls getUserByUsername then getFollowing when handle is given", async () => {
      const { twitterClient } = await run(["following", "@zeimu_ai"]);
      expect(twitterClient.getUserByUsername).toHaveBeenCalledWith("zeimu_ai", expect.objectContaining({ auth: "bearer" }));
      expect(twitterClient.getFollowing).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("calls getFollowing directly with numeric user id", async () => {
      const { twitterClient } = await run(["following", "99999"]);
      expect(twitterClient.getUserByUsername).not.toHaveBeenCalled();
      expect(twitterClient.getFollowing).toHaveBeenCalledWith("99999", expect.any(Object));
    });

    it("calls getAllFollowing when --all is set", async () => {
      const { twitterClient } = await run(["following", "@zeimu_ai", "--all"]);
      expect(twitterClient.getAllFollowing).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("outputs following list in human mode", async () => {
      await run(["following", "99999"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Following: 2"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@user1"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "following", "99999"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.meta.result_count).toBe(2);
    });

    it("includes resolved_user in JSON when handle lookup is used", async () => {
      await run(["--json", "following", "@zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.resolved_user).toBeDefined();
      expect(parsed.resolved_user.username).toBe("zeimu_ai");
    });

    it("prints error when --all and --pagination-token both set", async () => {
      await run(["following", "99999", "--all", "--pagination-token", "abc"]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("cannot be used together"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("passes --max-results to getFollowing", async () => {
      const { twitterClient } = await run(["following", "99999", "--max-results", "500"]);
      expect(twitterClient.getFollowing).toHaveBeenCalledWith(
        "99999",
        expect.objectContaining({ maxResults: 500 }),
      );
    });

    it("passes --user-fields to getFollowing", async () => {
      const { twitterClient } = await run(["following", "99999", "--user-fields", "description,location"]);
      expect(twitterClient.getFollowing).toHaveBeenCalledWith(
        "99999",
        expect.objectContaining({ userFields: ["description", "location"] }),
      );
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getFollowing as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 401: Unauthorized"),
      );
      await run(["following", "99999"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("401"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("bookmarks list", () => {
    it("calls getAuthenticatedUser then getBookmarks", async () => {
      const { twitterClient } = await run(["bookmarks", "list"]);
      expect(twitterClient.getAuthenticatedUser).toHaveBeenCalled();
      expect(twitterClient.getBookmarks).toHaveBeenCalledWith("me123", expect.any(Object));
    });

    it("calls getAllBookmarks when --all is set", async () => {
      const { twitterClient } = await run(["bookmarks", "list", "--all"]);
      expect(twitterClient.getAllBookmarks).toHaveBeenCalledWith("me123", expect.any(Object));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "bookmarks", "list"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.authenticated_user).toBe("me123");
      expect(parsed.data).toHaveLength(1);
    });

    it("outputs bookmark info in human mode", async () => {
      await run(["bookmarks", "list"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("t1"));
    });
  });

  describe("bookmarks folders", () => {
    it("calls getBookmarkFolders", async () => {
      const { twitterClient } = await run(["bookmarks", "folders"]);
      expect(twitterClient.getBookmarkFolders).toHaveBeenCalledWith("me123", expect.any(Object));
    });

    it("outputs folder list in human mode", async () => {
      await run(["bookmarks", "folders"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("AI"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "bookmarks", "folders"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.data).toHaveLength(2);
    });
  });

  describe("bookmarks folder", () => {
    it("calls getBookmarksByFolder with folder id", async () => {
      const { twitterClient } = await run(["bookmarks", "folder", "f1"]);
      expect(twitterClient.getBookmarksByFolder).toHaveBeenCalledWith("me123", "f1", expect.any(Object));
    });

    it("outputs JSON with folder_id in json mode", async () => {
      await run(["--json", "bookmarks", "folder", "f1"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.folder_id).toBe("f1");
    });
  });

  describe("bookmarks grep", () => {
    it("calls getBookmarks then filterBookmarks with pattern", async () => {
      const { twitterClient } = await run(["bookmarks", "grep", "税理士"]);
      expect(twitterClient.getBookmarks).toHaveBeenCalled();
      expect(twitterClient.filterBookmarks).toHaveBeenCalledWith(
        expect.any(Object),
        "税理士",
        expect.objectContaining({ field: "all" }),
      );
    });

    it("outputs JSON with pattern and match_count in json mode", async () => {
      await run(["--json", "bookmarks", "grep", "test"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.pattern).toBe("test");
      expect(parsed.match_count).toBe(1);
    });

    it("passes --ignore-case to filterBookmarks", async () => {
      const { twitterClient } = await run(["bookmarks", "grep", "TEST", "--ignore-case"]);
      expect(twitterClient.filterBookmarks).toHaveBeenCalledWith(
        expect.any(Object),
        "TEST",
        expect.objectContaining({ ignoreCase: true }),
      );
    });

    it("passes --field to filterBookmarks", async () => {
      const { twitterClient } = await run(["bookmarks", "grep", "test", "--field", "text"]);
      expect(twitterClient.filterBookmarks).toHaveBeenCalledWith(
        expect.any(Object),
        "test",
        expect.objectContaining({ field: "text" }),
      );
    });

    it("uses folder source when --folder-id is set", async () => {
      const { twitterClient } = await run(["bookmarks", "grep", "test", "--folder-id", "f1"]);
      expect(twitterClient.getBookmarksByFolder).toHaveBeenCalledWith("me123", "f1", expect.any(Object));
    });

    it("shows no matches message in human mode when nothing found", async () => {
      const tc = createMockTwitterClient();
      (tc.filterBookmarks as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [],
        meta: { result_count: 0 },
      });
      await run(["bookmarks", "grep", "zzz"], undefined, tc);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No bookmarks matching'));
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
