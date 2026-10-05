import type { CallStatus } from "../types/voice";

interface StatusBadgeProps {
status: CallStatus;
}

const labels: Record<CallStatus, string> = {
  idle: "Ready",
  connecting: "Connecting...",
  connected: "Connected",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  muted: "Microphone muted",
  ending: "Ending call...",
  ended: "Call ended",
  error: "Connection error",
};

export function StatusBadge({
  status,
}: StatusBadgeProps) {
  return (
    <div
      className={`status-badge status-${status}`}
    >
      <span className="status-dot" />

      <span>{labels[status]}</span>
    </div>
  );
}