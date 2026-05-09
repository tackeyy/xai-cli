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

export interface TwitterTweet {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
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

export interface TwitterIncludes {
  users?: TwitterUser[];
  tweets?: TwitterTweet[];
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
