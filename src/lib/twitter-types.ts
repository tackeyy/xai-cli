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
  };
  [key: string]: unknown;
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

export interface TwitterBookmarkFolder {
  id: string;
  name: string;
}

export interface TwitterBookmarkFolderResponse {
  data: TwitterBookmarkFolder[];
  meta: TwitterMeta;
}

export type TwitterAuthMode = "oauth1" | "bearer" | "oauth2-user";
