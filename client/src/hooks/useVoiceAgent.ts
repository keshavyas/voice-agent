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
  const [
    status,
    setStatus,
  ] =
    useState<CallStatus>(
      "idle",
    );

  const [
    isMuted,
    setIsMuted,
  ] =
    useState(false);

  const [
    speaking,
    setSpeaking,
  ] =
    useState(false);

  const [
    language,
    setLanguage,
  ] =
    useState("English");

  const [
    sessionTime,
    setSessionTime,
  ] =
    useState(0);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    transcript,
    setTranscript,
  ] =
    useState<
      TranscriptMessage[]
    >([]);

  const clientRef =
    useRef<
      GeminiLiveClient | null
    >(null);

  const timerRef =
    useRef<number | null>(
      null,
    );

  const addTranscript =
    useCallback(
      (
        role:
          | "user"
          | "assistant",
        text: string,
      ) => {
        const clean =
          text.trim();

        if (!clean) {
          return;
        }

        setTranscript(
          (previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),

              role,

              text: clean,

              timestamp:
                new Date(),
            },
          ],
        );
      },
      [],
    );

  const detectLanguage =
    useCallback(
      (text: string) => {
        if (
          /[\u0900-\u097F]/.test(
            text,
          )
        ) {
          setLanguage("Hindi");
          return;
        }

        const hinglishPattern =
          /\b(hai|haan|nahi|nahin|kya|kaise|aap|mera|meri|mujhe|karna|karo|acha|achha|bhai|chahiye|batao|samjhao|kyu|kyon|wala|wali)\b/i;

        if (
          hinglishPattern.test(
            text,
          )
        ) {
          setLanguage(
            "Hinglish",
          );

          return;
        }

        setLanguage("English");
      },
      [],
    );

  const startTimer =
    useCallback(() => {
      if (
        timerRef.current
      ) {
        window.clearInterval(
          timerRef.current,
        );
      }

      setSessionTime(0);

      timerRef.current =
        window.setInterval(
          () => {
            setSessionTime(
              (previous) =>
                previous + 1,
            );
          },
          1000,
        );
    }, []);

  const stopTimer =
    useCallback(() => {
      if (
        timerRef.current
      ) {
        window.clearInterval(
          timerRef.current,
        );

        timerRef.current =
          null;
      }
    }, []);

  const connect =
    useCallback(
      async () => {
        try {
          setError(null);

          setStatus(
            "connecting",
          );

          setTranscript([]);

          setSessionTime(0);

          setSpeaking(false);

          setIsMuted(false);

          const {
            token,
            model,
          } =
            await getGeminiToken();

          const client =
            new GeminiLiveClient({
              onOpen: () => {
                console.log(
                  "NOVA CONNECTED",
                );

                setStatus(
                  "listening",
                );

                startTimer();
              },

              onClose: () => {
                console.log(
                  "NOVA CLOSED",
                );

                setSpeaking(false);

                setStatus(
                  "ended",
                );

                stopTimer();
              },

              onError: (
                err,
              ) => {
                console.error(
                  "NOVA ERROR:",
                  err,
                );

                setError(
                  err.message ||
                    "Gemini Live connection failed.",
                );

                setStatus(
                  "error",
                );

                setSpeaking(false);

                stopTimer();
              },

              onInputTranscript: (
                text,
              ) => {
                console.log(
                  "USER:",
                  text,
                );

                addTranscript(
                  "user",
                  text,
                );

                detectLanguage(
                  text,
                );

                setStatus(
                  "thinking",
                );
              },

              onOutputTranscript: (
                text,
              ) => {
                console.log(
                  "NOVA:",
                  text,
                );

                addTranscript(
                  "assistant",
                  text,
                );
              },

              onAudioStart: () => {
                console.log(
                  "NOVA STARTED SPEAKING",
                );

                setSpeaking(true);

                setStatus(
                  "speaking",
                );
              },

              onAudioEnd: () => {
                console.log(
                  "NOVA FINISHED SPEAKING",
                );

                setSpeaking(false);

                setStatus(
                  "listening",
                );
              },

              onInterrupted: () => {
                console.log(
                  "NOVA INTERRUPTED",
                );

                setSpeaking(false);

                setStatus(
                  "listening",
                );
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

          setStatus(
            "error",
          );

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

  const disconnect =
    useCallback(
      async () => {
        setStatus(
          "ending",
        );

        stopTimer();

        await clientRef.current?.disconnect();

        clientRef.current =
          null;

        setIsMuted(false);

        setSpeaking(false);

        setStatus(
          "ended",
        );
      },
      [stopTimer],
    );

  const toggleMute =
    useCallback(() => {
      const client =
        clientRef.current;

      if (!client) {
        return;
      }

      if (isMuted) {
        client.unmute();

        setIsMuted(false);

        setStatus(
          "listening",
        );
      } else {
        client.mute();

        setIsMuted(true);

        setStatus(
          "muted",
        );
      }
    }, [isMuted]);

  const clearError =
    useCallback(() => {
      setError(null);

      setStatus(
        "idle",
      );
    }, []);

  useEffect(() => {
    return () => {
      stopTimer();

      void clientRef.current?.disconnect();
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