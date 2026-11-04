import { NextResponse } from "next/server";
import type { Alert } from "@/lib/advisor";
import { meta, MODELS } from "@/lib/meta";

export const runtime = "nodejs";

const SCHEMA = {
  type: "object",
  properties: { greeting: { type: "string" }, message: { type: "string" } },
  required: ["greeting", "message"],
  additionalProperties: false,
};

// Muse Spark turns the rule-checked alerts into a short spoken-style briefing.
// It may only rephrase and prioritise them; the alerts carry the facts.
export async function POST(req: Request) {
  const { farmName, place, date, simulated, alerts, weather } = (await req.json()) as {
    farmName: string;
    place: string;
    date: string;
    simulated: boolean;
    alerts: Alert[];
    weather: string;
  };
  try {
    const res = await meta().chat.completions.create({
      model: MODELS.spark,
      reasoning_effort: "low",
      messages: [
        {
          role: "developer",
          content: `You are FarmPilot, a friendly farm adviser in Nigeria, giving a farmer their morning briefing.
Write in very simple English (primary-school level), warm and direct, as if speaking.
Use only the alerts and weather given; do not add new advice, numbers, products or dates.
Lead with the most urgent alert. greeting: at most 8 words. message: 2 to 4 short sentences.`,
        },
        { role: "user", content: JSON.stringify({ farmName, place, date, weather, weatherIsSimulated: simulated, alerts }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "briefing", strict: true, schema: SCHEMA } },
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("Empty briefing");
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
