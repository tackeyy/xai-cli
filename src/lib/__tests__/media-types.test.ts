import { describe, expect, it } from "vitest";
import { getPostMediaMimeType, getPostMediaTypeInfo, getSupportedPostMediaExtensions } from "../media-types.js";

describe("post media type helpers", () => {
  it("maps supported post image extensions to X media types", () => {
    for (const ext of ["jpg", "jpeg", "jpe", "jfif", "jif", "jfi"]) {
      expect(getPostMediaTypeInfo(`photo.${ext}`)).toEqual({ mediaType: "image/jpeg", mediaCategory: "tweet_image" });
    }

    expect(getPostMediaTypeInfo("chart.png")).toEqual({ mediaType: "image/png", mediaCategory: "tweet_image" });
    expect(getPostMediaTypeInfo("image.webp")).toEqual({ mediaType: "image/webp", mediaCategory: "tweet_image" });
    expect(getPostMediaTypeInfo("animation.gif")).toEqual({ mediaType: "image/gif", mediaCategory: "tweet_gif" });
  });

  it("keeps video extensions mapped to tweet_video", () => {
    expect(getPostMediaTypeInfo("clip.mp4")).toEqual({ mediaType: "video/mp4", mediaCategory: "tweet_video" });
    expect(getPostMediaTypeInfo("clip.mov")).toEqual({ mediaType: "video/quicktime", mediaCategory: "tweet_video" });
  });

  it("does not advertise broad upload MIME types that X does not list as supported post images", () => {
    expect(getPostMediaTypeInfo("scan.bmp")).toBeUndefined();
    expect(getPostMediaTypeInfo("scan.tif")).toBeUndefined();
    expect(getPostMediaTypeInfo("scan.tiff")).toBeUndefined();
    expect(getPostMediaTypeInfo("photo.heic")).toBeUndefined();
    expect(getPostMediaMimeType("scan.bmp")).toBe("application/octet-stream");
  });

  it("lists every extension used by CLI help and docs", () => {
    expect(getSupportedPostMediaExtensions()).toEqual([
      "jpg",
      "jpeg",
      "jpe",
      "jfif",
      "jif",
      "jfi",
      "png",
      "webp",
      "gif",
      "mp4",
      "mov",
    ]);
  });
});
