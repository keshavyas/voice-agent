export type CallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "ending"
  | "ended"
  | "error";

export interface TranscriptMessage {
  id: string;

  role:
    | "user"
    | "assistant";

  text: string;

  timestamp: Date;
}

export interface GeminiTokenResponse {
  success: boolean;

  token?: string;

  model?: string;

  message?: string;
}