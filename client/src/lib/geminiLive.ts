import {
  GoogleGenAI,
  Modality,
} from "@google/genai";

export interface GeminiLiveCallbacks {
  onOpen?: () => void;

  onMessage?: (message: any) => void;

  onError?: (error: unknown) => void;

  onClose?: (event: CloseEvent) => void;

  onUserTranscript?: (text: string) => void;

  onAssistantTranscript?: (text: string) => void;

  onAudio?: (base64Audio: string) => void;

  onInterrupted?: () => void;

  onTurnComplete?: () => void;
}

export class GeminiLiveClient {
  private session: any = null;

  private inputAudioContext: AudioContext | null =
    null;

  private outputAudioContext: AudioContext | null =
    null;

  private mediaStream: MediaStream | null =
    null;

  private mediaSource:
    | MediaStreamAudioSourceNode
    | null = null;

  private processor:
    | ScriptProcessorNode
    | null = null;

  private silentGain:
    | GainNode
    | null = null;

  /**
   * True only while Gemini WebSocket
   * is actually connected.
   */
  private connected = false;

  /**
   * Prevents multiple simultaneous
   * connect() calls.
   */
  private connecting = false;

  /**
   * Prevents audio from being sent
   * while disconnecting.
   */
  private disconnecting = false;

  /**
   * Used for scheduling Gemini's
   * 24kHz audio output.
   */
  private outputNextTime = 0;

  /**
   * Currently playing audio sources.
   */
  private audioQueue: AudioBufferSourceNode[] =
    [];

  private callbacks: GeminiLiveCallbacks;

  constructor(
    callbacks: GeminiLiveCallbacks = {},
  ) {
    this.callbacks = callbacks;
  }

  // ============================================================
  // CONNECT
  // ============================================================

  async connect(
    token: string,
    model: string,
  ): Promise<void> {
    /**
     * IMPORTANT:
     * Do not create another WebSocket
     * if one already exists.
     */
    if (
      this.connected ||
      this.connecting
    ) {
      console.warn(
        "Gemini Live is already connected or connecting.",
      );

      return;
    }

    this.connecting = true;
    this.disconnecting = false;

    try {
      console.log(
        "Connecting to Gemini Live...",
      );

      /**
       * The ephemeral Gemini token is used
       * exactly like an API key on the client.
       */
      const ai = new GoogleGenAI({
        apiKey: token,
      });

      const session =
        await ai.live.connect({
          model,

          callbacks: {
            // --------------------------------------------------
            // SOCKET OPENED
            // --------------------------------------------------

            onopen: () => {
              console.log(
                "🟢 Gemini Live WebSocket opened.",
              );

              this.connected = true;
              this.connecting = false;
              this.disconnecting = false;

              this.callbacks.onOpen?.();
            },

            // --------------------------------------------------
            // MESSAGE RECEIVED
            // --------------------------------------------------

            onmessage: (message: any) => {
              this.handleMessage(message);
            },

            // --------------------------------------------------
            // SOCKET ERROR
            // --------------------------------------------------

            onerror: (event: ErrorEvent) => {
              console.error(
                "🔴 Gemini Live WebSocket error:",
                event,
              );

              console.error(
                "WebSocket error message:",
                event.message,
              );

              this.callbacks.onError?.(
                event,
              );
            },

            // --------------------------------------------------
            // SOCKET CLOSED
            // --------------------------------------------------

            onclose: (event: CloseEvent) => {
              console.warn(
                "🟡 Gemini Live WebSocket closed.",
              );

              console.log(
                "Close code:",
                event.code,
              );

              console.log(
                "Close reason:",
                event.reason,
              );

              console.log(
                "Was clean:",
                event.wasClean,
              );

              /**
               * CRITICAL:
               *
               * Once Gemini closes the socket,
               * immediately mark the session as
               * disconnected.
               */
              this.connected = false;

              this.connecting = false;

              /**
               * CRITICAL:
               *
               * Stop microphone processing.
               *
               * Otherwise ScriptProcessorNode
               * continues firing and tries to
               * send audio into the CLOSED socket.
               */
              this.stopMicrophone();

              /**
               * Stop any Gemini audio currently
               * playing.
               */
              this.stopOutputAudio();

              /**
               * Remove dead session reference.
               */
              this.session = null;

              this.callbacks.onClose?.(
                event,
              );
            },
          },

          config: {
            responseModalities: [
              Modality.AUDIO,
            ],

            inputAudioTranscription: {},

            outputAudioTranscription: {},

            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck",
                },
              },
            },

            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
              },
            },

