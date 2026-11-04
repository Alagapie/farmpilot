import type { Soil } from "./types";

export type Level = "good" | "watch" | "act";

export interface Insight {
  label: string;
  value: string;
  level: Level;
  note: string;
}

// Standard agronomic thresholds for tropical topsoils (0-30cm).
export function soilInsights(soil: Soil): Insight[] {
  const out: Insight[] = [];
  if (soil.ph != null) {
    const ph = soil.ph;
    out.push({
      label: "Soil pH",
      value: ph.toFixed(1),
      level: ph < 5.5 || ph > 7.8 ? "act" : ph < 6 ? "watch" : "good",
      note:
        ph < 5.5
          ? "Strongly acidic. Liming will unlock nutrients for most crops."
          : ph < 6
            ? "Slightly acidic. Fine for maize, cassava and soybean; watch phosphorus."
            : ph <= 7.5
              ? "Ideal range for most crops."
              : "Alkaline. Some nutrients (iron, zinc) become less available.",
    });
  }
  if (soil.organicCarbon != null) {
    const oc = soil.organicCarbon;
    out.push({
      label: "Organic matter",
      value: `${oc.toFixed(1)} g/kg C`,
      level: oc < 10 ? "act" : oc < 20 ? "watch" : "good",
      note:
        oc < 10
          ? "Low. Add manure or compost and keep crop residues on the field."
          : oc < 20
            ? "Moderate. Keep building it with residues and manure."
            : "Good organic matter for holding water and nutrients.",
    });
  }
  if (soil.nitrogen != null) {
    const n = soil.nitrogen;
    out.push({
      label: "Nitrogen",
      value: `${n.toFixed(2)} g/kg`,
      level: n < 1 ? "act" : n < 2 ? "watch" : "good",
      note:
        n < 1
          ? "Low. Cereals will need N fertilizer; legumes like soybean add N back."
          : n < 2
            ? "Medium. Top-dress cereals with N."
            : "Good nitrogen supply.",
    });
  }
  if (soil.cec != null) {
    const cec = soil.cec;
    out.push({
      label: "Nutrient holding (CEC)",
      value: `${cec.toFixed(1)} cmol/kg`,
      level: cec < 10 ? "watch" : "good",
      note:
        cec < 10
          ? "Low. Split fertilizer into 2 doses so rain doesn't wash it away."
          : "Holds nutrients well.",
    });
  }
  if (soil.sand != null && soil.clay != null) {
    out.push({
      label: "Texture",
      value: soil.texture,
      level: soil.sand > 70 || soil.clay > 45 ? "watch" : "good",
      note:
        soil.sand > 70
          ? "Sandy: drains fast and dries quickly. Mulch and plant on time."
          : soil.clay > 45
            ? "Heavy clay: can waterlog. Use ridges or raised beds."
            : `${Math.round(soil.sand)}% sand, ${Math.round(soil.clay)}% clay. Workable soil.`,
    });
  }
  return out;
}
