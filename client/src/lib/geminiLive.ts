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

const INPUT_SAMPLE_RATE = 16000;

const OUTPUT_SAMPLE_RATE = 24000;

function float32ToPCM16(
  input: Float32Array,
): Int16Array {
  const output =
    new Int16Array(
      input.length,
    );

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    const sample =
      Math.max(
        -1,
        Math.min(
          1,
          input[i],
        ),
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
  const bytes =
    new Uint8Array(
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

function base64ToPCM16(
  base64: string,
): Int16Array {
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

  return new Int16Array(
    bytes.buffer,
  );
}

function resampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (
    inputSampleRate ===
    INPUT_SAMPLE_RATE
  ) {
    return input;
  }

  const ratio =
    inputSampleRate /
    INPUT_SAMPLE_RATE;

  const outputLength =
    Math.floor(
      input.length / ratio,
    );

  const output =
    new Float32Array(
      outputLength,
    );

  for (
    let i = 0;
    i < outputLength;
    i++
  ) {
    const position =
      i * ratio;

    const left =
      Math.floor(position);

    const right =
      Math.min(
        left + 1,
        input.length - 1,
      );

    const fraction =
      position - left;

    output[i] =
      input[left] *
        (1 - fraction) +
      input[right] *
        fraction;
  }

  return output;
}

export class GeminiLiveClient {
  private session: any = null;

  private inputContext:
    AudioContext | null = null;

  private outputContext:
    AudioContext | null = null;

  private mediaStream:
    MediaStream | null = null;

  private source:
    MediaStreamAudioSourceNode | null =
      null;

  private processor:
    ScriptProcessorNode | null =
      null;

  private silentGain:
    GainNode | null = null;

  private callbacks:
    GeminiLiveCallbacks;

  private stopped = true;

  private nextAudioTime = 0;

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
    console.log(
      "Connecting to Gemini Live...",
    );

    this.stopped = false;

    /*
     * IMPORTANT:
     * The ephemeral token is used as
     * the API key for this Live session.
     */
    const ai =
      new GoogleGenAI({
        apiKey: token,
      });

    /*
     * Create the output audio context.
     *
     * Do NOT force 24kHz here.
     * The browser can use its native
     * output sample rate and resample
     * the AudioBuffer automatically.
     */
    this.outputContext =
      new AudioContext({
        latencyHint:
          "interactive",
      });

    await this.resumeAudio();

    this.nextAudioTime =
      this.outputContext.currentTime;

    this.session =
      await ai.live.connect({
        model,

        config: {
          responseModalities: [
            Modality.AUDIO,
          ],

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck",
              },
            },
          },

          inputAudioTranscription: {},

          outputAudioTranscription: {},

          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
            },
          },

          systemInstruction: {
            parts: [
              {
                text: `
You are Nova.

You are a natural human-like voice assistant.

Always respond naturally in the language currently being used by the user.

English -> English.

Hindi -> Hindi.

Hinglish -> natural Hinglish.

If the user changes language,
immediately change with them.

Never ask them to select a language.

Maintain conversation context.

Understand short replies,
interruptions,
follow-up questions,
casual speech,
Hindi,
English,
and Hinglish.

Be friendly,
warm,
natural,
and conversational.

Do not sound robotic.

Keep normal voice responses concise.

Do not use markdown in spoken responses.

If the user asks something technical,
give a clear technical explanation.

You are Nova.
`,
              },
            ],
          },
        },

        callbacks: {
          onopen: () => {
            console.log(
              "Gemini Live connected",
            );

            this.callbacks.onOpen?.();

            /*
             * TEST GREETING
             *
             * This proves that the
             * Gemini -> browser audio
             * pipeline is working.
             */
            setTimeout(() => {
              if (
                !this.stopped &&
                this.session
              ) {
                console.log(
                  "Sending Nova startup greeting...",
                );

                this.session.sendRealtimeInput(
                  {
                    text: "Say a short friendly greeting to the user. Introduce yourself as Nova.",
                  },
                );
              }
            }, 300);
          },

          onmessage: (
            message: any,
          ) => {
            this.handleMessage(
              message,
            );
          },

          onerror: (
            event: any,
          ) => {
            console.error(
              "Gemini Live error:",
              event,
            );

            const error =
              event instanceof Error
                ? event
                : new Error(
                    event?.message ??
                      event?.error?.message ??
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
              "Gemini Live closed",
              event,
            );

            this.callbacks.onClose?.();
          },
        },
      });

    console.log(
      "NOVA READY",
    );

    await this.startMicrophone();
  }

  private async resumeAudio() {
    if (
      !this.outputContext
    ) {
      return;
    }

    if (
      this.outputContext.state !==
      "running"
    ) {
      await this.outputContext.resume();
    }

    console.log(
      "Output AudioContext:",
      this.outputContext.state,
      this.outputContext.sampleRate,
    );
  }

  private async startMicrophone() {
    console.log(
      "Requesting microphone...",
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

          video: false,
        },
      );

    const track =
      this.mediaStream.getAudioTracks()[0];

    console.log(
      "Microphone track:",
      track.getSettings(),
    );

    /*
     * Use browser's native audio
     * sample rate.
     *
     * We resample the chunks to
     * 16kHz ourselves.
     */
    this.inputContext =
      new AudioContext({
        latencyHint:
          "interactive",
      });

    if (
      this.inputContext.state !==
      "running"
    ) {
      await this.inputContext.resume();
    }

    console.log(
      "Input AudioContext:",
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

    /*
     * Prevent microphone audio
     * from being played back directly.
     */
    this.silentGain =
      this.inputContext.createGain();

    this.silentGain.gain.value = 0;

    this.processor.onaudioprocess = (
      event,
    ) => {
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

      /*
       * Convert browser's actual
       * sample rate to 16kHz.
       */
      const resampled =
        resampleTo16k(
          input,
          this.inputContext
            ?.sampleRate ??
            48000,
        );

      const pcm =
        float32ToPCM16(
          resampled,
        );

      /*
       * Log microphone energy
       * occasionally.
       */
      let sum = 0;

      for (
        let i = 0;
        i < input.length;
        i++
      ) {
        sum +=
          input[i] *
          input[i];
      }

      const rms =
        Math.sqrt(
          sum / input.length,
        );

      if (
        Math.random() < 0.01
      ) {
        console.log(
          "Mic RMS:",
          rms.toFixed(5),
        );
      }

      const base64 =
        pcm16ToBase64(pcm);

      this.session.sendRealtimeInput(
        {
          audio: {
            data: base64,

            mimeType:
              "audio/pcm;rate=16000",
          },
        },
      );
    };

    this.source.connect(
      this.processor,
    );

    this.processor.connect(
      this.silentGain,
    );

    this.silentGain.connect(
      this.inputContext.destination,
    );

    console.log(
      "Microphone started",
    );
  }

  private handleMessage(
    message: any,
  ) {
    console.log(
      "Gemini message:",
      message,
    );

    const serverContent =
      message?.serverContent;

    if (!serverContent) {
      return;
    }

    /*
     * USER INTERRUPTED NOVA
     */
    if (
      serverContent.interrupted
    ) {
      console.log(
        "User interrupted Nova",
      );

      this.stopAudioPlayback();

      this.callbacks.onInterrupted?.();

      return;
    }

    /*
     * USER TRANSCRIPT
     */
    const inputTranscript =
      serverContent
        .inputTranscription
        ?.text;

    if (
      inputTranscript
    ) {
      console.log(
        "USER:",
        inputTranscript,
      );

      this.callbacks.onInputTranscript?.(
        inputTranscript,
      );
    }

    /*
     * NOVA TRANSCRIPT
     */
    const outputTranscript =
      serverContent
        .outputTranscription
        ?.text;

    if (
      outputTranscript
    ) {
      console.log(
        "NOVA:",
        outputTranscript,
      );

      this.callbacks.onOutputTranscript?.(
        outputTranscript,
      );
    }

    /*
     * MODEL AUDIO
     */
    const parts =
      serverContent.modelTurn
        ?.parts;

    if (parts) {
      for (
        const part of parts
      ) {
        const audioData =
          part?.inlineData?.data;

        if (
          audioData
        ) {
          console.log(
            "🔊 NOVA AUDIO RECEIVED:",
            audioData.length,
          );

          this.callbacks.onAudioStart?.();

          this.playAudio(
            audioData,
          );
        }
      }
    }

    /*
     * END OF NOVA TURN
     */
    if (
      serverContent.turnComplete
    ) {
      console.log(
        "Nova turn complete",
      );

      this.callbacks.onAudioEnd?.();
    }
  }

  private async playAudio(
    base64Audio: string,
  ) {
    if (
      !this.outputContext
    ) {
      console.error(
        "No output AudioContext",
      );

      return;
    }

    /*
     * Make absolutely sure
     * the browser is playing audio.
     */
    await this.resumeAudio();

    const pcm =
      base64ToPCM16(
        base64Audio,
      );

    if (
      pcm.length === 0
    ) {
      return;
    }

    const audioBuffer =
      this.outputContext.createBuffer(
        1,
        pcm.length,
        OUTPUT_SAMPLE_RATE,
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

    gain.gain.value = 1.0;

    source.connect(gain);

    gain.connect(
      this.outputContext.destination,
    );

    const now =
      this.outputContext.currentTime;

    /*
     * If the queue fell behind,
     * start immediately.
     */
    if (
      this.nextAudioTime <
      now
    ) {
      this.nextAudioTime =
        now + 0.02;
    }

    source.start(
      this.nextAudioTime,
    );

    this.nextAudioTime +=
      audioBuffer.duration;

    console.log(
      "🔊 Playing Nova audio",
      {
        samples: pcm.length,
        duration:
          audioBuffer.duration,
        context:
          this.outputContext.state,
      },
    );
  }

  private stopAudioPlayback() {
    if (
      !this.outputContext
    ) {
      return;
    }

    this.nextAudioTime =
      this.outputContext.currentTime;

    console.log(
      "Nova audio playback stopped",
    );
  }

  mute() {
    if (
      !this.mediaStream
    ) {
      return;
    }

    for (
      const track of
      this.mediaStream.getAudioTracks()
    ) {
      track.enabled = false;
    }

    console.log(
      "Microphone muted",
    );
  }

  unmute() {
    if (
      !this.mediaStream
    ) {
      return;
    }

    for (
      const track of
      this.mediaStream.getAudioTracks()
    ) {
      track.enabled = true;
    }

    console.log(
      "Microphone unmuted",
    );
  }

  async disconnect() {
    console.log(
      "Disconnecting Nova...",
    );

    this.stopped = true;

    try {
      this.processor?.disconnect();
    } catch {}

    try {
      this.source?.disconnect();
    } catch {}

    try {
      this.silentGain?.disconnect();
    } catch {}

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

    try {
      this.session?.close();
    } catch {}

    this.processor = null;

    this.source = null;

    this.silentGain = null;

    this.mediaStream = null;

    this.inputContext = null;

    this.outputContext = null;

    this.session = null;

    console.log(
      "Nova disconnected",
    );
  }
}