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
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export interface RealtimeTokenResponse {
  success: boolean;
  clientSecret?: string;
  expiresAt?: number | null;
  message?: string;
}