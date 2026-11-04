import { NextResponse } from "next/server";
import type { LabourMode } from "@/lib/economics";
import { buildPlan } from "@/lib/plan";
import type { Farm } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { farm, irrigation, labour, overrides } = (await req.json()) as {
    farm: Farm;
    irrigation?: boolean;
    labour?: LabourMode;
    overrides?: Record<string, number>;
  };
  if (!farm?.data) return NextResponse.json({ error: "farm is required" }, { status: 400 });
  try {
    return NextResponse.json(await buildPlan(farm, { irrigation: irrigation === true, labour: labour ?? "mixed", overrides }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
