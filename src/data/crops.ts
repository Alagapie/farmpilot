// Agronomy knowledge base for the crops FarmPilot plans.
// Typical recommendations for Nigeria compiled from IITA, NAERLS, IAR (ABU Zaria),
// NCRI and AfricaRice extension guides. Values are per hectare and are planning
// estimates, not guarantees; local extension advice should take precedence.

export type CropId = "maize" | "rice" | "soybean" | "sorghum" | "cassava" | "tomato";

/** A purchasable item, matched to a line in the live price sheet. */
export type PriceKey =
  | "npk_15_15_15"
  | "urea"
  | "ssp"
  | "seed_maize"
  | "seed_rice"
  | "seed_soybean"
  | "seed_sorghum"
  | "stems_cassava"
  | "seed_tomato"
  | "herbicide"
  | "insecticide"
  | "ploughing"
  | "labour_day"
  | "crop_maize"
  | "crop_rice"
  | "crop_soybean"
  | "crop_sorghum"
  | "crop_cassava"
  | "crop_tomato";

export interface InputLine {
  item: PriceKey;
  label: string;
  perHa: number; // in the price sheet's unit
  when: string;
}

export interface Crop {
  id: CropId;
  name: string;
  /** Agro-ecological zones where the crop does well in the main rainy season. */
  zones: { good: string[]; possible: string[] };
  minRainMm: number;
  growingDays: [number, number];
  varieties: { name: string; note: string }[];
  spacing: string;
  plantsPerHa: string;
  inputs: InputLine[];
  labourDaysPerHa: number;
  needsPloughing: boolean;
  /** Yield in the price sheet's crop unit (100kg bags, or tonnes for cassava, 50kg baskets for tomato). */
  yieldPerHa: Record<"new" | "some" | "experienced", [number, number, number]>; // [low, expected, high]
  yieldUnit: string;
  plantingRule: string;
  strengths: string[];
  risks: string[];
  soilNotes: string;
}

const ALL_SAVANNA = ["Sudan Savanna", "Northern Guinea Savanna", "Southern Guinea Savanna"];

