// Field operations for each crop, timed in days from sowing/transplanting ("plant")
// or from the start of harvest ("harvest"). Timings follow the same extension
// guides as the crop knowledge base.
import type { CropId } from "./crops";

export type TaskKind = "buy" | "prep" | "nursery" | "plant" | "fertilize" | "spray" | "weed" | "scout" | "water" | "harvest" | "sell";

/** What the weather must (or must not) do for the task to go well. */
export type WeatherNeed = "onset" | "noHeavyRain" | "calmDry" | "dryDays" | "moistSoil" | "none";

export interface TaskTemplate {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  anchor: "nursery" | "plant" | "harvest";
  offset: number; // days from the anchor
  days: number; // how long the task window lasts
  weather: WeatherNeed;
}

const before: TaskTemplate[] = [
  { id: "buy", kind: "buy", title: "Buy seed and fertilizer", detail: "Buy certified seed and fertilizer from a trusted agro-dealer before prices rise at planting time. Keep the receipts.", anchor: "plant", offset: -35, days: 14, weather: "none" },
  { id: "clear", kind: "prep", title: "Clear the land", detail: "Slash weeds and clear the field. Don't burn crop leftovers; leave them to protect the soil.", anchor: "plant", offset: -24, days: 7, weather: "none" },
  { id: "plough", kind: "prep", title: "Plough and make ridges", detail: "Plough and ridge after the first rains soften the soil. Book the tractor early.", anchor: "plant", offset: -12, days: 8, weather: "none" },
];

const grainAfter = (o: { npk: number; urea: number; harvestLabel: string }): TaskTemplate[] => [
  { id: "weed1", kind: "weed", title: "First weeding", detail: "Weed by hand or hoe. Weeds now steal the most food and water.", anchor: "plant", offset: 18, days: 7, weather: "none" },
  { id: "npk", kind: "fertilize", title: "Apply NPK fertilizer", detail: "Apply NPK in a small hole 5cm from each plant, then cover it. Apply when the soil is moist.", anchor: "plant", offset: o.npk, days: 5, weather: "noHeavyRain" },
  { id: "urea", kind: "fertilize", title: "Top-dress with urea", detail: "Apply urea beside the plants and cover it. Don't apply just before heavy rain or it washes away.", anchor: "plant", offset: o.urea, days: 5, weather: "noHeavyRain" },
  { id: "weed2", kind: "weed", title: "Second weeding", detail: "Second weeding and re-ridging to support the plants.", anchor: "plant", offset: o.urea + 4, days: 7, weather: "none" },
  { id: "harvest", kind: "harvest", title: o.harvestLabel, detail: "Harvest when the crop is dry and mature. Pick dry days so the grain doesn't go mouldy.", anchor: "harvest", offset: 0, days: 14, weather: "dryDays" },
  { id: "dry", kind: "sell", title: "Dry, bag and sell", detail: "Dry the grain well, bag it clean, and talk to several buyers before selling.", anchor: "harvest", offset: 14, days: 14, weather: "dryDays" },
];

