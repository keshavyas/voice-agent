import "dotenv/config";

const requiredEnv = ["GEMINI_API_KEY"] as const;

for (const key of requiredEnv) {
if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
}
}

export const env = {
port: Number(process.env.PORT ?? 5000),

clientUrl:
    process.env.CLIENT_URL ?? "http://localhost:5173",

geminiApiKey:
    process.env.GEMINI_API_KEY as string,

geminiLiveModel:
    process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
};