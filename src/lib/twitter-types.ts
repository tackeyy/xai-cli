export interface TwitterMeta {
  next_token?: string;
  previous_token?: string;
  result_count?: number;
}

export interface TwitterUser {
  id: string;
  name?: string;
  username?: string;
  description?: string;
  location?: string;
  verified?: boolean;
  protected?: boolean;
  receives_your_dm?: boolean;
  connection_status?: string[];
  pinned_tweet_id?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
  };
  [key: string]: unknown;
}

export interface TwitterReferencedTweet {
  type: "replied_to" | "quoted" | "retweeted";
  id: string;
}

export interface TwitterTweet {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: TwitterReferencedTweet[];
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
  };
  organic_metrics?: {
    impression_count?: number;
  };
  non_public_metrics?: {
    impression_count?: number;
  };
  retweet_count?: number | null;
  reply_count?: number | null;
  quote_count?: number | null;
  like_count?: number | null;
  bookmark_count?: number | null;
  view_count?: number | null;
  engagement?: TwitterEngagementMetrics;
  [key: string]: unknown;
}

export interface TwitterEngagementMetrics {
  retweet_count: number | null;
  reply_count: number | null;
  quote_count: number | null;
  like_count: number | null;
  bookmark_count: number | null;
  view_count: number | null;
}

export interface TwitterMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif" | string;
  url?: string;
  preview_image_url?: string;
}

export interface TwitterIncludes {
  users?: TwitterUser[];
  tweets?: TwitterTweet[];
  media?: TwitterMedia[];
}

export interface TwitterUserLookupResponse {
  data: TwitterUser;
}

export interface TwitterFollowingResponse {
  data: TwitterUser[];
  includes?: TwitterIncludes;
  meta: TwitterMeta;
}

export interface TwitterBookmarkResponse {
  data: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: TwitterMeta;
}

export interface TwitterUserTimelineResponse {
  data: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: TwitterMeta & { requested_count?: number; partial?: boolean };
}

export interface TwitterUserProfile {
  id: string;
  username?: string;
  name?: string;
  description: string | null;
  verified: boolean | null;
  created_at: string | null;
  followers_count: number | null;
  following_count: number | null;
}

export type DmAvailability = "true" | "false" | "unknown";

export interface DmCheckResult {
  username: string;
  user_id: string;
  can_receive_dm: DmAvailability;
  reason: string;
  receives_your_dm: boolean | null;
  connection_status: string[];
  protected: boolean;
  fetched_at: string;
}

export interface TwitterBookmarkFolder {
  id: string;
  name: string;
}

export interface TwitterBookmarkFolderResponse {
  data: TwitterBookmarkFolder[];
  meta: TwitterMeta;
}

export type TwitterAuthMode = "oauth1" | "bearer" | "oauth2-user";

export interface TwitterTweetLookupResponse {
  data: TwitterTweet;
  includes?: TwitterIncludes;
}

export interface TwitterSearchRecentResponse {
  data?: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: TwitterMeta & { newest_id?: string; oldest_id?: string };
}

export interface TwitterConversationResponse {
  conversation_id: string;
  root: TwitterTweet | null;
  tweets: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: {
    result_count: number;
    partial: boolean;
  };
}

export interface TwitterDmEvent {
  id: string;
  text?: string;
  event_type: string;
  created_at?: string;
  sender_id?: string;
  dm_conversation_id?: string;
  attachments?: Record<string, unknown>;
}

export interface TwitterDmEventsResponse {
  data?: TwitterDmEvent[];
  meta?: TwitterMeta;
}

// --- Lists ---

export interface TwitterList {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  private?: boolean;
  follower_count?: number;
  member_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface TwitterListsResponse {
  data: TwitterList[];
  meta: TwitterMeta;
}

export interface TwitterListTweetsResponse {
  data: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: TwitterMeta;
}

export interface TwitterListMembersResponse {
  data: TwitterUser[];
  includes?: TwitterIncludes;
  meta: TwitterMeta;
}

// --- Delete tweet ---

export interface DeleteTweetResult {
  deleted: boolean;
}

// --- Tweet counts (M2) ---

export interface TwitterTweetCount {
  start: string;
  end: string;
  tweet_count: number;
}

export interface TwitterTweetCountsResponse {
  data: TwitterTweetCount[];
  meta: {
    total_tweet_count: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
}

// --- User search (M7) ---

export interface TwitterUserSearchResponse {
  data: TwitterUser[];
  meta: TwitterMeta;
}

// --- Tweets lookup by ids (M1a) ---

export interface TwitterTweetsLookupResponse {
  data: TwitterTweet[];
  includes?: TwitterIncludes;
  meta?: TwitterMeta;
}

// --- Mute / Block (L3) ---

export interface MuteBlockResult {
  /** true when the muting/blocking relationship was created */
  muting?: boolean;
  /** true when the blocking relationship was created */
  blocking?: boolean;
}

// --- Search All (L4) ---
// NOTE: Requires Academic Research / Pro+ tier. Returns 403 on lower tiers.

export interface TwitterSearchAllResponse {
  data?: TwitterTweet[];
  includes?: TwitterIncludes;
  meta: TwitterMeta & { newest_id?: string; oldest_id?: string };
}

// --- Trends (L7) ---
// NOTE: Endpoint spec is subject to change; tier restrictions may apply.

export interface TwitterTrend {
  trend_name: string;
  tweet_count?: number;
  [key: string]: unknown;
}

export interface TwitterTrendsResponse {
  data?: TwitterTrend[];
  [key: string]: unknown;
}

// --- Spaces (L7) ---
// NOTE: Endpoint spec is subject to change; tier restrictions may apply.

export interface TwitterSpace {
  id: string;
  state?: string;
  title?: string;
  created_at?: string;
  host_ids?: string[];
  [key: string]: unknown;
}

export interface TwitterSpacesSearchResponse {
  data?: TwitterSpace[];
  meta?: TwitterMeta;
}
