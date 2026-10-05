import type { RealtimeTokenResponse } from "../types/voice";

const API_URL =
import.meta.env.VITE_API_URL ??"http://localhost:5000";

export async function getRealtimeToken(): Promise<string> {
const response = await fetch(
    `${API_URL}/api/realtime/token`,
    {
    method: "GET",
    headers: {
        Accept: "application/json",
    },
    },
);

if (!response.ok) {
    const body = await response.text();

    throw new Error(
    `Token request failed: ${response.status} ${body}`,
    );
}

const data =
    (await response.json()) as RealtimeTokenResponse;

if (!data.success || !data.clientSecret) {
    throw new Error(
    data.message ??
        "Realtime client secret was not returned.",
    );
}

return data.clientSecret;
}