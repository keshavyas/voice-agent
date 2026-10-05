import type {
  GeminiTokenResponse,
} from "../types/voice";

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:5000";

export async function getGeminiToken(): Promise<{
  token: string;
  model: string;
}> {
  const response = await fetch(
    `${API_URL}/api/gemini/token`,
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
      `Gemini token request failed: ${response.status} ${body}`,
    );
  }

  const data =
    (await response.json()) as GeminiTokenResponse;

  if (!data.success || !data.token) {
    throw new Error(
      data.message ??
        "Gemini token was not returned.",
    );
  }

  return {
    token: data.token,
    model:
      data.model ??
      "gemini-3.8-live",
  };
}