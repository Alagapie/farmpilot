// Probe: Muse Spark + web_search for current Nigerian farm prices.
import OpenAI from "openai";
const client = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY });
const t = Date.now();
const res = await client.responses.create({
  model: "muse-spark-1.3",
  reasoning: { effort: "low" },
  tools: [{ type: "web_search" }],
  input: "Find the current (2026) market price in Nigeria, ideally Kaduna, of: a 50kg bag of NPK 15-15-15 fertilizer, a 50kg bag of urea, and a 100kg bag of maize grain. Give each price in naira with the source URL and date.",
});
console.log((Date.now() - t) / 1000, "s");
console.log(res.output_text.slice(0, 1500));
console.log(JSON.stringify(res.usage));
