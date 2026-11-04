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
  | "manure"
  | "inoculant"
  | "seed_maize"
  | "seed_rice"
  | "seed_soybean"
  | "seed_sorghum"
  | "stems_cassava"
  | "seed_tomato"
  | "herbicide"
  | "insecticide"
  | "fungicide"
  | "ploughing"
  | "labour_day"
  | "petrol"
  | "empty_bag"
  | "hermetic_bag"
  | "basket"
  | "transport_bag"
  | "crop_maize"
  | "crop_rice"
  | "crop_soybean"
  | "crop_sorghum"
  | "crop_cassava"
  | "crop_tomato";

export type CostCategory = "Seed & planting material" | "Fertilizer & soil" | "Crop protection" | "Land & labour" | "Water" | "Harvest & selling";

export interface InputLine {
  item: PriceKey;
  label: string;
  perHa: number; // in the price sheet's unit
  when: string;
  category: CostCategory;
  /** Nitrogen top-dressing is reduced when the soil already has nitrogen. */
  nitrogen?: boolean;
  note?: string;
}

export type Level3 = "low" | "medium" | "high";

export interface Crop {
  id: CropId;
  name: string;
  /** Agro-ecological zones where the crop does well in the main rainy season. */
  zones: { good: string[]; possible: string[] };
  minRainMm: number;
  growingDays: [number, number]; // from sowing or transplanting to harvest
  /** Months the land is occupied, for fair comparison between crops. */
  monthsOnLand: number;
  /** Raised in a nursery first, then transplanted. */
  nurseryDays?: number;
  varieties: { name: string; note: string }[];
  spacing: string;
  plantsPerHa: string;
  seedNote: string;
  inputs: InputLine[];
  labourDaysPerHa: number;
  needsPloughing: boolean;
  /** Yield in the price sheet's crop unit (100kg bags, tonnes for cassava, 50kg baskets for tomato). */
  yieldPerHa: Record<"new" | "some" | "experienced", [number, number, number]>; // [low, expected, high]
  yieldUnit: string;
  /** Share of the harvest typically lost to pests, spoilage and handling before sale. */
  postHarvestLoss: number;
  /** Packaging bought per unit of harvest (e.g. one empty 100kg bag per bag of grain). */
  packaging?: { item: PriceKey; perUnit: number; label: string };
  /** How many "100kg bag" transport units one unit of harvest counts as. */
  transportPerUnit: number;
  /** Condition the farm must meet, if any, shown as a "conditional fit". */
  condition?: string;
  plantingRule: string;
  risk: { production: Level3; market: Level3; capital: Level3 };
  strengths: string[];
  risks: string[];
  soilNotes: string;
}

const ALL_SAVANNA = ["Sudan Savanna", "Northern Guinea Savanna", "Southern Guinea Savanna"];
const GRAIN_BAG = { item: "empty_bag" as const, perUnit: 1, label: "Empty 100kg bags for the harvest" };

