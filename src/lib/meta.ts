import OpenAI from "openai";

// All Meta models are served through one OpenAI-compatible endpoint.
export const MODELS = {
  spark: process.env.SPARK_MODEL ?? "muse-spark-1.3",
  wonder: process.env.WONDER_MODEL ?? "muse-wonder-1.0",
  image: "muse-image-1.0",
  sam: "sam-3.1",
  voice: "muse-voice-transcribe-1.0",
} as const;

let client: OpenAI | null = null;

export function meta(): OpenAI {
  if (!process.env.MODEL_API_KEY) throw new Error("MODEL_API_KEY is not set");
  client ??= new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY });
  return client;
}