            systemInstruction: {
              parts: [
                {
                  text: `
You are Nova, a friendly real-time multilingual voice assistant.

Always detect the language the user is currently speaking.

English -> respond in English.

Hindi -> respond in Hindi.

Hinglish -> respond naturally in Hinglish.

If the user switches language,
immediately follow the new language.

Do not ask the user to select a language.

Keep responses natural, conversational,
and reasonably short.

Handle interruptions naturally.

Maintain conversation context.

Do not use markdown while speaking.
`,
                },
              ],
            },
          },
        });

      this.session = session;

      console.log(
        "🟢 Gemini Live session created.",
      );
    } catch (error) {
      this.connected = false;
      this.connecting = false;
      this.session = null;

      console.error(
        "🔴 Gemini Live connection failed:",
        error,
      );

      this.callbacks.onError?.(
        error,
      );

      throw error;
    }
  }

  // ============================================================
  // MESSAGE HANDLER
  // ============================================================

  private handleMessage(
    message: any,
  ) {
    this.callbacks.onMessage?.(
      message,
    );

    const serverContent =
      message?.serverContent;

    if (!serverContent) {
      return;
    }

    // ----------------------------------------------------------
    // GEMINI WAS INTERRUPTED
    // ----------------------------------------------------------

    if (
      serverContent.interrupted
    ) {
      console.log(
        "🟡 Gemini response interrupted.",
      );

      /**
       * Immediately stop currently playing
       * Nova audio.
       */
      this.stopOutputAudio();

      this.callbacks.onInterrupted?.();

      return;
    }

    // ----------------------------------------------------------
    // USER TRANSCRIPTION
    // ----------------------------------------------------------

    const inputTranscription =
      serverContent.inputTranscription;

    if (
      inputTranscription?.text
    ) {
      this.callbacks.onUserTranscript?.(
        inputTranscription.text,
      );
    }

    // ----------------------------------------------------------
    // NOVA TRANSCRIPTION
    // ----------------------------------------------------------

    const outputTranscription =
      serverContent.outputTranscription;

    if (
      outputTranscription?.text
    ) {
      this.callbacks.onAssistantTranscript?.(
        outputTranscription.text,
      );
    }

    // ----------------------------------------------------------
    // NOVA AUDIO
    // ----------------------------------------------------------

    const modelTurn =
      serverContent.modelTurn;

    if (
      modelTurn?.parts
    ) {
      for (
        const part of modelTurn.parts
      ) {
        const inlineData =
          part?.inlineData;

        if (
          inlineData?.data
        ) {
          const audio =
            inlineData.data;

          this.callbacks.onAudio?.(
            audio,
          );

          this.playAudio(
            audio,
          );
        }
      }
    }

    // ----------------------------------------------------------
    // TURN COMPLETE
    // ----------------------------------------------------------

    if (
      serverContent.turnComplete
    ) {
      this.callbacks.onTurnComplete?.();
    }
  }

  // ============================================================
  // MICROPHONE
  // ============================================================

  async startMicrophone(): Promise<void> {
    if (
      !this.connected ||
      !this.session
    ) {
      throw new Error(
        "Gemini Live is not connected.",
      );
    }

    /**
     * Prevent duplicate microphone
     * processors.
     */
    if (this.mediaStream) {
      console.warn(
        "Microphone is already running.",
      );

      return;
    }

    console.log(
      "🎤 Starting microphone...",
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

    this.inputAudioContext =
      new AudioContext();

    await this.inputAudioContext.resume();

    console.log(
      "Input AudioContext sample rate:",
      this.inputAudioContext.sampleRate,
    );

    this.mediaSource =
      this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );

    this.processor =
      this.inputAudioContext.createScriptProcessor(
        4096,
        1,
        1,
      );

    this.silentGain =
      this.inputAudioContext.createGain();

    /**
     * We don't want microphone audio
     * directly playing through speakers.
     */
    this.silentGain.gain.value = 0;

    // ----------------------------------------------------------
    // MICROPHONE AUDIO LOOP
    // ----------------------------------------------------------

    this.processor.onaudioprocess =
      (event) => {
        /**
         * THIS IS THE MOST IMPORTANT GUARD.
         *
         * Once the WebSocket closes,
         * this callback may still execute.
         *
         * Therefore we NEVER send audio unless
         * the connection is currently alive.
         */
        if (
          !this.connected ||
          !this.session ||
          this.disconnecting
        ) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(
            0,
          );

        const rms =
          this.calculateRMS(input);

        console.log(
          "Mic RMS:",
          rms.toFixed(5),
        );

        /**
         * Ignore absolute silence.
         */
        if (
          rms < 0.0001
        ) {
          return;
        }

        /**
         * Browser microphone can be 44.1kHz
         * or 48kHz.
         *
         * Gemini expects 16-bit PCM.
         */
        const pcm16 =
          this.convertToPCM16(
            input,
            this.inputAudioContext!
              .sampleRate,
          );

        const base64 =
          this.arrayBufferToBase64(
            pcm16,
          );

        this.sendAudio(
          base64,
        );
      };

    this.mediaSource.connect(
      this.processor,
    );

    this.processor.connect(
      this.silentGain,
    );

    this.silentGain.connect(
      this.inputAudioContext.destination,
    );

    console.log(
      "🟢 Microphone started.",
    );
  }

  // ============================================================
  // SEND AUDIO
  // ============================================================

  private sendAudio(
    base64Audio: string,
  ) {
    /**
     * SECOND IMPORTANT GUARD.
     *
     * Even if something somehow reaches
     * this function after the WebSocket closes,
     * it cannot call Gemini.
     */
    if (
      !this.connected ||
      !this.session ||
      this.disconnecting
    ) {
      return;
    }

    try {
      this.session.sendRealtimeInput(
        {
          audio: {
            data: base64Audio,
            mimeType:
              "audio/pcm;rate=16000",
          },
        },
      );
    } catch (error) {
      /**
       * If Gemini closes between our check
       * and sendRealtimeInput(), don't create
       * an endless error loop.
       */
      console.warn(
        "Gemini connection closed while sending audio.",
      );

      this.connected = false;

      this.stopMicrophone();

      this.callbacks.onError?.(
        error,
      );
    }
  }

  // ============================================================
  // RMS
  // ============================================================

  private calculateRMS(
    data: Float32Array,
  ): number {
    let sum = 0;

    for (
      let i = 0;
      i < data.length;
      i++
    ) {
      sum +=
        data[i] *
        data[i];
    }

    return Math.sqrt(
      sum / data.length,
    );
  }

  // ============================================================
  // PCM CONVERSION
  // ============================================================

  private convertToPCM16(
    input: Float32Array,
    inputSampleRate: number,
  ): ArrayBuffer {
    const targetSampleRate =
      16000;

    const ratio =
      inputSampleRate /
      targetSampleRate;

    const outputLength =
      Math.floor(
        input.length /
          ratio,
      );

    const output =
      new Int16Array(
        outputLength,
      );

    for (
      let i = 0;
      i < outputLength;
      i++
    ) {
      const index =
        Math.floor(
          i * ratio,
        );

      const sample =
        Math.max(
          -1,
          Math.min(
            1,
            input[index],
          ),
        );

      output[i] =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;
    }

    return output.buffer;
  }

  // ============================================================
  // ARRAY BUFFER -> BASE64
  // ============================================================

  private arrayBufferToBase64(
    buffer: ArrayBuffer,
  ): string {
    const bytes =
      new Uint8Array(buffer);

    let binary = "";

    const chunkSize =
      0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      const chunk =
        bytes.subarray(
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

  // ============================================================
  // BASE64 -> ARRAY BUFFER
  // ============================================================

  private base64ToArrayBuffer(
    base64: string,
  ): ArrayBuffer {
    const binary =
      atob(base64);

    const bytes =
      new Uint8Array(
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

    return bytes.buffer;
  }

  // ============================================================
  // PLAY NOVA AUDIO
  // ============================================================

  private async playAudio(
    base64Audio: string,
  ) {
    try {
      if (
        !this.outputAudioContext
      ) {
        this.outputAudioContext =
          new AudioContext({
            sampleRate: 24000,
          });
      }

      await this.outputAudioContext.resume();

      const pcmBuffer =
        this.base64ToArrayBuffer(
          base64Audio,
        );

      const int16 =
        new Int16Array(
          pcmBuffer,
        );

      const audioBuffer =
        this.outputAudioContext.createBuffer(
          1,
          int16.length,
          24000,
        );

      const channel =
        audioBuffer.getChannelData(
          0,
        );

      for (
        let i = 0;
        i < int16.length;
        i++
      ) {
        channel[i] =
          int16[i] / 32768;
      }

      const source =
        this.outputAudioContext.createBufferSource();

      source.buffer =
        audioBuffer;

      source.connect(
        this.outputAudioContext.destination,
      );

      const now =
        this.outputAudioContext.currentTime;

      if (
        this.outputNextTime <
        now
      ) {
        this.outputNextTime =
          now;
      }

      source.start(
        this.outputNextTime,
      );

      this.outputNextTime +=
        audioBuffer.duration;

      this.audioQueue.push(
        source,
      );

      source.onended = () => {
        const index =
          this.audioQueue.indexOf(
            source,
          );

        if (
          index !== -1
        ) {
          this.audioQueue.splice(
            index,
            1,
          );
        }
      };
    } catch (error) {
      console.error(
        "Nova audio playback error:",
        error,
      );
    }
  }

  // ============================================================
  // STOP NOVA AUDIO
  // ============================================================

  private stopOutputAudio() {
    for (
      const source of this.audioQueue
    ) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }

    this.audioQueue = [];

    this.outputNextTime = 0;

    if (
      this.outputAudioContext
    ) {
      this.outputAudioContext
        .close()
        .catch(() => {});

      this.outputAudioContext =
        null;
    }
  }

  // ============================================================
  // STOP MICROPHONE
  // ============================================================

  stopMicrophone() {
    console.log(
      "🎤 Stopping microphone...",
    );

    /**
     * FIRST:
     * Stop the audio callback.
     *
     * This is what prevents the continuous
     * sendRealtimeInput() loop.
     */
    if (this.processor) {
      this.processor.onaudioprocess =
        null;

      try {
        this.processor.disconnect();
      } catch {
        // Already disconnected.
      }

      this.processor = null;
    }

    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {
        // Already disconnected.
      }

      this.mediaSource = null;
    }

    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        // Already disconnected.
      }

      this.silentGain = null;
    }

    /**
     * Stop the actual browser microphone.
     */
    if (this.mediaStream) {
      for (
        const track of
          this.mediaStream.getTracks()
      ) {
        track.stop();
      }

      this.mediaStream = null;
    }

    /**
     * Close microphone AudioContext.
     */
    if (
      this.inputAudioContext
    ) {
      this.inputAudioContext
        .close()
        .catch(() => {});

      this.inputAudioContext =
        null;
    }

    console.log(
      "🟢 Microphone stopped.",
    );
  }

  // ============================================================
  // DISCONNECT
  // ============================================================

  async disconnect(): Promise<void> {
    /**
     * Prevent duplicate disconnect calls.
     */
    if (this.disconnecting) {
      return;
    }

    this.disconnecting = true;

    console.log(
      "Disconnecting Gemini Live...",
    );

    /**
     * IMPORTANT ORDER:
     *
     * 1. Stop microphone
     * 2. Stop audio playback
     * 3. Mark disconnected
     * 4. Close WebSocket
     */

    this.stopMicrophone();

    this.stopOutputAudio();

    this.connected = false;

    this.connecting = false;

    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        console.warn(
          "Gemini session was already closed.",
          error,
        );
      }
    }

    this.session = null;

    this.disconnecting = false;

    console.log(
      "Gemini Live disconnected.",
    );
  }

  // ============================================================
  // STATUS
  // ============================================================

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================
  // SEND TEXT
  // ============================================================

  sendText(
    text: string,
  ) {
    if (
      !this.connected ||
      !this.session ||
      this.disconnecting
    ) {
      console.warn(
        "Cannot send text. Gemini is not connected.",
      );

      return;
    }

    try {
      this.session.sendRealtimeInput(
        {
          text,
        },
      );
    } catch (error) {
      console.error(
        "Gemini text send failed:",
        error,
      );
    }
  }
}