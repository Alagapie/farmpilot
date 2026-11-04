import { NextResponse } from "next/server";
import { meta, MODELS } from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 120;

interface News {
  items: { crop: string; headline: string; text: string }[];
  sources: { title: string; url: string }[];
  fetchedAt: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { crop: { type: "string" }, headline: { type: "string" }, text: { type: "string" } },
        required: ["crop", "headline", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const cache = new Map<string, News>();
const TTL = 12 * 3_600_000;

// Muse Spark searches this week's market news for the farmer's crops.
export async function POST(req: Request) {
  const { crops, state } = (await req.json()) as { crops: string[]; state: string };
  const key = `${state}:${[...crops].sort().join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - new Date(hit.fetchedAt).getTime() < TTL) return NextResponse.json(hit);
  try {
    const res = await meta().responses.create({
      model: MODELS.spark,
      reasoning: { effort: "low" },
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "developer",
          content: `You brief smallholder farmers in ${state} State, Nigeria, on grain and produce markets. Today is ${new Date().toISOString().slice(0, 10)}.
Search for market news from the last 2 months about: ${crops.join(", ")} (prices, demand, imports, government policy, harvest supply) in northern Nigeria.
For each crop give one item: a headline of at most 10 words and 1-2 simple sentences on what it means for a farmer deciding when to sell.
Only report what your sources say; mention the month of the news. If you find nothing recent for a crop, say so plainly.`,
        },
        { role: "user", content: "What is happening in the market this month?" },
      ],
      text: { format: { type: "json_schema", name: "market_news", schema: SCHEMA, strict: true } },
    });
    const sources = new Map<string, string>();
    let text = "";
    for (const item of res.output) {
      if (item.type === "web_search_call") {
        for (const s of (item.action as { sources?: { url?: string }[] } | undefined)?.sources ?? []) {
          if (s.url && sources.size < 6) sources.set(s.url, new URL(s.url).hostname.replace(/^www\./, ""));
        }
      }
      if (item.type === "message") text = item.content.map((c) => (c.type === "output_text" ? c.text : "")).join("");
    }
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Pick<News, "items">;
    const news: News = { items: parsed.items, sources: [...sources].map(([url, title]) => ({ url, title })), fetchedAt: new Date().toISOString() };
    cache.set(key, news);
    return NextResponse.json(news);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
