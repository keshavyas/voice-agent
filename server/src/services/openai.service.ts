import { env } from "../config/env.js";

interface ClientSecretResponse {
value?: string;
expires_at?: number;
session?: unknown;
}

export async function createRealtimeClientSecret() {
const response = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
    method: "POST",

    headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
    },

    body: JSON.stringify({
        session: {
        type: "realtime",
        model: env.realtimeModel,
        },
    }),
    },
);

if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
    `OpenAI client secret request failed: ${response.status} ${errorText}`,
    );
}

const data =
    (await response.json()) as ClientSecretResponse;

if (!data.value) {
    throw new Error(
    "OpenAI did not return a realtime client secret.",
    );
}

return {
    clientSecret: data.value,
    expiresAt: data.expires_at ?? null,
};
}