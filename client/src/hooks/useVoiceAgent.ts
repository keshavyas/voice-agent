import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { GeminiLiveClient } from "../lib/geminiLive";
import { getGeminiToken } from "../lib/api";

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

  const isConnectingRef =
    useRef(false);

  const isEndingRef =
    useRef(false);

  // --------------------------------------------------
  // TRANSCRIPT
  // --------------------------------------------------

  const addTranscript = useCallback(
    (
      role: "user" | "assistant",
      text: string,
    ) => {
      const clean = text.trim();

      if (!clean) {
        return;
      }

      setTranscript((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role,
          text: clean,
          timestamp: new Date(),
        },
      ]);
    },
    [],
  );

  // --------------------------------------------------
  // LANGUAGE DETECTION
  // --------------------------------------------------

  const detectLanguage = useCallback(
    (text: string) => {
      if (/[\u0900-\u097F]/.test(text)) {
        setLanguage("Hindi");
        return;
      }

      const hinglishPattern =
        /\b(hai|haan|nahi|nahin|kya|kaise|aap|mera|meri|mujhe|karna|karo|acha|achha|bhai|chahiye|batao|samjhao|kyu|kyon|wala|wali)\b/i;

      if (hinglishPattern.test(text)) {
        setLanguage("Hinglish");
        return;
      }

      setLanguage("English");
    },
    [],
  );

  // --------------------------------------------------
  // TIMER
  // --------------------------------------------------

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    setSessionTime(0);

    timerRef.current = window.setInterval(() => {
      setSessionTime((previous) => previous + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // --------------------------------------------------
  // CONNECT
  // --------------------------------------------------

  const connect = useCallback(async () => {
    if (isConnectingRef.current) {
      console.warn(
        "Connection already in progress.",
      );
      return;
    }

    if (clientRef.current?.isConnected()) {
      console.warn(
        "Gemini is already connected.",
      );
      return;
    }

    isConnectingRef.current = true;
    isEndingRef.current = false;

    try {
      console.log(
        "🚀 Starting Nova connection...",
      );

      setError(null);
      setStatus("connecting");
      setTranscript([]);
      setSessionTime(0);
      setSpeaking(false);
      setIsMuted(false);

      // --------------------------------------------
      // GET EPHEMERAL GEMINI TOKEN
      // --------------------------------------------

      console.log(
        "🔑 Requesting Gemini token...",
      );

      const {
        token,
        model,
      } = await getGeminiToken();

      console.log(
        "🟢 Gemini token received.",
      );

      // --------------------------------------------
      // CREATE GEMINI CLIENT
      // --------------------------------------------

      const client =
        new GeminiLiveClient({
          // ------------------------------------------
          // GEMINI SOCKET OPENED
          // ------------------------------------------

          onOpen: () => {
            console.log(
              "🟢 NOVA CONNECTED",
            );

            setStatus("listening");

            startTimer();
          },

          // ------------------------------------------
          // USER TRANSCRIPT
          // ------------------------------------------

          onUserTranscript: (
            text,
          ) => {
            console.log(
              "👤 USER:",
              text,
            );

            addTranscript(
              "user",
              text,
            );

            detectLanguage(text);

            setStatus("thinking");
          },

          // ------------------------------------------
          // NOVA TRANSCRIPT
          // ------------------------------------------

          onAssistantTranscript: (
            text,
          ) => {
            console.log(
              "🤖 NOVA:",
              text,
            );

            addTranscript(
              "assistant",
              text,
            );
          },

          // ------------------------------------------
          // NOVA AUDIO
          // ------------------------------------------

          onAudio: () => {
            if (isEndingRef.current) {
              return;
            }

            setSpeaking(true);
            setStatus("speaking");
          },

          // ------------------------------------------
          // NOVA INTERRUPTED
          // ------------------------------------------

          onInterrupted: () => {
            console.log(
              "🟡 NOVA INTERRUPTED",
            );

            setSpeaking(false);
            setStatus("listening");
          },

          // ------------------------------------------
          // NOVA FINISHED TURN
          // ------------------------------------------

          onTurnComplete: () => {
            console.log(
              "🟢 NOVA TURN COMPLETE",
            );

            setSpeaking(false);

            if (!isEndingRef.current) {
              setStatus("listening");
            }
          },

          // ------------------------------------------
          // SOCKET CLOSED
          // ------------------------------------------

          onClose: () => {
            console.log(
              "🟡 NOVA SOCKET CLOSED",
            );

            setSpeaking(false);
            stopTimer();

            if (!isEndingRef.current) {
              setStatus("ended");
            }
          },

          // ------------------------------------------
          // ERROR
          // ------------------------------------------

          onError: (err) => {
            console.error(
              "🔴 NOVA ERROR:",
              err,
            );

            const message =
              err instanceof Error
                ? err.message
                : "Gemini Live connection failed.";

            setError(message);
            setSpeaking(false);

            if (!isEndingRef.current) {
              setStatus("error");
            }

            stopTimer();
          },
        });

      clientRef.current = client;

      // --------------------------------------------
      // CONNECT WEBSOCKET
      // --------------------------------------------

      console.log(
        "🔌 Connecting to Gemini Live...",
      );

      await client.connect(
        token,
        model,
      );

      console.log(
        "🟢 Gemini Live connection established.",
      );

      // --------------------------------------------
      // 🔥 THIS WAS MISSING
      // START MICROPHONE
      // --------------------------------------------

      console.log(
        "🎤 Starting microphone...",
      );

      await client.startMicrophone();

      console.log(
        "🟢 Microphone is now sending audio.",
      );

      setStatus("listening");
    } catch (err) {
      console.error(
        "🔴 Nova connection failed:",
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

      try {
        await clientRef.current?.disconnect();
      } catch {
        // Ignore cleanup errors.
      }

      clientRef.current = null;
    } finally {
      isConnectingRef.current = false;
    }
  }, [
    addTranscript,
    detectLanguage,
    startTimer,
    stopTimer,
  ]);

  // --------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------

  const disconnect = useCallback(
    async () => {
      if (isEndingRef.current) {
        return;
      }

      isEndingRef.current = true;

      console.log(
        "☎️ Ending Nova conversation...",
      );

      setStatus("ending");

      stopTimer();

      const client =
        clientRef.current;

      if (client) {
        try {
          await client.disconnect();
        } catch (error) {
          console.warn(
            "Disconnect cleanup error:",
            error,
          );
        }
      }

      clientRef.current = null;

      setIsMuted(false);
      setSpeaking(false);
      setStatus("ended");

      console.log(
        "🔴 Nova conversation ended.",
      );
    },
    [stopTimer],
  );

  // --------------------------------------------------
  // MUTE / UNMUTE
  // --------------------------------------------------

  const toggleMute = useCallback(
    async () => {
      const client =
        clientRef.current;

      if (!client || !client.isConnected()) {
        console.warn(
          "Cannot mute. Gemini is not connected.",
        );
        return;
      }

      try {
        if (isMuted) {
          console.log(
            "🎤 Unmuting microphone...",
          );

          await client.startMicrophone();

          setIsMuted(false);
          setStatus("listening");

          console.log(
            "🟢 Microphone unmuted.",
          );
        } else {
          console.log(
            "🔇 Muting microphone...",
          );

          client.stopMicrophone();

          setIsMuted(true);
          setStatus("muted");

          console.log(
            "🔴 Microphone muted.",
          );
        }
      } catch (error) {
        console.error(
          "Microphone toggle failed:",
          error,
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to change microphone state.",
        );
      }
    },
    [isMuted],
  );

  // --------------------------------------------------
  // CLEAR ERROR
  // --------------------------------------------------

  const clearError = useCallback(() => {
    setError(null);

    if (
      clientRef.current?.isConnected()
    ) {
      setStatus("listening");
    } else {
      setStatus("idle");
    }
  }, []);

  // --------------------------------------------------
  // COMPONENT CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      stopTimer();

      isEndingRef.current = true;

      const client =
        clientRef.current;

      if (client) {
        void client.disconnect();
      }

      clientRef.current = null;
    };
  }, [stopTimer]);

  // --------------------------------------------------
  // RETURN
  // --------------------------------------------------

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