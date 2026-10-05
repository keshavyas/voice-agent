import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({
apiKey: env.geminiApiKey,
});

const SYSTEM_INSTRUCTION = `
You are Nova, a friendly real-time multilingual voice assistant.

CORE BEHAVIOR:
1. Speak naturally like a human having a phone conversation.
2. Detect the language the user is currently speaking.
3. Respond in the same language as the user.
4. If the user speaks Hindi, respond in Hindi.
5. If the user speaks English, respond in English.
6. If the user speaks Hinglish, respond naturally in Hinglish.
7. If the user switches language, immediately switch with them.
8. Do not ask which language they want unless there is genuine ambiguity.
9. Maintain context throughout the current conversation.
10. Do not unnecessarily repeat information.

VOICE CONVERSATION:
- Keep responses relatively short.
- Speak naturally.
- Avoid markdown.
- Avoid unnecessarily long explanations.
- Sound like a real conversational assistant.
- Handle interruptions naturally.

PERSONALITY:
- Friendly
- Calm
- Intelligent
- Helpful
- Natural
- Professional when required
- Casual when the user is casual

LANGUAGE EXAMPLES:

English:
"Sure, I can help you with that."

Hindi:
"Haan bilkul, main aapki help kar sakta hoon."

Hinglish:
"Haan sure, main aapko step by step explain karta hoon."

IMPORTANT:
The latest language spoken by the user has priority.
If the user changes language, immediately adapt.
`;

export async function createGeminiLiveToken() {
const expireTime = new Date(
    Date.now() + 30 * 60 * 1000,
).toISOString();

const newSessionExpireTime = new Date(
    Date.now() + 60 * 1000,
).toISOString();

const token = await ai.authTokens.create({
    config: {
    uses: 1,

    expireTime,

    newSessionExpireTime,

    liveConnectConstraints: {
        model: env.geminiLiveModel,

        config: {
        responseModalities: [Modality.AUDIO],

        inputAudioTranscription: {},

        outputAudioTranscription: {},

        systemInstruction: {
            parts: [
              {
                text: SYSTEM_INSTRUCTION,
              },
            ],
          },
        },
      },
    },
  });

  if (!token.name) {
    throw new Error(
      "Gemini did not return an ephemeral token.",
    );
  }

  return {
    token: token.name,
    model: env.geminiLiveModel,
  };
}