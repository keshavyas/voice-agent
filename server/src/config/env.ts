import "dotenv/config";

const requiredEnv = [
"OPENAI_API_KEY",
] as const;

for (const key of requiredEnv) {
if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
}
}

export const env = {
port: Number(process.env.PORT ?? 5000),

clientUrl:
    process.env.CLIENT_URL ?? "http://localhost:5173",

openaiApiKey:
    process.env.OPENAI_API_KEY as string,

realtimeModel:
    process.env.OPENAI_REALTIME_MODEL ??
    "gpt-realtime-2.1",
};
