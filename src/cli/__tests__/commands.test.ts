import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProgram } from "../index.js";
import type { XaiClient } from "../../lib/client.js";
import type { TwitterClient } from "../../lib/twitter-client.js";

function createMockClient(): XaiClient {
  return {
    search: vi.fn().mockResolvedValue({ text: "search results" }),
    getUser: vi.fn().mockResolvedValue({ text: "user tweets" }),
    getTweet: vi.fn().mockResolvedValue({ text: "tweet content" }),
    getTweetWithImages: vi.fn().mockResolvedValue({ text: "tweet with images" }),
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
    updateProfile: vi.fn().mockResolvedValue({
      screenName: "3chhe",
      name: "Yusuke",
      description: "new bio",
      url: "https://example.com",
      location: "Tokyo",
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
    getTweetById: vi.fn().mockResolvedValue({
      data: {
        id: "999",
        text: "hello world",
        conversation_id: "100",
        referenced_tweets: [{ type: "replied_to", id: "100" }],
        created_at: "2026-05-25T10:01:00Z",
      },
      includes: { tweets: [{ id: "100", text: "root" }] },
    }),
    searchRecent: vi.fn().mockResolvedValue({
      data: [{ id: "100", text: "root" }, { id: "999", text: "hello world" }],
      meta: { result_count: 2 },
    }),
    getConversation: vi.fn().mockResolvedValue({
      conversation_id: "100",
      root: { id: "100", text: "root", created_at: "2026-05-25T10:00:00Z" },
      tweets: [
        { id: "100", text: "root", created_at: "2026-05-25T10:00:00Z" },
        { id: "999", text: "hello world", created_at: "2026-05-25T10:01:00Z" },
      ],
      meta: { result_count: 2, partial: false },
    }),
    getTweetMediaUrls: vi.fn().mockResolvedValue([]),
    getMentions: vi.fn().mockResolvedValue({
      data: [{ id: "m1", text: "@me hi", like_count: null, retweet_count: null, reply_count: null, quote_count: null, bookmark_count: null, view_count: null }],
      meta: { result_count: 1 },
    }),
    getMentionsCount: vi.fn().mockResolvedValue({
      data: [{ id: "m1", text: "@me hi" }, { id: "m2", text: "@me hey" }],
      meta: { result_count: 2, requested_count: 2, partial: false },
    }),
    getDmEvents: vi.fn().mockResolvedValue({
      data: [{ id: "e1", text: "hello DM", event_type: "MessageCreate", sender_id: "42", created_at: "2026-01-01T00:00:00.000Z", dm_conversation_id: "conv99" }],
      meta: { result_count: 1 },
    }),
    getProfileBanner: vi.fn().mockResolvedValue({
      hasBanner: true,
      sizes: {
        "1500x500": "https://pbs.twimg.com/profile_banners/123/456/1500x500",
        "1080x360": "https://pbs.twimg.com/profile_banners/123/456/1080x360",
        "600x200": "https://pbs.twimg.com/profile_banners/123/456/600x200",
        "300x100": "https://pbs.twimg.com/profile_banners/123/456/300x100",
      },
    }),
    updateProfileBanner: vi.fn().mockResolvedValue(undefined),
    removeProfileBanner: vi.fn().mockResolvedValue(undefined),
    validateBannerImage: vi.fn(),
    getFollowers: vi.fn().mockResolvedValue({
      data: [
        { id: "100", username: "follower1", name: "Follower One" },
        { id: "200", username: "follower2", name: "Follower Two" },
      ],
      meta: { result_count: 2 },
    }),
    getAllFollowers: vi.fn().mockResolvedValue({
      data: [
        { id: "100", username: "follower1", name: "Follower One" },
        { id: "200", username: "follower2", name: "Follower Two" },
        { id: "300", username: "follower3", name: "Follower Three" },
      ],
      meta: { result_count: 3 },
    }),
    getOwnedLists: vi.fn().mockResolvedValue({
      data: [
        { id: "list1", name: "Tech", description: "Tech list" },
        { id: "list2", name: "AI News" },
      ],
      meta: { result_count: 2 },
    }),
    getListTweets: vi.fn().mockResolvedValue({
      data: [
        { id: "t10", text: "List tweet 1", author_id: "a1", created_at: "2026-06-01T00:00:00Z" },
        { id: "t11", text: "List tweet 2", author_id: "a2", created_at: "2026-06-02T00:00:00Z" },
      ],
      includes: { users: [{ id: "a1", username: "author1", name: "Author One" }, { id: "a2", username: "author2", name: "Author Two" }] },
      meta: { result_count: 2 },
    }),
    getListMembers: vi.fn().mockResolvedValue({
      data: [
        { id: "m1", username: "member1", name: "Member One" },
        { id: "m2", username: "member2", name: "Member Two" },
      ],
      meta: { result_count: 2 },
    }),
    deleteTweet: vi.fn().mockResolvedValue({ deleted: true }),
    uploadMedia: vi.fn().mockResolvedValue("media_default_id"),
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

    it.each([1, 999, 1000])("accepts --count boundary value %i", async (count) => {
      const { xaiClient } = await run(["search", "AI", "--count", String(count)]);
      expect(xaiClient.search).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({ count }),
      );
    });

    it.each(["0", "-1"])("rejects invalid --count value %s", async (count) => {
      const xaiClient = createMockClient();
      await expect(run(["search", "AI", "--count", count], xaiClient)).rejects.toThrow(
        "must be a positive integer",
      );
      expect(xaiClient.search).not.toHaveBeenCalled();
    });

    it("--raw calls twitterClient.searchRecent and outputs raw JSON", async () => {
      const { twitterClient } = await run(["search", "AI", "--raw"]);
      expect(twitterClient.searchRecent).toHaveBeenCalledWith("AI", expect.any(Object));
    });

    it("--raw + --from/--to passes startTime/endTime to searchRecent", async () => {
      const { twitterClient } = await run(["search", "AI", "--raw", "--from", "2026-01-01", "--to", "2026-01-31"]);
      expect(twitterClient.searchRecent).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({ startTime: "2026-01-01T00:00:00Z", endTime: "2026-01-31T23:59:59Z" }),
      );
    });

    it("--raw + --count passes maxResults to searchRecent", async () => {
      const { twitterClient } = await run(["search", "AI", "--raw", "--count", "50"]);
      expect(twitterClient.searchRecent).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it("--raw + --count 200 caps maxResults at 100 and warns to stderr", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const { twitterClient } = await run(["search", "AI", "--raw", "--count", "200"]);
      expect(twitterClient.searchRecent).toHaveBeenCalledWith(
        "AI",
        expect.objectContaining({ maxResults: 100 }),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("max_results is capped at 100 for --raw mode"),
      );
      stderrSpy.mockRestore();
    });

    it("--raw + --exclude warns to stderr about being ignored", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await run(["search", "AI", "--raw", "--exclude", "spam1"]);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("--exclude is not supported with --raw"),
      );
      stderrSpy.mockRestore();
    });

    it("--raw without --json outputs raw JSON string", async () => {
      await run(["search", "AI", "--raw"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("data");
    });

    it("without --raw calls client.search (LLM path) as before", async () => {
      const { xaiClient } = await run(["search", "AI"]);
      expect(xaiClient.search).toHaveBeenCalledWith("AI", expect.any(Object));
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

    it.each([1, 999, 1000])("accepts user --count boundary value %i", async (count) => {
      const { xaiClient } = await run(["user", "elonmusk", "--count", String(count)]);
      expect(xaiClient.getUser).toHaveBeenCalledWith(
        "elonmusk",
        expect.objectContaining({ count }),
      );
    });

    it.each(["0", "-1"])("rejects invalid user --count value %s", async (count) => {
      const xaiClient = createMockClient();
      await expect(run(["user", "elonmusk", "--count", count], xaiClient)).rejects.toThrow(
        "must be a positive integer",
      );
      expect(xaiClient.getUser).not.toHaveBeenCalled();
    });

    it("adds profile fields in JSON output when X API lookup succeeds", async () => {
      await run(["--json", "user", "zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.profile.followers_count).toBe(100);
      expect(parsed.profile.following_count).toBe(50);
      expect(parsed.profile.verified).toBe(true);
    });
  });

  describe("profile get", () => {
    it("calls getUserProfileByUsername with the stripped handle", async () => {
      const { twitterClient } = await run(["profile", "get", "@zeimu_ai"]);
      expect(twitterClient.getUserProfileByUsername).toHaveBeenCalledWith("zeimu_ai");
    });

    it("outputs the full profile as JSON with --json", async () => {
      await run(["--json", "profile", "get", "zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.username).toBe("zeimu_ai");
      expect(parsed.description).toBe("AI tax");
      expect(parsed.followers_count).toBe(100);
      expect(parsed.bio_char_count).toBe(6);
      expect(parsed.bio_line_count).toBe(1);
    });

    it("prints the bio verbatim in human mode", async () => {
      await run(["profile", "get", "zeimu_ai"]);
      const printed = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(printed).toContain("AI tax");
      expect(printed).toContain("@zeimu_ai");
    });

    it("shows bio char and line count in human mode", async () => {
      await run(["profile", "get", "zeimu_ai"]);
      const printed = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(printed).toContain("6字");
      expect(printed).toContain("1行");
    });

    it("counts line breaks in a multi-line bio", async () => {
      const tc = createMockTwitterClient();
      (tc as any).getUserProfileByUsername = vi.fn().mockResolvedValue({
        id: "1", username: "awakia", name: "A",
        description: "line1\nline2\nline3",
        verified: null, created_at: null, followers_count: null, following_count: null,
      });
      await run(["--json", "profile", "get", "awakia"], undefined, tc);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.bio_line_count).toBe(3);
    });

    it("handles a null bio without crashing", async () => {
      const tc = createMockTwitterClient();
      (tc as any).getUserProfileByUsername = vi.fn().mockResolvedValue({
        id: "1", username: "nobio", name: "N",
        description: null,
        verified: null, created_at: null, followers_count: null, following_count: null,
      });
      await run(["--json", "profile", "get", "nobio"], undefined, tc);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.bio_char_count).toBe(0);
      expect(parsed.bio_line_count).toBe(0);
    });

    it("prints error and exits 1 on lookup failure", async () => {
      const tc = createMockTwitterClient();
      (tc as any).getUserProfileByUsername = vi.fn().mockRejectedValue(new Error("403 Forbidden"));
      await run(["profile", "get", "deleted"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
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


  describe("mentions", () => {
    it("resolves handle and calls getMentions", async () => {
      const { twitterClient } = await run(["mentions", "@zeimu_ai"]);
      expect(twitterClient.getUserByUsername).toHaveBeenCalledWith("zeimu_ai", expect.objectContaining({ auth: "bearer" }));
      expect(twitterClient.getMentions).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("--json outputs mentions with resolved_user", async () => {
      await run(["--json", "mentions", "@zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed).toHaveProperty("data");
      expect(parsed.meta.result_count).toBe(1);
    });

    it("--count calls getMentionsCount instead of getMentions", async () => {
      const { twitterClient } = await run(["mentions", "@zeimu_ai", "--count", "2"]);
      expect(twitterClient.getMentionsCount).toHaveBeenCalledWith(
        "12345",
        expect.objectContaining({ count: 2 }),
      );
      expect(twitterClient.getMentions).not.toHaveBeenCalled();
    });
  });

  describe("dm-history", () => {
    it("calls getDmEvents and outputs human-readable list", async () => {
      const { twitterClient } = await run(["dm-history"]);
      expect(twitterClient.getDmEvents).toHaveBeenCalledWith(expect.any(Object));
    });

    it("human output includes sender_id and created_at", async () => {
      await run(["dm-history"]);
      const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(allOutput).toContain("sender=42");
      expect(allOutput).toContain("2026-01-01T00:00:00.000Z");
      expect(allOutput).toContain("conv=conv99");
      expect(allOutput).toContain("hello DM");
    });

    it("--json outputs raw DM events response", async () => {
      await run(["--json", "dm-history"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed).toHaveProperty("data");
      expect(parsed.meta.result_count).toBe(1);
    });

    it("outputs error with Elevated/paid tier message on 403", async () => {
      const tc = createMockTwitterClient();
      (tc.getDmEvents as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Requires Elevated/paid tier access. Forbidden"),
      );
      await run(["dm-history"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Requires Elevated/paid tier access"));
    });

    it("--event-types passes eventTypes to getDmEvents", async () => {
      const { twitterClient } = await run(["dm-history", "--event-types", "MessageCreate"]);
      expect(twitterClient.getDmEvents).toHaveBeenCalledWith(
        expect.objectContaining({ eventTypes: "MessageCreate" }),
      );
    });
  });

  describe("tweet", () => {
    it("should call client.getTweet with URL (default LLM path)", async () => {
      const url = "https://x.com/elonmusk/status/123";
      const { xaiClient, twitterClient } = await run(["tweet", url]);
      expect(xaiClient.getTweet).toHaveBeenCalledWith(url);
      expect(twitterClient.getTweetById).not.toHaveBeenCalled();
    });

    it("should call twitterClient.getTweetById with --raw", async () => {
      const url = "https://x.com/elonmusk/status/123";
      const { xaiClient, twitterClient } = await run(["tweet", url, "--raw"]);
      expect(twitterClient.getTweetById).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ auth: "bearer" }),
      );
      expect(xaiClient.getTweet).not.toHaveBeenCalled();
    });

    it("should pass --tweet-fields and --expansions in --raw mode", async () => {
      const { twitterClient } = await run([
        "tweet",
        "123",
        "--raw",
        "--tweet-fields",
        "id,text",
        "--expansions",
        "author_id",
      ]);
      expect(twitterClient.getTweetById).toHaveBeenCalledWith(
        "123",
        expect.objectContaining({
          tweetFields: ["id", "text"],
          expansions: ["author_id"],
        }),
      );
    });

    it("--raw --json outputs structured response", async () => {
      await run(["--json", "tweet", "123", "--raw"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.data.id).toBe("999");
      expect(parsed.data.conversation_id).toBe("100");
    });

    // --- --image flag tests (Issue #15) ---

    it("--image: tweet without images falls back to text-only output", async () => {
      // getTweetMediaUrls returns empty array → no Vision call
      const tc = createMockTwitterClient();
      (tc.getTweetMediaUrls as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const xc = createMockClient();
      const url = "https://x.com/elonmusk/status/123";
      await run(["tweet", url, "--image"], xc, tc);
      expect(xc.getTweet).toHaveBeenCalledWith(url);
      expect(xc.getTweetWithImages).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("tweet content"));
    });

    it("--image: single image triggers Vision analysis and outputs combined Markdown", async () => {
      const tc = createMockTwitterClient();
      (tc.getTweetMediaUrls as ReturnType<typeof vi.fn>).mockResolvedValue([
        "https://pbs.twimg.com/media/image1.jpg",
      ]);
      const xc = createMockClient();
      const url = "https://x.com/elonmusk/status/456";
      await run(["tweet", url, "--image"], xc, tc);
      expect(xc.getTweet).toHaveBeenCalledWith(url);
      expect(xc.getTweetWithImages).toHaveBeenCalledWith(
        url,
        ["https://pbs.twimg.com/media/image1.jpg"],
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("tweet with images"));
    });

    it("--image: multiple images (up to 4) are all passed to Vision", async () => {
      const tc = createMockTwitterClient();
      const imageUrls = [
        "https://pbs.twimg.com/media/img1.jpg",
        "https://pbs.twimg.com/media/img2.jpg",
        "https://pbs.twimg.com/media/img3.jpg",
        "https://pbs.twimg.com/media/img4.jpg",
        "https://pbs.twimg.com/media/img5.jpg", // 5th should be capped
      ];
      (tc.getTweetMediaUrls as ReturnType<typeof vi.fn>).mockResolvedValue(imageUrls);
      const xc = createMockClient();
      const url = "https://x.com/elonmusk/status/789";
      await run(["tweet", url, "--image"], xc, tc);
      expect(xc.getTweetWithImages).toHaveBeenCalledWith(
        url,
        imageUrls.slice(0, 4), // max 4
      );
    });

    it("--image: Vision API error falls back gracefully to text-only output", async () => {
      const tc = createMockTwitterClient();
      (tc.getTweetMediaUrls as ReturnType<typeof vi.fn>).mockResolvedValue([
        "https://pbs.twimg.com/media/image1.jpg",
      ]);
      const xc = createMockClient();
      (xc.getTweetWithImages as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Vision API error 500"),
      );
      const url = "https://x.com/elonmusk/status/999";
      await run(["tweet", url, "--image"], xc, tc);
      // Falls back to text-only
      expect(xc.getTweet).toHaveBeenCalledWith(url);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("tweet content"));
      // Warning is printed to stderr
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Vision API error"),
      );
    });
  });

  describe("thread", () => {
    it("should call getConversation with the id", async () => {
      const { twitterClient } = await run(["thread", "100"]);
      expect(twitterClient.getConversation).toHaveBeenCalledWith(
        "100",
        expect.objectContaining({ auth: "bearer" }),
      );
    });

    it("accepts URL form", async () => {
      const url = "https://x.com/foo/status/777";
      const { twitterClient } = await run(["thread", url]);
      expect(twitterClient.getConversation).toHaveBeenCalledWith(
        url,
        expect.any(Object),
      );
    });

    it("passes --all and --max-results", async () => {
      const { twitterClient } = await run([
        "thread",
        "100",
        "--all",
        "--max-results",
        "50",
      ]);
      expect(twitterClient.getConversation).toHaveBeenCalledWith(
        "100",
        expect.objectContaining({ all: true, maxResults: 50 }),
      );
    });

    it("--json outputs full conversation", async () => {
      await run(["--json", "thread", "100"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.conversation_id).toBe("100");
      expect(parsed.tweets).toHaveLength(2);
      expect(parsed.meta.partial).toBe(false);
    });

    it("rejects out-of-range --max-results", async () => {
      await expect(
        run(["thread", "100", "--max-results", "5"]),
      ).rejects.toThrow(/max-results/i);
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

  describe("update-profile", () => {
    it("calls twitterClient.updateProfile with mapped fields", async () => {
      const { twitterClient } = await run(["update-profile", "--bio", "new bio"]);
      expect(twitterClient.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ bio: "new bio" }),
      );
    });

    it("outputs confirmation in human mode", async () => {
      await run(["update-profile", "--bio", "new bio"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Profile updated"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@3chhe"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "update-profile", "--name", "Yusuke"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.screenName).toBe("3chhe");
    });

    it("does NOT call updateProfile in dry-run mode", async () => {
      const { twitterClient } = await run(["update-profile", "--dry-run", "--bio", "hi"]);
      expect(twitterClient.updateProfile).not.toHaveBeenCalled();
    });

    it("prints endpoint in dry-run mode", async () => {
      await run(["update-profile", "--dry-run", "--bio", "hi"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("account/update_profile.json"));
    });

    it("errors and exits 1 when no fields given (dry-run validation)", async () => {
      await run(["update-profile", "--dry-run"]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("at least one"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("prints error and exit 1 on updateProfile failure", async () => {
      const tc = createMockTwitterClient();
      (tc.updateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden Requires Elevated/paid tier access."),
      );
      await run(["update-profile", "--bio", "x"], undefined, tc);
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

    it("passes --quote-tweet-id through to postTweet", async () => {
      const { twitterClient } = await run([
        "post",
        "--text",
        "great post",
        "--quote-tweet-id",
        "888777666",
      ]);
      expect(twitterClient.postTweet).toHaveBeenCalledWith(
        expect.objectContaining({ quoteTweetId: "888777666" }),
      );
    });

    it("passes --quote-tweet-id to buildPostPayload (dry-run)", async () => {
      await run(["post", "--dry-run", "--text", "quoting", "--quote-tweet-id", "111"]);
      const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(allOutput).toContain("quote_tweet_id");
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

    it("--media calls uploadMedia for each file then postTweet with media_ids", async () => {
      const { writeFileSync, unlinkSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp1 = join(tmpdir(), "test-post-media1.jpg");
      const tmp2 = join(tmpdir(), "test-post-media2.png");
      writeFileSync(tmp1, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
      writeFileSync(tmp2, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const tc = createMockTwitterClient();
      (tc as any).uploadMedia = vi.fn()
        .mockResolvedValueOnce("media_aaa")
        .mockResolvedValueOnce("media_bbb");

      try {
        const { twitterClient } = await run(
          ["post", "--text", "with media", "--media", tmp1, tmp2],
          undefined,
          tc,
        );
        expect((twitterClient as any).uploadMedia).toHaveBeenCalledTimes(2);
        expect((twitterClient as any).uploadMedia).toHaveBeenCalledWith(tmp1);
        expect((twitterClient as any).uploadMedia).toHaveBeenCalledWith(tmp2);
        expect(twitterClient.postTweet).toHaveBeenCalledWith(
          expect.objectContaining({ mediaIds: ["media_aaa", "media_bbb"] }),
        );
      } finally {
        unlinkSync(tmp1);
        unlinkSync(tmp2);
      }
    });

    it("--media --dry-run shows file paths and media_type without calling uploadMedia or postTweet", async () => {
      const { writeFileSync, unlinkSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-dry-media.jpg");
      writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

      const tc = createMockTwitterClient();
      (tc as any).uploadMedia = vi.fn();

      try {
        await run(["post", "--dry-run", "--text", "hi", "--media", tmp], undefined, tc);
        expect((tc as any).uploadMedia).not.toHaveBeenCalled();
        expect(tc.postTweet).not.toHaveBeenCalled();
        const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
        expect(allOutput).toContain("[dry-run]");
        expect(allOutput).toContain(tmp);
        expect(allOutput).toMatch(/image\/jpeg/);
      } finally {
        unlinkSync(tmp);
      }
    });

    it("--media --dry-run --json includes media_files array in JSON output", async () => {
      const { writeFileSync, unlinkSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-dry-media-json.png");
      writeFileSync(tmp, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const tc = createMockTwitterClient();
      (tc as any).uploadMedia = vi.fn();

      try {
        await run(["--json", "post", "--dry-run", "--text", "hi", "--media", tmp], undefined, tc);
        const parsed = JSON.parse(logSpy.mock.calls[0][0]);
        expect(parsed.dry_run).toBe(true);
        expect(parsed.media_files).toBeDefined();
        expect(parsed.media_files).toHaveLength(1);
        expect(parsed.media_files[0].path).toBe(tmp);
        expect(parsed.media_files[0].media_type).toBe("image/png");
      } finally {
        unlinkSync(tmp);
      }
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

  // ============================================================
  // banner commands
  // ============================================================
  describe("banner get", () => {
    it("calls getProfileBanner with authenticated user screen_name when no --handle", async () => {
      const { twitterClient } = await run(["banner", "get"]);
      // resolves via getAuthenticatedUser → username="myself"
      expect(twitterClient.getProfileBanner).toHaveBeenCalledWith("myself");
    });

    it("calls getProfileBanner with --handle when provided", async () => {
      const { twitterClient } = await run(["banner", "get", "--handle", "someuser"]);
      expect(twitterClient.getProfileBanner).toHaveBeenCalledWith("someuser");
    });

    it("strips @ from --handle", async () => {
      const { twitterClient } = await run(["banner", "get", "--handle", "@someuser"]);
      expect(twitterClient.getProfileBanner).toHaveBeenCalledWith("someuser");
    });

    it("outputs banner sizes in human mode", async () => {
      await run(["banner", "get"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("1500x500"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "banner", "get"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.hasBanner).toBe(true);
      expect(parsed.sizes["1500x500"]).toContain("pbs.twimg.com");
    });

    it("shows no-banner message when hasBanner=false", async () => {
      const tc = createMockTwitterClient();
      (tc.getProfileBanner as ReturnType<typeof vi.fn>).mockResolvedValue({
        hasBanner: false,
        sizes: {},
      });
      await run(["banner", "get"], undefined, tc);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("no banner"));
    });

    it("does NOT call getProfileBanner in --dry-run mode", async () => {
      const { twitterClient } = await run(["banner", "get", "--dry-run"]);
      expect(twitterClient.getProfileBanner).not.toHaveBeenCalled();
      expect(twitterClient.getAuthenticatedUser).not.toHaveBeenCalled();
    });

    it("prints error and exit 1 on failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getProfileBanner as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden"),
      );
      await run(["banner", "get"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("X API error 403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("downloads and saves the banner with --save", async () => {
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { existsSync, rmSync } = await import("node:fs");
      const out = join(tmpdir(), "xai-get-save-test.jpg");
      const tc = createMockTwitterClient();
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]).buffer, { status: 200 }),
      );
      try {
        await run(["banner", "get", "--save", out], undefined, tc);
        expect(existsSync(out)).toBe(true);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Saved to"));
      } finally {
        fetchSpy.mockRestore();
        if (existsSync(out)) rmSync(out);
      }
    });
  });

  describe("banner backup", () => {
    it("calls getProfileBanner and logs backup path", async () => {
      // Note: actual file download is skipped when fetch is not fully mocked here;
      // we only verify the getProfileBanner call happens.
      // The backup subcommand resolves handle via getAuthenticatedUser.
      const tc = createMockTwitterClient();
      // Mock fetch for the image download
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]).buffer, { status: 200 }),
      );
      try {
        await run(["banner", "backup"], undefined, tc);
        expect(tc.getProfileBanner).toHaveBeenCalledWith("myself");
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("shows no-banner message when hasBanner=false", async () => {
      const tc = createMockTwitterClient();
      (tc.getProfileBanner as ReturnType<typeof vi.fn>).mockResolvedValue({
        hasBanner: false,
        sizes: {},
      });
      await run(["banner", "backup"], undefined, tc);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("no banner"));
    });

    it("does NOT call getProfileBanner in dry-run", async () => {
      const { twitterClient } = await run(["banner", "backup", "--dry-run", "--handle", "someuser"]);
      expect(twitterClient.getProfileBanner).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
    });

    it("errors and exits 1 when image download fails", async () => {
      const tc = createMockTwitterClient();
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 403 }));
      try {
        await run(["banner", "backup"], undefined, tc);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to download"));
        expect(exitSpy).toHaveBeenCalledWith(1);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("outputs JSON with saved path in --json mode", async () => {
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tc = createMockTwitterClient();
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]).buffer, { status: 200 }),
      );
      try {
        await run(["--json", "banner", "backup", "--dir", join(tmpdir(), "xai-banner-test")], undefined, tc);
        const parsed = JSON.parse(logSpy.mock.calls[0][0]);
        expect(parsed.saved).toBe(true);
        expect(parsed.path).toContain("myself-");
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe("banner set", () => {
    it("calls updateProfileBanner with base64 data", async () => {
      // Create a tiny temp file
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-banner.jpg");
      writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // JPEG magic bytes
      const { twitterClient } = await run(["banner", "set", tmp]);
      expect(twitterClient.updateProfileBanner).toHaveBeenCalled();
    });

    it("does NOT call updateProfileBanner in --dry-run mode", async () => {
      const { writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-banner-dry.jpg");
      writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
      const { twitterClient } = await run(["banner", "set", tmp, "--dry-run"]);
      expect(twitterClient.updateProfileBanner).not.toHaveBeenCalled();
    });

    it("exits 1 when file does not exist", async () => {
      await run(["banner", "set", "/nonexistent/path/image.jpg"]);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits 1 when extension is invalid", async () => {
      const { writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test.bmp");
      writeFileSync(tmp, Buffer.from([0x42, 0x4d]));
      const tc = createMockTwitterClient();
      (tc.validateBannerImage as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Invalid image extension: bmp");
      });
      await run(["banner", "set", tmp], undefined, tc);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("outputs [dry-run] message in dry-run mode", async () => {
      const { writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-banner-dry2.jpg");
      writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
      await run(["banner", "set", tmp, "--dry-run"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
    });
  });

  describe("banner remove", () => {
    it("calls removeProfileBanner", async () => {
      const { twitterClient } = await run(["banner", "remove"]);
      expect(twitterClient.removeProfileBanner).toHaveBeenCalled();
    });

    it("does NOT call removeProfileBanner in --dry-run mode", async () => {
      const { twitterClient } = await run(["banner", "remove", "--dry-run"]);
      expect(twitterClient.removeProfileBanner).not.toHaveBeenCalled();
    });

    it("outputs confirmation in human mode", async () => {
      await run(["banner", "remove"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Banner removed"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "banner", "remove"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.removed).toBe(true);
    });

    it("outputs [dry-run] message in dry-run mode", async () => {
      await run(["banner", "remove", "--dry-run"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
    });

    it("prints error and exit 1 on failure", async () => {
      const tc = createMockTwitterClient();
      (tc.removeProfileBanner as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden"),
      );
      await run(["banner", "remove"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("X API error 403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("banner restore", () => {
    it("calls updateProfileBanner (alias for set)", async () => {
      const { writeFileSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tmp = join(tmpdir(), "test-restore.jpg");
      writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
      const { twitterClient } = await run(["banner", "restore", tmp]);
      expect(twitterClient.updateProfileBanner).toHaveBeenCalled();
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

  describe("followers", () => {
    it("calls getUserByUsername then getFollowers when handle is given", async () => {
      const { twitterClient } = await run(["followers", "@zeimu_ai"]);
      expect(twitterClient.getUserByUsername).toHaveBeenCalledWith("zeimu_ai", expect.objectContaining({ auth: "bearer" }));
      expect(twitterClient.getFollowers).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("calls getFollowers directly with numeric user id", async () => {
      const { twitterClient } = await run(["followers", "99999"]);
      expect(twitterClient.getUserByUsername).not.toHaveBeenCalled();
      expect(twitterClient.getFollowers).toHaveBeenCalledWith("99999", expect.any(Object));
    });

    it("calls getAllFollowers when --all is set", async () => {
      const { twitterClient } = await run(["followers", "@zeimu_ai", "--all"]);
      expect(twitterClient.getAllFollowers).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("outputs followers list in human mode", async () => {
      await run(["followers", "99999"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Followers: 2"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@follower1"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "followers", "99999"]);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.meta.result_count).toBe(2);
    });

    it("includes resolved_user in JSON when handle lookup is used", async () => {
      await run(["--json", "followers", "@zeimu_ai"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.resolved_user).toBeDefined();
      expect(parsed.resolved_user.username).toBe("zeimu_ai");
    });

    it("prints error when --all and --pagination-token both set", async () => {
      await run(["followers", "99999", "--all", "--pagination-token", "abc"]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("cannot be used together"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("passes --max-results to getFollowers", async () => {
      const { twitterClient } = await run(["followers", "99999", "--max-results", "500"]);
      expect(twitterClient.getFollowers).toHaveBeenCalledWith(
        "99999",
        expect.objectContaining({ maxResults: 500 }),
      );
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getFollowers as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 401: Unauthorized"),
      );
      await run(["followers", "99999"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("401"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("lists", () => {
    it("calls getUserByUsername then getOwnedLists when handle is given", async () => {
      const { twitterClient } = await run(["lists", "@zeimu_ai"]);
      expect(twitterClient.getUserByUsername).toHaveBeenCalledWith("zeimu_ai", expect.any(Object));
      expect(twitterClient.getOwnedLists).toHaveBeenCalledWith("12345", expect.any(Object));
    });

    it("calls getOwnedLists directly with numeric user id", async () => {
      const { twitterClient } = await run(["lists", "99999"]);
      expect(twitterClient.getUserByUsername).not.toHaveBeenCalled();
      expect(twitterClient.getOwnedLists).toHaveBeenCalledWith("99999", expect.any(Object));
    });

    it("outputs lists in human mode", async () => {
      await run(["lists", "99999"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Lists: 2"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Tech"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "lists", "99999"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.meta.result_count).toBe(2);
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getOwnedLists as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 401: Unauthorized"),
      );
      await run(["lists", "99999"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("401"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("list-tweets", () => {
    it("calls getListTweets with list id", async () => {
      const { twitterClient } = await run(["list-tweets", "list99"]);
      expect(twitterClient.getListTweets).toHaveBeenCalledWith("list99", expect.any(Object));
    });

    it("outputs tweets in human mode", async () => {
      await run(["list-tweets", "list99"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("t10"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@author1"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "list-tweets", "list99"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.data).toHaveLength(2);
    });

    it("passes --max-results to getListTweets", async () => {
      const { twitterClient } = await run(["list-tweets", "list99", "--max-results", "50"]);
      expect(twitterClient.getListTweets).toHaveBeenCalledWith(
        "list99",
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getListTweets as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden"),
      );
      await run(["list-tweets", "list99"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("list-members", () => {
    it("calls getListMembers with list id", async () => {
      const { twitterClient } = await run(["list-members", "list99"]);
      expect(twitterClient.getListMembers).toHaveBeenCalledWith("list99", expect.any(Object));
    });

    it("outputs members in human mode", async () => {
      await run(["list-members", "list99"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Members: 2"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("@member1"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "list-members", "list99"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.data).toHaveLength(2);
    });

    it("passes --user-fields to getListMembers", async () => {
      const { twitterClient } = await run(["list-members", "list99", "--user-fields", "username,name"]);
      expect(twitterClient.getListMembers).toHaveBeenCalledWith(
        "list99",
        expect.objectContaining({ userFields: ["username", "name"] }),
      );
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.getListMembers as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 404: Not Found"),
      );
      await run(["list-members", "list99"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("404"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("delete", () => {
    it("calls deleteTweet with tweet id", async () => {
      const { twitterClient } = await run(["delete", "99999"]);
      expect(twitterClient.deleteTweet).toHaveBeenCalledWith("99999");
    });

    it("outputs confirmation in human mode", async () => {
      await run(["delete", "99999"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("99999"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("deleted: true"));
    });

    it("outputs JSON in json mode", async () => {
      await run(["--json", "delete", "99999"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.tweet_id).toBe("99999");
      expect(parsed.deleted).toBe(true);
    });

    it("does NOT call deleteTweet in --dry-run mode", async () => {
      const { twitterClient } = await run(["delete", "99999", "--dry-run"]);
      expect(twitterClient.deleteTweet).not.toHaveBeenCalled();
    });

    it("outputs dry-run info in human mode", async () => {
      await run(["delete", "99999", "--dry-run"]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[dry-run]"));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("DELETE"));
    });

    it("outputs JSON dry-run in json mode", async () => {
      await run(["--json", "delete", "99999", "--dry-run"]);
      const parsed = JSON.parse(logSpy.mock.calls[0][0]);
      expect(parsed.dry_run).toBe(true);
      expect(parsed.method).toBe("DELETE");
    });

    it("prints error and exit 1 on API failure", async () => {
      const tc = createMockTwitterClient();
      (tc.deleteTweet as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("X API error 403: Forbidden"),
      );
      await run(["delete", "99999"], undefined, tc);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