export const TASKS: Record<CropId, TaskTemplate[]> = {
  maize: [
    ...before,
    { id: "plant", kind: "plant", title: "Plant maize", detail: "Plant once rains are steady: about 3 rains of 20mm or more within 2 weeks. 75cm × 25cm, one seed per hole.", anchor: "plant", offset: 0, days: 14, weather: "onset" },
    { id: "herb", kind: "spray", title: "Spray pre-emergence herbicide", detail: "Spray within 2 days of planting on moist soil. Wear gloves and a mask; follow the label rate.", anchor: "plant", offset: 1, days: 2, weather: "calmDry" },
    { id: "scout", kind: "scout", title: "Scout for fall armyworm", detail: "Walk the field twice a week. Look for ragged holes and sawdust-like frass in the funnel. Spray only if many plants are hit.", anchor: "plant", offset: 10, days: 50, weather: "none" },
    ...grainAfter({ npk: 10, urea: 38, harvestLabel: "Harvest maize" }),
  ],
  sorghum: [
    ...before,
    { id: "plant", kind: "plant", title: "Plant sorghum", detail: "Plant with the first steady rains: about 3 rains of 20mm or more within 2 weeks. 75cm × 30cm, thin to 2 plants.", anchor: "plant", offset: 0, days: 14, weather: "onset" },
    { id: "thin", kind: "weed", title: "Thin to 2 plants per hill", detail: "Pull out extra seedlings so 2 strong plants remain in each hill.", anchor: "plant", offset: 14, days: 5, weather: "none" },
    { id: "birds", kind: "scout", title: "Guard against birds", detail: "As grain fills, scare birds early morning and evening.", anchor: "harvest", offset: -25, days: 25, weather: "none" },
    ...grainAfter({ npk: 14, urea: 38, harvestLabel: "Harvest sorghum" }),
  ],
  soybean: [
    ...before,
    { id: "plant", kind: "plant", title: "Inoculate and plant soybean", detail: "Mix seed with inoculant in the shade just before planting. Plant into moist soil, 5–10cm apart on the ridge.", anchor: "plant", offset: 0, days: 14, weather: "onset" },
    { id: "herb", kind: "spray", title: "Spray pre-emergence herbicide", detail: "Spray within 2 days of planting on moist soil. Follow the label rate.", anchor: "plant", offset: 1, days: 2, weather: "calmDry" },
    { id: "nodules", kind: "scout", title: "Check root nodules", detail: "Dig up a few plants. Pink nodules inside mean they are fixing nitrogen.", anchor: "plant", offset: 35, days: 7, weather: "none" },
    { id: "weed1", kind: "weed", title: "First weeding", detail: "Weed by hand or hoe; soybean is weak against weeds early on.", anchor: "plant", offset: 18, days: 7, weather: "none" },
    { id: "weed2", kind: "weed", title: "Second weeding", detail: "Second weeding before the canopy closes.", anchor: "plant", offset: 40, days: 7, weather: "none" },
    { id: "harvest", kind: "harvest", title: "Harvest soybean quickly", detail: "Harvest when most pods are brown and dry. Late harvest makes pods split and spill.", anchor: "harvest", offset: 0, days: 10, weather: "dryDays" },
    { id: "dry", kind: "sell", title: "Thresh, dry and sell", detail: "Thresh on a tarpaulin, dry well, bag clean, and compare buyers.", anchor: "harvest", offset: 10, days: 14, weather: "dryDays" },
  ],
  rice: [
    ...before,
    { id: "plant", kind: "plant", title: "Sow or transplant rice", detail: "Sow when the field can hold water. Transplant 20cm × 20cm.", anchor: "plant", offset: 0, days: 14, weather: "onset" },
    { id: "herb", kind: "spray", title: "Early weed control", detail: "Use a rice herbicide at the label rate, or hand-weed.", anchor: "plant", offset: 7, days: 5, weather: "calmDry" },
    ...grainAfter({ npk: 14, urea: 45, harvestLabel: "Harvest rice" }),
  ],
  cassava: [
    ...before,
    { id: "plant", kind: "plant", title: "Plant cassava cuttings", detail: "Plant 20–25cm cuttings at 1m × 1m into moist soil.", anchor: "plant", offset: 0, days: 14, weather: "onset" },
    { id: "weed1", kind: "weed", title: "First weeding", detail: "Weed at 3–4 weeks; cassava grows slowly at first.", anchor: "plant", offset: 25, days: 10, weather: "none" },
    { id: "npk", kind: "fertilize", title: "Apply NPK fertilizer", detail: "Apply NPK in a ring around each plant and cover it.", anchor: "plant", offset: 50, days: 10, weather: "noHeavyRain" },
    { id: "weed2", kind: "weed", title: "Second weeding", detail: "Weed again at about 3 months.", anchor: "plant", offset: 90, days: 10, weather: "none" },
    { id: "harvest", kind: "harvest", title: "Harvest cassava", detail: "Harvest from about 12 months, when buyers' prices are good.", anchor: "harvest", offset: 0, days: 30, weather: "none" },
  ],
  tomato: [
    { id: "buy", kind: "buy", title: "Buy seed, manure and inputs", detail: "Buy certified seed, manure, fertilizer and crop protection products from a trusted dealer.", anchor: "nursery", offset: -10, days: 9, weather: "none" },
    { id: "nursery", kind: "nursery", title: "Start the tomato nursery", detail: "Sow in a shaded, raised nursery bed. Water lightly every morning. Cover with fine net against insects.", anchor: "nursery", offset: 0, days: 7, weather: "none" },
    { id: "beds", kind: "prep", title: "Prepare beds and add manure", detail: "Plough, make beds and work in manure 2 weeks before transplanting. Check the pump and water channels.", anchor: "plant", offset: -14, days: 10, weather: "none" },
    { id: "harden", kind: "nursery", title: "Harden off seedlings", detail: "Reduce watering and shade for a week so seedlings get tough before transplanting.", anchor: "plant", offset: -7, days: 7, weather: "none" },
    { id: "plant", kind: "plant", title: "Transplant tomato", detail: "Transplant in the evening, 60cm × 50cm, and water straight away.", anchor: "plant", offset: 0, days: 14, weather: "none" },
    { id: "water", kind: "water", title: "Irrigate twice a week", detail: "Water evenly twice a week. Irregular watering causes fruit cracking and blossom-end rot.", anchor: "plant", offset: 1, days: 80, weather: "none" },
    { id: "npk", kind: "fertilize", title: "First NPK dose", detail: "Apply NPK beside each plant and water it in.", anchor: "plant", offset: 7, days: 5, weather: "noHeavyRain" },
    { id: "scout", kind: "scout", title: "Scout for Tuta absoluta", detail: "Check leaves for mines and fruit for holes twice a week; use pheromone traps. Spray only when you find them, rotate products and respect the pre-harvest interval.", anchor: "plant", offset: 10, days: 80, weather: "none" },
    { id: "npk2", kind: "fertilize", title: "NPK and urea at flowering", detail: "Second NPK dose plus urea when flowers appear, then water it in.", anchor: "plant", offset: 35, days: 5, weather: "noHeavyRain" },
    { id: "harvest", kind: "harvest", title: "Pick tomatoes", detail: "Pick at the pink-red stage every 3–4 days. Keep baskets in the shade.", anchor: "harvest", offset: 0, days: 35, weather: "none" },
  ],
};