export const CROPS: Record<CropId, Crop> = {
  maize: {
    id: "maize",
    name: "Maize",
    zones: { good: ["Northern Guinea Savanna", "Southern Guinea Savanna", "Derived Savanna"], possible: ["Sudan Savanna", "Humid Rainforest"] },
    minRainMm: 600,
    growingDays: [90, 120],
    varieties: [
      { name: "SAMMAZ 15", note: "Open-pollinated, ~110 days, tolerant of striga; seed can be saved" },
      { name: "SAMMAZ 52 / 53", note: "Extra-early (80–90 days) for short or uncertain seasons" },
      { name: "Oba Super 9 (hybrid)", note: "Higher yield with good fertilizer; buy new seed every season" },
    ],
    spacing: "75 cm between ridges × 25 cm between plants, 1 seed per hole",
    plantsPerHa: "about 53,000",
    inputs: [
      { item: "seed_maize", label: "Improved maize seed", perHa: 25, when: "At planting" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 4, when: "1–2 weeks after planting" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "5–6 weeks after planting (knee high)" },
      { item: "herbicide", label: "Pre-emergence herbicide (litres)", perHa: 3, when: "Within 2 days of planting" },
      { item: "insecticide", label: "Insecticide for fall armyworm (litres)", perHa: 1, when: "Only if armyworm damage is seen" },
    ],
    labourDaysPerHa: 45,
    needsPloughing: true,
    yieldPerHa: { new: [10, 18, 25], some: [15, 25, 35], experienced: [25, 35, 45] },
    yieldUnit: "bags of grain (100kg)",
    plantingRule: "Plant once the rains are steady (about 3 rains of 20mm+ within 2 weeks). In the Northern Guinea Savanna that is usually late May to mid June.",
    strengths: ["Strong local demand (food, feed, poultry)", "Responds well to fertilizer", "Fits rotation with soybean"],
    risks: ["Fall armyworm", "Striga weed on tired soils", "Needs nitrogen: costly on low-N soil", "Price drops at harvest (Oct–Nov)"],
    soilNotes: "Hungry for nitrogen; on low-organic-matter soil yield depends heavily on fertilizer and manure.",
  },
  rice: {
    id: "rice",
    name: "Rice",
    zones: { good: ["Northern Guinea Savanna", "Southern Guinea Savanna", "Derived Savanna"], possible: ["Sudan Savanna", "Humid Rainforest"] },
    minRainMm: 1000,
    growingDays: [110, 130],
    varieties: [
      { name: "FARO 44 (SIPI)", note: "Popular lowland/fadama rice, ~110–120 days, long grain" },
      { name: "FARO 66 / 67", note: "Tolerate short flooding in low-lying fields" },
      { name: "NERICA 1 / 2", note: "Upland rice for fields that don't flood (needs well-spread rain)" },
    ],
    spacing: "20 cm × 20 cm when transplanting, or drilled in rows 20–25 cm apart",
    plantsPerHa: "about 250,000 hills",
    inputs: [
      { item: "seed_rice", label: "Certified rice seed", perHa: 60, when: "Nursery or direct seeding" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 4, when: "At transplanting / 2 weeks after sowing" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "Split: tillering and panicle start" },
      { item: "herbicide", label: "Rice herbicide (litres)", perHa: 4, when: "Early weed control" },
    ],
    labourDaysPerHa: 80,
    needsPloughing: true,
    yieldPerHa: { new: [12, 20, 28], some: [18, 28, 38], experienced: [28, 38, 50] },
    yieldUnit: "bags of paddy (100kg)",
    plantingRule: "Best in low-lying fadama fields that hold water. Upland rice only where rain is reliable for 4 months.",
    strengths: ["High demand and good prices", "Uses waterlogged land other crops can't"],
    risks: ["Needs water control; drought or floods hit hard", "Labour-heavy (transplanting, bird scaring, threshing)", "Birds at grain filling"],
    soilNotes: "Tolerates heavier, wetter soils; on sandy upland soils it suffers in dry spells.",
  },
  soybean: {
    id: "soybean",
    name: "Soybean",
    zones: { good: ["Northern Guinea Savanna", "Southern Guinea Savanna"], possible: ["Derived Savanna", "Sudan Savanna"] },
    minRainMm: 700,
    growingDays: [90, 110],
    varieties: [
      { name: "TGX 1951-3F", note: "Medium maturity (~100 days), good yield, rust tolerant" },
      { name: "TGX 1835-10E", note: "Early (~90 days), for shorter seasons" },
      { name: "TGX 1448-2E", note: "Widely grown, high yield, ~110 days" },
    ],
    spacing: "75 cm between ridges, 5–10 cm between plants (drilled)",
    plantsPerHa: "about 250,000–300,000",
    inputs: [
      { item: "seed_soybean", label: "Improved soybean seed", perHa: 60, when: "At planting" },
      { item: "ssp", label: "Single super phosphate (50kg bags)", perHa: 2, when: "At planting" },
      { item: "herbicide", label: "Pre-emergence herbicide (litres)", perHa: 3, when: "Within 2 days of planting" },
    ],
    labourDaysPerHa: 40,
    needsPloughing: true,
    yieldPerHa: { new: [6, 10, 14], some: [8, 13, 18], experienced: [12, 18, 24] },
    yieldUnit: "bags of grain (100kg)",
    plantingRule: "Plant mid June to mid July in the Guinea Savanna so pods dry after the rains stop.",
    strengths: ["Feeds the soil with nitrogen (needs no urea)", "Reduces striga for the next maize crop", "Strong demand from feed mills and processors"],
    risks: ["Pods shatter if harvest is late", "Lower yield per hectare than cereals"],
    soilNotes: "Good choice on low-nitrogen soil because it makes its own nitrogen; needs phosphorus (SSP).",
  },
  sorghum: {
    id: "sorghum",
    name: "Sorghum",
    zones: { good: ALL_SAVANNA, possible: ["Derived Savanna"] },
    minRainMm: 450,
    growingDays: [100, 130],
    varieties: [
      { name: "SAMSORG 45 (CSR-01)", note: "Improved, ~110 days, good grain quality" },
      { name: "SAMSORG 46 (ICSV 400)", note: "High yield, tolerant of striga" },
      { name: "Improved Kaura", note: "Familiar local type, later maturing" },
    ],
    spacing: "75 cm between ridges × 30 cm between hills, thin to 2 plants",
    plantsPerHa: "about 90,000",
    inputs: [
      { item: "seed_sorghum", label: "Improved sorghum seed", perHa: 10, when: "At planting" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 2, when: "2 weeks after planting" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 1, when: "5–6 weeks after planting" },
    ],
    labourDaysPerHa: 40,
    needsPloughing: true,
    yieldPerHa: { new: [8, 12, 16], some: [10, 16, 22], experienced: [15, 22, 30] },
    yieldUnit: "bags of grain (100kg)",
    plantingRule: "Plant with the first steady rains (late May–June in the Guinea Savanna).",
    strengths: ["Handles dry spells and poor soils better than maize", "Low input cost", "Food security staple in the north"],
    risks: ["Birds and grain mould", "Lower market price than maize"],
    soilNotes: "Tolerates low fertility and sandy soils; still responds to modest fertilizer.",
  },
  cassava: {
    id: "cassava",
    name: "Cassava",
    zones: { good: ["Derived Savanna", "Humid Rainforest", "Southern Guinea Savanna"], possible: ["Northern Guinea Savanna"] },
    minRainMm: 1000,
    growingDays: [300, 450],
    varieties: [
      { name: "TME 419", note: "High yield, good for garri and fufu, ~12 months" },
      { name: "TMS 98/0581", note: "High dry matter, disease tolerant" },
      { name: "UMUCASS 36 / 38", note: "Yellow (pro-vitamin A) roots" },
    ],
    spacing: "1 m × 1 m (10,000 cuttings per hectare), cuttings 20–25 cm long",
    plantsPerHa: "10,000",
    inputs: [
      { item: "stems_cassava", label: "Cassava stem bundles", perHa: 50, when: "At planting" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 6, when: "6–8 weeks after planting" },
      { item: "herbicide", label: "Herbicide (litres)", perHa: 3, when: "Before and soon after planting" },
    ],
    labourDaysPerHa: 70,
    needsPloughing: true,
    yieldPerHa: { new: [8, 12, 16], some: [10, 15, 20], experienced: [15, 22, 30] },
    yieldUnit: "tonnes of fresh roots",
    plantingRule: "Plant at the start of the rains; harvest about 12 months later. Ties up the land for a full year.",
    strengths: ["Very hardy; survives poor soil and dry spells", "Can be harvested when prices are good", "Food security"],
    risks: ["Money is locked in for ~12 months", "Bulky and heavy to transport", "Prices vary widely between processors"],
    soilNotes: "Tolerates acidic, low-fertility soils better than most crops.",
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    zones: { good: ALL_SAVANNA, possible: ["Derived Savanna"] },
    minRainMm: 0,
    growingDays: [100, 130],
    varieties: [
      { name: "UC82B", note: "Firm, good for transport, ~110 days" },
      { name: "Roma VF", note: "Popular processing/fresh type" },
      { name: "Hybrid (e.g. Padma F1)", note: "Higher yield and disease tolerance; costly seed" },
    ],
    spacing: "60 cm between rows × 50 cm between plants (raised in a nursery for 4 weeks first)",
    plantsPerHa: "about 33,000",
    inputs: [
      { item: "seed_tomato", label: "Tomato seed (10g packs)", perHa: 25, when: "Nursery, 4 weeks before transplanting" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 8, when: "Split: transplanting and flowering" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "At flowering" },
      { item: "insecticide", label: "Insecticide incl. for Tuta absoluta (litres)", perHa: 4, when: "Regular scouting and spraying" },
    ],
    labourDaysPerHa: 150,
    needsPloughing: true,
    yieldPerHa: { new: [120, 200, 300], some: [200, 300, 450], experienced: [300, 450, 600] },
    yieldUnit: "baskets (50kg)",
    plantingRule: "In the north the main season is the dry season (transplant Oct–Dec) with irrigation. Rainy-season tomato suffers more disease.",
    strengths: ["Highest earnings per hectare when it goes well", "Dry-season crop: uses irrigation land when other crops can't grow"],
    risks: ["Needs reliable water in the dry season", "Tuta absoluta ('tomato ebola') can wipe out a farm", "Perishable: prices crash at peak harvest", "High cost and labour"],
    soilNotes: "Needs well-drained soil, plenty of manure and steady water.",
  },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];