export const CROPS: Record<CropId, Crop> = {
  maize: {
    id: "maize",
    name: "Maize",
    zones: { good: ["Northern Guinea Savanna", "Southern Guinea Savanna", "Derived Savanna"], possible: ["Sudan Savanna", "Humid Rainforest"] },
    minRainMm: 600,
    growingDays: [90, 120],
    monthsOnLand: 4,
    varieties: [
      { name: "SAMMAZ 15", note: "Open-pollinated, ~110 days, tolerant of striga; seed can be saved" },
      { name: "SAMMAZ 52 / 53", note: "Extra-early (80–90 days) for short or uncertain seasons" },
      { name: "Oba Super 9 (hybrid)", note: "Higher yield with good fertilizer; buy new seed every season" },
    ],
    spacing: "75 cm between ridges × 25 cm between plants, 1 seed per hole",
    plantsPerHa: "about 53,000",
    seedNote: "53,000 plants per hectare at about 300 seeds per kg, plus extra for gaps ≈ 20–25 kg.",
    inputs: [
      { item: "seed_maize", label: "Improved maize seed (kg)", perHa: 25, when: "At planting", category: "Seed & planting material" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 4, when: "1–2 weeks after planting", category: "Fertilizer & soil" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "5–6 weeks after planting (knee high)", category: "Fertilizer & soil", nitrogen: true },
      { item: "herbicide", label: "Pre-emergence herbicide (litres)", perHa: 3, when: "Within 2 days of planting", category: "Crop protection", note: "Follow the label rate; wear gloves and a mask." },
      { item: "insecticide", label: "Insecticide for fall armyworm (litres)", perHa: 1, when: "Only if scouting finds armyworm damage", category: "Crop protection", note: "Scout twice a week; spray only above the damage threshold." },
    ],
    labourDaysPerHa: 45,
    needsPloughing: true,
    yieldPerHa: { new: [10, 18, 25], some: [15, 25, 35], experienced: [25, 35, 45] },
    yieldUnit: "bags of grain (100kg)",
    postHarvestLoss: 0.1,
    packaging: GRAIN_BAG,
    transportPerUnit: 1,
    plantingRule: "Plant once the rains are steady: about 3 rains of 20mm or more within 2 weeks, with moist soil to a hand's depth.",
    risk: { production: "medium", market: "medium", capital: "medium" },
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
    monthsOnLand: 5,
    varieties: [
      { name: "FARO 44 (SIPI)", note: "Popular lowland/fadama rice, ~110–120 days, long grain" },
      { name: "FARO 66 / 67", note: "Tolerate short flooding in low-lying fields" },
      { name: "NERICA 1 / 2", note: "Upland rice for fields that don't flood (needs well-spread rain)" },
    ],
    spacing: "20 cm × 20 cm when transplanting, or drilled in rows 20–25 cm apart",
    plantsPerHa: "about 250,000 hills",
    seedNote: "Direct seeding uses 60–80 kg per hectare; transplanting from a nursery uses about 40–50 kg.",
    inputs: [
      { item: "seed_rice", label: "Certified rice seed (kg)", perHa: 60, when: "Nursery or direct seeding", category: "Seed & planting material" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 4, when: "At transplanting / 2 weeks after sowing", category: "Fertilizer & soil" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "Split: tillering and panicle start", category: "Fertilizer & soil", nitrogen: true },
      { item: "herbicide", label: "Rice herbicide (litres)", perHa: 4, when: "Early weed control", category: "Crop protection", note: "Use a rice-selective herbicide at the label rate." },
    ],
    labourDaysPerHa: 80,
    needsPloughing: true,
    yieldPerHa: { new: [12, 20, 28], some: [18, 28, 38], experienced: [28, 38, 50] },
    yieldUnit: "bags of paddy (100kg)",
    postHarvestLoss: 0.1,
    packaging: GRAIN_BAG,
    transportPerUnit: 1,
    condition: "Only if your field is low-lying or fadama land that holds water, or you can irrigate it.",
    plantingRule: "Plant when the field can hold water: in fadama after the first heavy rains, or upland only where rain is reliable for 4 months.",
    risk: { production: "high", market: "medium", capital: "high" },
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
    monthsOnLand: 4,
    varieties: [
      { name: "TGX 1951-3F", note: "Medium maturity (~100 days), good yield, rust tolerant" },
      { name: "TGX 1835-10E", note: "Early (~90 days), for shorter seasons" },
      { name: "TGX 1448-2E", note: "Widely grown, high yield, ~110 days" },
    ],
    spacing: "75 cm between ridges, 5–10 cm between plants (drilled)",
    plantsPerHa: "about 250,000–300,000",
    seedNote: "About 250,000 plants per hectare at roughly 6,000 seeds per kg, allowing for lower germination ≈ 60 kg.",
    inputs: [
      { item: "seed_soybean", label: "Improved soybean seed (kg)", perHa: 60, when: "At planting", category: "Seed & planting material" },
      { item: "inoculant", label: "Rhizobium inoculant (e.g. NoduMax, 100g sachets)", perHa: 4, when: "Mix with seed just before planting", category: "Seed & planting material", note: "One sachet treats about 15 kg of seed. Keep it out of the sun." },
      { item: "ssp", label: "Single super phosphate (50kg bags)", perHa: 2, when: "At planting", category: "Fertilizer & soil" },
      { item: "herbicide", label: "Pre-emergence herbicide (litres)", perHa: 3, when: "Within 2 days of planting", category: "Crop protection", note: "Follow the label rate; wear gloves and a mask." },
    ],
    labourDaysPerHa: 40,
    needsPloughing: true,
    yieldPerHa: { new: [6, 10, 14], some: [8, 13, 18], experienced: [12, 18, 24] },
    yieldUnit: "bags of grain (100kg)",
    postHarvestLoss: 0.08,
    packaging: GRAIN_BAG,
    transportPerUnit: 1,
    plantingRule: "Plant mid June to mid July in the Guinea Savanna, after the rains are steady, so pods dry after the rains stop.",
    risk: { production: "medium", market: "medium", capital: "medium" },
    strengths: [
      "Can fix its own nitrogen when nodules form well (inoculant helps), and leaves some for the next crop if residues stay on the field",
      "Can reduce striga in the next maize crop",
      "Strong demand from feed mills and processors",
    ],
    risks: ["Pods shatter if harvest is late", "Poor nodulation without inoculant on new soybean land", "Lower yield per hectare than cereals"],
    soilNotes: "Suited to low-nitrogen soil when well nodulated; it still needs phosphorus (SSP). It improves the nitrogen balance but does not fix a nitrogen shortage on its own.",
  },
  sorghum: {
    id: "sorghum",
    name: "Sorghum",
    zones: { good: ALL_SAVANNA, possible: ["Derived Savanna"] },
    minRainMm: 450,
    growingDays: [100, 130],
    monthsOnLand: 4,
    varieties: [
      { name: "SAMSORG 45 (CSR-01)", note: "Improved, ~110 days, good grain quality" },
      { name: "SAMSORG 46 (ICSV 400)", note: "High yield, tolerant of striga" },
      { name: "Improved Kaura", note: "Familiar local type, later maturing" },
    ],
    spacing: "75 cm between ridges × 30 cm between hills, thin to 2 plants",
    plantsPerHa: "about 90,000",
    seedNote: "About 44,000 hills per hectare, sown 4–5 seeds per hill and thinned to 2 ≈ 8–10 kg.",
    inputs: [
      { item: "seed_sorghum", label: "Improved sorghum seed (kg)", perHa: 10, when: "At planting", category: "Seed & planting material" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 2, when: "2 weeks after planting", category: "Fertilizer & soil" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 1, when: "5–6 weeks after planting", category: "Fertilizer & soil", nitrogen: true },
    ],
    labourDaysPerHa: 40,
    needsPloughing: true,
    yieldPerHa: { new: [8, 12, 16], some: [10, 16, 22], experienced: [15, 22, 30] },
    yieldUnit: "bags of grain (100kg)",
    postHarvestLoss: 0.1,
    packaging: GRAIN_BAG,
    transportPerUnit: 1,
    plantingRule: "Plant with the first steady rains: about 3 rains of 20mm or more within 2 weeks.",
    risk: { production: "low", market: "medium", capital: "low" },
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
    monthsOnLand: 12,
    varieties: [
      { name: "TME 419", note: "High yield, good for garri and fufu, ~12 months" },
      { name: "TMS 98/0581", note: "High dry matter, disease tolerant" },
      { name: "UMUCASS 36 / 38", note: "Yellow (pro-vitamin A) roots" },
    ],
    spacing: "1 m × 1 m (10,000 cuttings per hectare), cuttings 20–25 cm long",
    plantsPerHa: "10,000",
    seedNote: "10,000 cuttings per hectare; a bundle of ~50 stems gives about 200–250 cuttings ≈ 45–50 bundles.",
    inputs: [
      { item: "stems_cassava", label: "Cassava stem bundles", perHa: 50, when: "At planting", category: "Seed & planting material" },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 6, when: "6–8 weeks after planting", category: "Fertilizer & soil" },
      { item: "herbicide", label: "Herbicide (litres)", perHa: 3, when: "Before and soon after planting", category: "Crop protection", note: "Follow the label rate; wear gloves and a mask." },
    ],
    labourDaysPerHa: 70,
    needsPloughing: true,
    yieldPerHa: { new: [8, 12, 16], some: [10, 15, 20], experienced: [15, 22, 30] },
    yieldUnit: "tonnes of fresh roots",
    postHarvestLoss: 0.05,
    transportPerUnit: 10,
    plantingRule: "Plant at the start of the rains once the soil is moist; harvest about 12 months later.",
    risk: { production: "low", market: "high", capital: "medium" },
    strengths: ["Very hardy; survives poor soil and dry spells", "Can be harvested when prices are good", "Food security"],
    risks: ["Money is locked in for ~12 months", "Bulky and heavy to transport", "Prices vary widely between processors"],
    soilNotes: "Tolerates acidic, low-fertility soils better than most crops.",
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    zones: { good: ALL_SAVANNA, possible: ["Derived Savanna"] },
    minRainMm: 0,
    growingDays: [90, 110],
    monthsOnLand: 4,
    nurseryDays: 28,
    varieties: [
      { name: "UC82B", note: "Determinate (no staking needed), firm fruit, ~90–100 days from transplanting" },
      { name: "Roma VF", note: "Determinate, popular processing/fresh type, ~90 days from transplanting" },
      { name: "Hybrid (e.g. Padma F1)", note: "Higher yield and disease tolerance; costly seed" },
    ],
    spacing: "60 cm between rows × 50 cm between plants (raised in a nursery for 4 weeks first)",
    plantsPerHa: "about 33,000",
    seedNote: "33,000 plants per hectare at ~300 seeds per gram, allowing ~60% nursery success ≈ 185–200 g (20 packs of 10g).",
    inputs: [
      { item: "seed_tomato", label: "Tomato seed (10g packs)", perHa: 20, when: "Nursery, 4 weeks before transplanting", category: "Seed & planting material" },
      { item: "manure", label: "Poultry or cow manure (50kg bags)", perHa: 100, when: "Work into beds before transplanting", category: "Fertilizer & soil", note: "About 5 tonnes per hectare." },
      { item: "npk_15_15_15", label: "NPK 15-15-15 (50kg bags)", perHa: 8, when: "Split: transplanting and flowering", category: "Fertilizer & soil" },
      { item: "urea", label: "Urea (50kg bags)", perHa: 2, when: "At flowering", category: "Fertilizer & soil", nitrogen: true },
      { item: "insecticide", label: "Insecticide for Tuta absoluta (tomato leaf miner) (litres)", perHa: 4, when: "After scouting finds mines in leaves or holes in fruit", category: "Crop protection", note: "Use pheromone traps to scout. Rotate insecticide groups to avoid resistance; respect the pre-harvest interval on the label." },
      { item: "fungicide", label: "Fungicide for early/late blight (kg)", perHa: 4, when: "Protectively in humid weeks", category: "Crop protection", note: "Follow the label rate and pre-harvest interval; wear protective clothing." },
      { item: "petrol", label: "Petrol for the irrigation pump (litres)", perHa: 250, when: "Irrigate 2 times a week through the season", category: "Water", note: "Estimate for a small petrol pump; depends on water source and distance." },
    ],
    labourDaysPerHa: 150,
    needsPloughing: true,
    yieldPerHa: { new: [120, 200, 300], some: [200, 300, 450], experienced: [300, 450, 600] },
    yieldUnit: "baskets (50kg)",
    postHarvestLoss: 0.2,
    packaging: { item: "basket", perUnit: 1, label: "Baskets or crates for the harvest" },
    transportPerUnit: 0.5,
    condition: "Only with reliable dry-season water (river, borehole, dam or fadama).",
    plantingRule: "In the north the main season is the dry season with irrigation: start the nursery in Oct–Nov and transplant 4 weeks later.",
    risk: { production: "high", market: "high", capital: "high" },
    strengths: ["Highest earnings per hectare when it goes well", "Dry-season crop: uses irrigation land when other crops can't grow"],
    risks: [
      "Needs reliable water in the dry season",
      "Tuta absoluta (tomato leaf miner) can destroy a crop quickly",
      "Perishable: prices crash at peak harvest",
      "High cost and labour",
    ],
    soilNotes: "Needs well-drained soil, plenty of manure and steady water.",
  },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];
