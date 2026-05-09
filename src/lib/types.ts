export interface XSearchTool {
  type: "x_search";
  allowed_x_handles?: string[];
  excluded_x_handles?: string[];
  from_date?: string;
  to_date?: string;
  enable_image_understanding?: boolean;
  enable_video_understanding?: boolean;
}

export interface XaiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface XaiRequest {
  model: string;
  input: XaiMessage[];
  tools: XSearchTool[];
}

export interface XaiResponseOutput {
  type: string;
  content?: Array<{ type: string; text: string }>;
}

export interface XaiResponse {
  output: XaiResponseOutput[];
}

export interface SearchResult {
  text: string;
  requested_count?: number;
}

export interface XaiClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}
