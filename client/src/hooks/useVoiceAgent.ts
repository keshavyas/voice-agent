import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  GeminiLiveClient,
} from "../lib/geminiLive";

import {
  getGeminiToken,
} from "../lib/api";

import type {
  CallStatus,
  TranscriptMessage,
} from "../types/voice";

export function useVoiceAgent() {
  const [status, setStatus] =
    useState<CallStatus>("idle");

  const [isMuted, setIsMuted] =
    useState(false);

  const [speaking, setSpeaking] =
    useState(false);

  const [language, setLanguage] =
    useState("English");

  const [sessionTime, setSessionTime] =
    useState(0);

  const [error, setError] =
    useState<string | null>(null);

  const [transcript, setTranscript] =
    useState<TranscriptMessage[]>([]);

  const clientRef =
    useRef<GeminiLiveClient | null>(null);

  const timerRef =
    useRef<number | null>(null);

  const addTranscript =
    useCallback(
      (
        role: "user" | "assistant",
        text: string,
      ) => {
        if (!text.trim()) {
          return;
        }

        setTranscript((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role,
            text,
            timestamp: new Date(),
          },
        ]);
      },
      [],
    );

  const detectLanguage = useCallback(
    (text: string) => {
      const hindiCharacters =
        /[\u0900-\u097F]/;

      if (hindiCharacters.test(text)) {
        setLanguage("Hindi");
        return;
      }

      const hinglishWords =
        /\b(hai|haan|nahi|nahin|kya|kaise|aap|mera|mujhe|karna|karo|acha|achha|bhai|chahiye|batao|samjhao)\b/i;

      if (hinglishWords.test(text)) {
        setLanguage("Hinglish");
        return;
      }

      setLanguage("English");
    },
    [],
  );

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(
        timerRef.current,
      );
    }

    setSessionTime(0);

    timerRef.current =
      window.setInterval(() => {
        setSessionTime(
          (previous) =>
            previous + 1,
        );
      }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(
        timerRef.current,
      );

      timerRef.current = null;
    }
  }, []);

  const connect = useCallback(
    async () => {
      try {
        setError(null);

        setStatus("connecting");

        setTranscript([]);

        setSessionTime(0);

        const {
          token,
          model,
        } = await getGeminiToken();

        const client =
          new GeminiLiveClient({
            onOpen: () => {
              setStatus("listening");
              startTimer();
            },

            onClose: () => {
              setStatus("ended");
              setSpeaking(false);
              stopTimer();
            },

            onError: (err) => {
              console.error(
                "Gemini Live error:",
                err,
              );

              setError(
                err.message ||
                  "Gemini Live connection failed.",
              );

              setStatus("error");

              setSpeaking(false);

              stopTimer();
            },

            onInputTranscript: (
              text,
            ) => {
              addTranscript(
                "user",
                text,
              );

              detectLanguage(text);

              setStatus("thinking");
            },

            onOutputTranscript: (
              text,
            ) => {
              addTranscript(
                "assistant",
                text,
              );
            },

            onAudioStart: () => {
              setSpeaking(true);
              setStatus("speaking");
            },

            onAudioEnd: () => {
              setSpeaking(false);
              setStatus("listening");
            },

            onInterrupted: () => {
              setSpeaking(false);
              setStatus("listening");
            },
          });

        clientRef.current =
          client;

        await client.connect(
          token,
          model,
        );
      } catch (err) {
        console.error(
          "Connection error:",
          err,
        );

        const message =
          err instanceof Error
            ? err.message
            : "Unable to connect to Gemini.";

        setError(message);

        setStatus("error");

        setSpeaking(false);

        stopTimer();

        await clientRef.current?.disconnect();

        clientRef.current = null;
      }
    },
    [
      addTranscript,
      detectLanguage,
      startTimer,
      stopTimer,
    ],
  );

  const disconnect = useCallback(
    async () => {
      setStatus("ending");

      stopTimer();

      await clientRef.current?.disconnect();

      clientRef.current = null;

      setIsMuted(false);

      setSpeaking(false);

      setStatus("ended");
    },
    [stopTimer],
  );

  const toggleMute = useCallback(
    () => {
      const client =
        clientRef.current;

      if (!client) {
        return;
      }

      if (isMuted) {
        client.unmute();

        setIsMuted(false);

        setStatus("listening");
      } else {
        client.mute();

        setIsMuted(true);

        setStatus("muted");
      }
    },
    [isMuted],
  );

  const clearError = useCallback(
    () => {
      setError(null);

      if (status === "error") {
        setStatus("idle");
      }
    },
    [status],
  );

  useEffect(() => {
    return () => {
      stopTimer();

      clientRef.current?.disconnect();
    };
  }, [stopTimer]);

  return {
    status,
    transcript,
    isMuted,
    speaking,
    language,
    sessionTime,
    error,

    connect,
    disconnect,
    toggleMute,
    clearError,
  };
}