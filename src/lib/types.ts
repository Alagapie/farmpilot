export type Confidence = "high" | "moderate" | "low";

/** One soil property: best estimate plus its 90% prediction range. */
export interface SoilValue {
  value: number;
  low: number;
  high: number;
  confidence: Confidence;
  source: "satellite" | "lab";
}

export interface Soil {
  ph: SoilValue | null;
  organicCarbon: SoilValue | null; // g/kg
  nitrogen: SoilValue | null; // g/kg
  clay: SoilValue | null; // %
  sand: SoilValue | null; // %
  cec: SoilValue | null; // cmol(c)/kg
  texture: string;
}

/** Results a farmer copies from a laboratory soil test report. */
export interface LabSoil {
  ph?: number;
  organicCarbonPct?: number; // % (lab reports use percent; 1% = 10 g/kg)
  nitrogenPct?: number; // %
  testedOn?: string;
}

export interface MonthClimate {
  month: string;
  rainMm: number;
  tMax: number;
  tMin: number;
}

export interface Climate {
  annualRainMm: number;
  months: MonthClimate[];
  rainyMonths: string[]; // months with >= 75mm on average
  period: string; // years the averages cover, e.g. "2001–2025"
  onsetMonth: string | null;
  cessationMonth: string | null;
}

export interface ForecastDay {
  date: string;
  rainMm: number;
  rainChance: number;
  tMax: number;
  tMin: number;
  windKmh: number;
}

export interface Place {
  village: string | null;
  lga: string | null;
  state: string | null;
  country: string | null;
  label: string;
}

export interface FarmData {
  place: Place;
  zone: string;
  soil: Soil | null;
  climate: Climate | null;
  forecast: ForecastDay[];
  forecastFetchedAt: string | null;
}

export interface FarmSummary {
  headline: string;
  points: { kind: "good" | "warning" | "tip" | "weather"; text: string }[];
}

export interface Farm {
  plan?: import("./plan").PlanResult;
  id: string;
  createdAt: string;
  name: string;
  lat: number;
  lon: number;
  hectares: number;
  hectaresSource: "sam" | "walk" | "manual";
  polygon: [number, number][];
  budgetNaira: number;
  experience: "new" | "some" | "experienced";
  goal: "sell" | "food" | "both";
  interests: string[];
  data: FarmData;
  summary?: FarmSummary;
  labSoil?: LabSoil;
}
