import {
  GoogleGenAI,
  Modality,
} from "@google/genai";

export interface GeminiLiveCallbacks {
  onOpen?: () => void;

  onClose?: () => void;

  onError?: (
    error: Error,
  ) => void;

  onInputTranscript?: (
    text: string,
  ) => void;

  onOutputTranscript?: (
    text: string,
  ) => void;

  onAudioStart?: () => void;

  onAudioEnd?: () => void;

  onInterrupted?: () => void;
}

function base64ToBytes(
  base64: string,
): Uint8Array {
  const binary = atob(base64);

  const bytes = new Uint8Array(
    binary.length,
  );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}

function float32ToPCM16(
  input: Float32Array,
): Int16Array {
  const output =
    new Int16Array(input.length);

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    const sample = Math.max(
      -1,
      Math.min(1, input[i]),
    );

    output[i] =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;
  }

  return output;
}

function pcm16ToBase64(
  pcm: Int16Array,
): string {
  const bytes = new Uint8Array(
    pcm.buffer,
    pcm.byteOffset,
    pcm.byteLength,
  );

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk = bytes.subarray(
      i,
      Math.min(
        i + chunkSize,
        bytes.length,
      ),
    );

    binary += String.fromCharCode(
      ...chunk,
    );
  }

  return btoa(binary);
}

export class GeminiLiveClient {
  private session: any = null;

  private inputContext:
    | AudioContext
    | null = null;

  private outputContext:
    | AudioContext
    | null = null;

  private mediaStream:
    | MediaStream
    | null = null;

  private source:
    | MediaStreamAudioSourceNode
    | null = null;

  private processor:
    | ScriptProcessorNode
    | null = null;

  private nextAudioTime = 0;

  private callbacks: GeminiLiveCallbacks;

  private stopped = false;

  private hasReceivedAudio = false;

  constructor(
    callbacks: GeminiLiveCallbacks = {},
  ) {
    this.callbacks =
      callbacks;
  }

  async connect(
    token: string,
    model: string,
  ) {
    this.stopped = false;
    this.hasReceivedAudio = false;

    console.log(
      "🔵 Connecting to Gemini Live...",
    );

    console.log(
      "Model:",
      model,
    );

    const ai = new GoogleGenAI({
      apiKey: token,
    });

    /*
     * OUTPUT AUDIO
     *
     * Gemini Live returns raw
     * 16-bit PCM at 24kHz.
     */
    this.outputContext =
      new AudioContext({
        sampleRate: 24000,
      });

    if (
      this.outputContext.state ===
      "suspended"
    ) {
      await this.outputContext.resume();
    }

    this.nextAudioTime =
      this.outputContext.currentTime;

    console.log(
      "Output AudioContext:",
      this.outputContext.state,
      this.outputContext.sampleRate,
    );

    this.session =
      await ai.live.connect({
        model,

        config: {
          responseModalities: [
            Modality.AUDIO,
          ],

          inputAudioTranscription: {},

          outputAudioTranscription: {},

          systemInstruction: {
            parts: [
              {
                text: `
You are Nova, a friendly real-time multilingual voice assistant.

You are having a natural phone-style conversation.

LANGUAGE RULES:

1. If the user speaks English, respond in English.
2. If the user speaks Hindi, respond in Hindi.
3. If the user speaks Hinglish, respond naturally in Hinglish.
4. If the user changes language, immediately switch.
5. Never ask the user to choose a language.

CONVERSATION RULES:

- Answer naturally.
- Keep spoken responses reasonably short.
- Do not use markdown.
- Do not say things like "Here is the answer".
- Do not unnecessarily repeat the user's question.
- Maintain conversation context.
- Be friendly, natural and conversational.
- You can ask follow-up questions when appropriate.

IMPORTANT:

Always actually respond to the user's speech.
Do not remain silent after understanding the user.
`,
              },
            ],
          },
        },

        callbacks: {
          onopen: () => {
            console.log(
              "🟢 Gemini Live connected",
            );

            this.callbacks.onOpen?.();

            /*
             * IMPORTANT DEBUG TEST
             *
             * This sends text after connection.
             *
             * If Nova replies to this,
             * Gemini connection + output audio
             * are working and the remaining
             * issue is microphone/VAD.
             */

            setTimeout(() => {
              if (
                !this.session ||
                this.stopped
              ) {
                return;
              }

              console.log(
                "🧪 Sending test message to Gemini...",
              );

              this.session.sendRealtimeInput(
                {
                  text: "Hello Nova, please say hello back.",
                },
              );
            }, 500);
          },

          onmessage: (
            message: any,
          ) => {
            console.log(
              "📩 Gemini message:",
              message,
            );

            this.handleMessage(
              message,
            );
          },

          onerror: (
            event: any,
          ) => {
            console.error(
              "🔴 Gemini Live error:",
              event,
            );

            const error =
              event instanceof Error
                ? event
                : new Error(
                    event?.message ??
                      "Gemini Live error.",
                  );

            this.callbacks.onError?.(
              error,
            );
          },

          onclose: (
            event: any,
          ) => {
            console.log(
              "🟡 Gemini Live closed:",
              event,
            );

            this.callbacks.onClose?.();
          },
        },
      });

    console.log(
      "✅ Gemini session created",
    );

    await this.startMicrophone();
  }

