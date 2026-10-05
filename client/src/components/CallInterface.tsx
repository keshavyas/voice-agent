import { CallOrb } from "./CallOrb";
import { LanguageBadge } from "./LanguageBadge";
import { StatusBadge } from "./StatusBadge";
import { Transcript } from "./Transcript";
import { Waveform } from "./Waveform";

import type {
  CallStatus,
  TranscriptMessage,
} from "../types/voice";

interface CallInterfaceProps {
  status: CallStatus;
  transcript: TranscriptMessage[];
  isMuted: boolean;
  speaking: boolean;
  language: string;
  sessionTime: number;

  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(remaining).padStart(2, "0")}`;
}

export function CallInterface({
  status,
  transcript,
  isMuted,
  speaking,
  language,
  sessionTime,
  onStart,
  onEnd,
  onToggleMute,
}: CallInterfaceProps) {
  const active =
    status !== "idle" &&
    status !== "ended" &&
    status !== "error";

  const connecting =
    status === "connecting";

  const canStart =
    status === "idle" ||
    status === "ended" ||
    status === "error";

  return (
    <main className="app-shell">
      <div className="background-grid" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span>✦</span>
          </div>

          <div>
            <div className="brand-name">
              NOVA
            </div>

            <div className="brand-subtitle">
              REALTIME VOICE AGENT
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="secure-pill">
            <span>●</span>
            Secure realtime connection
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span />
            AI CONVERSATION
          </div>

          <h1>
            Talk naturally.
            <br />

            <span>
              In your language.
            </span>
          </h1>

          <p>
            A real-time AI voice assistant that
            listens, understands and responds
            naturally in the same language you
            speak.
          </p>
        </div>

        <div className="call-card">
          <div className="call-card-header">
            <div>
              <span className="agent-label">
                YOUR AI ASSISTANT
              </span>

              <h2>Nova</h2>
            </div>

            <StatusBadge status={status} />
          </div>

          <div className="orb-section">
            <CallOrb
              active={active}
              speaking={speaking}
              connecting={connecting}
            />

            <div className="agent-state">
              <div className="agent-state-title">
                {status === "idle" &&
                  "Ready to talk"}

                {status === "connecting" &&
                  "Connecting..."}

                {status === "connected" &&
                  "Connected"}

                {status === "listening" &&
                  "I'm listening"}

                {status === "thinking" &&
                  "Thinking..."}

                {status === "speaking" &&
                  "Nova is speaking"}

                {status === "muted" &&
                  "Microphone muted"}

                {status === "ending" &&
                  "Ending call..."}

                {status === "ended" &&
                  "Call ended"}

                {status === "error" &&
                  "Something went wrong"}
              </div>

              {active && (
                <div className="call-timer">
                  {formatDuration(
                    sessionTime,
                  )}
                </div>
              )}
            </div>

            <Waveform
              active={
                speaking ||
                status === "listening"
              }
            />
          </div>

          <div className="call-card-footer">
            <div className="call-info">
              <LanguageBadge
                language={language}
              />

              <span className="divider" />

              <span className="webrtc-label">
                WebRTC
              </span>
            </div>

            <div className="call-controls">
              {active && (
                <button
                  type="button"
                  className={`control-button ${
                    isMuted
                      ? "control-active"
                      : ""
                  }`}
                  onClick={
                    onToggleMute
                  }
                  aria-label={
                    isMuted
                      ? "Unmute microphone"
                      : "Mute microphone"
                  }
                >
                  {isMuted ? "🎙️" : "🔇"}
                </button>
              )}

              {canStart ? (
                <button
                  type="button"
                  className="start-call-button"
                  onClick={onStart}
                >
                  <span className="call-icon">
                    ☎
                  </span>

                  <span>
                    Start conversation
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="end-call-button"
                  onClick={onEnd}
                >
                  <span className="end-icon">
                    ■
                  </span>

                  <span>
                    End conversation
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="lower-section">
        <Transcript
          messages={transcript}
        />

        <aside className="features-panel">
          <span className="eyebrow">
            BUILT FOR NATURAL CONVERSATION
          </span>

          <h2>
            Your voice.
            <br />
            Your language.
          </h2>

          <div className="feature-list">
            <div className="feature">
              <div className="feature-number">
                01
              </div>

              <div>
                <h3>
                  Automatic language switching
                </h3>

                <p>
                  Speak English, Hindi or
                  Hinglish. Nova follows your
                  language naturally.
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-number">
                02
              </div>

              <div>
                <h3>
                  Real-time responses
                </h3>

                <p>
                  WebRTC keeps the conversation
                  fast and interactive.
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-number">
                03
              </div>

              <div>
                <h3>
                  Natural interruptions
                </h3>

                <p>
                  Interrupt Nova just like you
                  would interrupt someone on a
                  phone call.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}