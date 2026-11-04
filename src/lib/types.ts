export interface Soil {
  ph: number | null;
  organicCarbon: number | null; // g/kg
  nitrogen: number | null; // g/kg
  clay: number | null; // %
  sand: number | null; // %
  cec: number | null; // cmol(c)/kg
  texture: string;
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
}

export interface Farm {
  id: string;
  createdAt: string;
  name: string;
  lat: number;
  lon: number;
  hectares: number;
  hectaresSource: "sam" | "manual";
  polygon: [number, number][];
  budgetNaira: number;
  experience: "new" | "some" | "experienced";
  goal: "sell" | "food" | "both";
  interests: string[];
  data: FarmData;
}
