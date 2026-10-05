import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  RealtimeSession,
} from "@openai/agents/realtime";

import { voiceAgent } from "../lib/agent";
import { getRealtimeToken } from "../lib/api";

import type {
  CallStatus,
  TranscriptMessage,
} from "../types/voice";

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function useVoiceAgent() {
  const sessionRef =
    useRef<RealtimeSession | null>(null);

  const [status, setStatus] =
    useState<CallStatus>("idle");

  const [transcript, setTranscript] =
    useState<TranscriptMessage[]>([]);

  const [error, setError] =
    useState<string | null>(null);

  const [isMuted, setIsMuted] =
    useState(false);

  const [language, setLanguage] =
    useState("Auto");

  const [speaking, setSpeaking] =
    useState(false);

  const [sessionTime, setSessionTime] =
    useState(0);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null,
    );

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setSessionTime(0);
  }, []);

  const startTimer = useCallback(() => {
    resetTimer();

    timerRef.current = setInterval(() => {
      setSessionTime((previous) => previous + 1);
    }, 1000);
  }, [resetTimer]);

  const addTranscript = useCallback(
    (
      role: "user" | "assistant",
      text: string,
    ) => {
      const cleanText = text.trim();

      if (!cleanText) {
        return;
      }

      setTranscript((previous) => [
        ...previous,
        {
          id: createId(),
          role,
          text: cleanText,
          timestamp: new Date(),
        },
      ]);
    },
    [],
  );

  const connect = useCallback(async () => {
    if (sessionRef.current) {
      return;
    }

    try {
      setError(null);
      setStatus("connecting");
      setTranscript([]);

      const clientSecret =
        await getRealtimeToken();

      const session = new RealtimeSession(
        voiceAgent,
        {
          model: "gpt-realtime-2.1",

          config: {
            audio: {
              output: {
                voice: "marin",
              },
            },
          },
        },
      );

      session.on(
        "audio_start",
        () => {
          setSpeaking(true);
          setStatus("speaking");
        },
      );

      session.on(
        "audio_stopped",
        () => {
          setSpeaking(false);

          if (!isMuted) {
            setStatus("listening");
          }
        },
      );

      session.on(
        "audio_interrupted",
        () => {
          setSpeaking(false);

          if (!isMuted) {
            setStatus("listening");
          }
        },
      );

      session.on(
        "agent_start",
        () => {
          setStatus("thinking");
        },
      );

      session.on(
        "agent_end",
        () => {
          if (!speaking && !isMuted) {
            setStatus("listening");
          }
        },
      );

      session.on(
        "history_updated",
        (history) => {
          const messages: TranscriptMessage[] = [];

          for (const item of history) {
            if (
              item.type !== "message"
            ) {
              continue;
            }

            const role =
              item.role === "user"
                ? "user"
                : "assistant";

            const content = item.content;

            if (!Array.isArray(content)) {
              continue;
            }

            for (const part of content) {
              if (
                typeof part !== "object" ||
                part === null
              ) {
                continue;
              }

              const record =
                part as Record<string, unknown>;

              const transcriptText =
                typeof record.transcript ===
                "string"
                  ? record.transcript
                  : typeof record.text ===
                      "string"
                    ? record.text
                    : null;

              if (transcriptText) {
                messages.push({
                  id: createId(),
                  role,
                  text: transcriptText,
                  timestamp: new Date(),
                });
              }
            }
          }

          if (messages.length > 0) {
            setTranscript(messages);
          }
        },
      );

      session.on(
        "transport_event",
        (event) => {
          const eventRecord =
            event as Record<string, unknown>;

          const eventType =
            eventRecord.type;

          if (
            eventType ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            const transcriptText =
              eventRecord.transcript;

            if (
              typeof transcriptText ===
              "string"
            ) {
              addTranscript(
                "user",
                transcriptText,
              );
            }
          }

          if (
            eventType ===
            "response.audio_transcript.done"
          ) {
            const transcriptText =
              eventRecord.transcript;

            if (
              typeof transcriptText ===
              "string"
            ) {
              addTranscript(
                "assistant",
                transcriptText,
              );
            }
          }
        },
      );

      session.on(
        "error",
        (event) => {
          console.error(
            "Realtime session error:",
            event,
          );

          setError(
            "The voice connection encountered an error.",
          );

          setStatus("error");
        },
      );

      sessionRef.current = session;

      await session.connect({
        apiKey: clientSecret,
      });

      setStatus("connected");
      setLanguage("Auto");
      startTimer();

      window.setTimeout(() => {
        if (!isMuted) {
          setStatus("listening");
        }
      }, 500);
    } catch (connectionError) {
      console.error(
        "Failed to connect:",
        connectionError,
      );

      sessionRef.current?.close();
      sessionRef.current = null;

      setStatus("error");

      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Unable to start the voice call.",
      );
    }
  }, [
    addTranscript,
    isMuted,
    speaking,
    startTimer,
  ]);

  const disconnect = useCallback(() => {
    setStatus("ending");

    try {
      sessionRef.current?.close();
    } catch (closeError) {
      console.error(
        "Error closing session:",
        closeError,
      );
    }

    sessionRef.current = null;

    setSpeaking(false);
    setIsMuted(false);

    resetTimer();

    setStatus("ended");
  }, [resetTimer]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;

    if (!session) {
      return;
    }

    const nextMuted = !isMuted;

    try {
      session.mute(nextMuted);

      setIsMuted(nextMuted);

      if (nextMuted) {
        setStatus("muted");
      } else {
        setStatus("listening");
      }
    } catch (muteError) {
      console.error(
        "Mute error:",
        muteError,
      );
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      sessionRef.current?.close();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);

    if (status === "error") {
      setStatus("idle");
    }
  }, [status]);

  return {
    connect,
    disconnect,
    toggleMute,

    status,
    transcript,
    error,
    clearError,

    isMuted,
    speaking,
    language,
    sessionTime,
  };
}