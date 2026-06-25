import { extname } from "node:path";

export interface PostMediaTypeInfo {
  mediaType: string;
  mediaCategory: "tweet_image" | "tweet_gif" | "tweet_video";
}

const POST_MEDIA_TYPES: Record<string, PostMediaTypeInfo> = {
  jpg: { mediaType: "image/jpeg", mediaCategory: "tweet_image" },
  jpeg: { mediaType: "image/jpeg", mediaCategory: "tweet_image" },
  png: { mediaType: "image/png", mediaCategory: "tweet_image" },
  webp: { mediaType: "image/webp", mediaCategory: "tweet_image" },
  gif: { mediaType: "image/gif", mediaCategory: "tweet_gif" },
  mp4: { mediaType: "video/mp4", mediaCategory: "tweet_video" },
  mov: { mediaType: "video/quicktime", mediaCategory: "tweet_video" },
};

export function getPostMediaTypeInfo(filePath: string): PostMediaTypeInfo | undefined {
  const ext = extname(filePath).toLowerCase().replace(".", "");
  return POST_MEDIA_TYPES[ext];
}

export function getPostMediaMimeType(filePath: string): string {
  return getPostMediaTypeInfo(filePath)?.mediaType ?? "application/octet-stream";
}

export function getSupportedPostMediaExtensions(): string[] {
  return Object.keys(POST_MEDIA_TYPES);
}
