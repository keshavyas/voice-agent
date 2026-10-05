import type { TranscriptMessage } from "../types/voice";

interface TranscriptProps {
  messages: TranscriptMessage[];
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Transcript({
  messages,
}: TranscriptProps) {
  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <div>
          <span className="eyebrow">
            LIVE TRANSCRIPT
          </span>

          <h2>Conversation</h2>
        </div>

        <span className="transcript-count">
          {messages.length}
        </span>
      </div>

      <div className="transcript-content">
        {messages.length === 0 ? (
          <div className="empty-transcript">
            <div className="empty-icon">
              ◌
            </div>

            <h3>Your conversation will appear here</h3>

            <p>
              Start speaking naturally. Nova
              will respond in your language.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.role === "user"
                  ? "message-user"
                  : "message-assistant"
              }`}
            >
              <div className="message-meta">
                <span>
                  {message.role === "user"
                    ? "You"
                    : "Nova"}
                </span>

                <time>
                  {formatTime(
                    message.timestamp,
                  )}
                </time>
              </div>

              <p>{message.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}