  private async startMicrophone() {
    console.log(
      "🎤 Requesting microphone...",
    );

    this.mediaStream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        },
      );

    console.log(
      "🎤 Microphone permission granted",
    );

    this.inputContext =
      new AudioContext({
        sampleRate: 16000,
      });

    if (
      this.inputContext.state ===
      "suspended"
    ) {
      await this.inputContext.resume();
    }

    console.log(
      "🎤 Input AudioContext:",
      this.inputContext.state,
      this.inputContext.sampleRate,
    );

    this.source =
      this.inputContext.createMediaStreamSource(
        this.mediaStream,
      );

    this.processor =
      this.inputContext.createScriptProcessor(
        4096,
        1,
        1,
      );

    this.processor.onaudioprocess =
      (event) => {
        if (
          this.stopped ||
          !this.session
        ) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(
            0,
          );

        const pcm =
          float32ToPCM16(
            input,
          );

        const base64 =
          pcm16ToBase64(
            pcm,
          );

        try {
          this.session.sendRealtimeInput(
            {
              audio: {
                data: base64,
                mimeType:
                  "audio/pcm;rate=16000",
              },
            },
          );
        } catch (error) {
          console.error(
            "❌ Failed to send audio:",
            error,
          );
        }
      };

    this.source.connect(
      this.processor,
    );

    /*
     * Keep ScriptProcessor alive.
     *
     * We don't want microphone audio
     * to be audible to the user.
     */

    const silentGain =
      this.inputContext.createGain();

    silentGain.gain.value = 0;

    this.processor.connect(
      silentGain,
    );

    silentGain.connect(
      this.inputContext.destination,
    );

    console.log(
      "🎤 Microphone streaming started",
    );
  }

  private handleMessage(
    message: any,
  ) {
    console.log(
      "📨 SERVER CONTENT:",
      message?.serverContent,
    );

    const serverContent =
      message?.serverContent;

    if (!serverContent) {
      console.log(
        "ℹ️ Message without serverContent:",
        message,
      );

      return;
    }

    /*
     * INTERRUPTION
     */

    if (
      serverContent.interrupted
    ) {
      console.log(
        "⛔ Gemini response interrupted",
      );

      this.stopAudioPlayback();

      this.callbacks.onInterrupted?.();

      return;
    }

    /*
     * USER TRANSCRIPTION
     */

    if (
      serverContent.inputTranscription
    ) {
      const text =
        serverContent
          .inputTranscription.text;

      console.log(
        "👤 USER:",
        text,
      );

      if (text) {
        this.callbacks.onInputTranscript?.(
          text,
        );
      }
    }

    /*
     * GEMINI OUTPUT TRANSCRIPTION
     */

    if (
      serverContent.outputTranscription
    ) {
      const text =
        serverContent
          .outputTranscription.text;

      console.log(
        "🤖 NOVA:",
        text,
      );

      if (text) {
        this.callbacks.onOutputTranscript?.(
          text,
        );
      }
    }

    /*
     * GEMINI AUDIO
     */

    const parts =
      serverContent.modelTurn
        ?.parts;

    if (
      parts &&
      parts.length > 0
    ) {
      console.log(
        "🔊 Model parts:",
        parts,
      );

      for (const part of parts) {
        const base64Audio =
          part?.inlineData?.data;

        if (!base64Audio) {
          continue;
        }

        console.log(
          "🔊 Received Gemini audio:",
          base64Audio.length,
          "bytes(base64)",
        );

        this.hasReceivedAudio =
          true;

        this.callbacks.onAudioStart?.();

        this.playAudio(
          base64Audio,
        );
      }
    }

    /*
     * TURN COMPLETE
     */

    if (
      serverContent.turnComplete
    ) {
      console.log(
        "✅ Gemini turn complete",
      );

      this.callbacks.onAudioEnd?.();
    }
  }

  private async playAudio(
    base64Audio: string,
  ) {
    if (!this.outputContext) {
      console.warn(
        "⚠️ No output AudioContext",
      );

      return;
    }

    if (
      this.outputContext.state ===
      "suspended"
    ) {
      await this.outputContext.resume();
    }

    const bytes =
      base64ToBytes(
        base64Audio,
      );

    /*
     * Gemini audio is:
     *
     * 16-bit
     * little endian
     * mono
     * 24kHz
     */

    if (
      bytes.byteLength < 2
    ) {
      return;
    }

    const pcm =
      new Int16Array(
        bytes.buffer,
        bytes.byteOffset,
        Math.floor(
          bytes.byteLength / 2,
        ),
      );

    const audioBuffer =
      this.outputContext.createBuffer(
        1,
        pcm.length,
        24000,
      );

    const channel =
      audioBuffer.getChannelData(
        0,
      );

    for (
      let i = 0;
      i < pcm.length;
      i++
    ) {
      channel[i] =
        pcm[i] / 32768;
    }

    const source =
      this.outputContext.createBufferSource();

    source.buffer =
      audioBuffer;

    const gain =
      this.outputContext.createGain();

    gain.gain.value = 1;

    source.connect(
      gain,
    );

    gain.connect(
      this.outputContext.destination,
    );

    const currentTime =
      this.outputContext.currentTime;

    this.nextAudioTime =
      Math.max(
        this.nextAudioTime,
        currentTime,
      );

    source.start(
      this.nextAudioTime,
    );

    this.nextAudioTime +=
      audioBuffer.duration;

    console.log(
      "🔊 Playing Gemini audio:",
      audioBuffer.duration,
      "seconds",
    );
  }

  private stopAudioPlayback() {
    if (!this.outputContext) {
      return;
    }

    this.nextAudioTime =
      this.outputContext.currentTime;
  }

  mute() {
    if (!this.mediaStream) {
      return;
    }

    this.mediaStream
      .getAudioTracks()
      .forEach(
        (track) => {
          track.enabled = false;
        },
      );
  }

  unmute() {
    if (!this.mediaStream) {
      return;
    }

    this.mediaStream
      .getAudioTracks()
      .forEach(
        (track) => {
          track.enabled = true;
        },
      );
  }

  async disconnect() {
    console.log(
      "🔴 Disconnecting Gemini...",
    );

    this.stopped = true;

    this.processor?.disconnect();

    this.source?.disconnect();

    this.mediaStream
      ?.getTracks()
      .forEach(
        (track) => {
          track.stop();
        },
      );

    if (
      this.inputContext &&
      this.inputContext.state !==
        "closed"
    ) {
      await this.inputContext.close();
    }

    if (
      this.outputContext &&
      this.outputContext.state !==
        "closed"
    ) {
      await this.outputContext.close();
    }

    this.session?.close();

    this.processor = null;
    this.source = null;
    this.mediaStream = null;
    this.inputContext = null;
    this.outputContext = null;
    this.session = null;
  }
}