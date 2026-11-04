import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PriceKey } from "@/data/crops";
import { meta, MODELS } from "./meta";

export type PriceType = "farm-gate" | "wholesale" | "retail" | "dealer" | "service";

export interface PriceItem {
  key: PriceKey;
  label: string;
  unit: string;
  /** What kind of price we want: farmers sell at farm gate and buy inputs from dealers. */
  want: PriceType;
}

export interface Price extends PriceItem {
  found: boolean;
  typical: number; // naira per unit
  low: number;
  high: number;
  sourceTitle: string;
  sourceUrl: string;
  sourceDate: string;
  note: string;
  confidence: "high" | "medium" | "low";
  /** The exact product or market the price is for (e.g. "SAMSORG 17, 5kg pack"). */
  matchedProduct: string;
  priceType: PriceType;
  /** Set when the farmer typed their own local price. */
  edited?: boolean;
}

export interface PriceSheet {
  state: string;
  fetchedAt: string;
  prices: Price[];
}

// Grouped so each web search stays focused; the groups run in parallel.
const GROUPS: PriceItem[][] = [
  [
    { key: "npk_15_15_15", label: "NPK 15-15-15 fertilizer", unit: "50kg bag", want: "dealer" },
    { key: "urea", label: "Urea fertilizer", unit: "50kg bag", want: "dealer" },
    { key: "ssp", label: "Single super phosphate (SSP) fertilizer", unit: "50kg bag", want: "dealer" },
    { key: "herbicide", label: "Herbicide (e.g. glyphosate or atrazine-based)", unit: "1 litre", want: "dealer" },
    { key: "insecticide", label: "Insecticide (e.g. emamectin benzoate or lambda-cyhalothrin)", unit: "1 litre", want: "dealer" },
    { key: "fungicide", label: "Fungicide (e.g. mancozeb)", unit: "1 kg", want: "dealer" },
  ],
  [
    { key: "seed_maize", label: "Improved maize seed: SAMMAZ 15, SAMMAZ 52/53 or Oba Super 9", unit: "1 kg", want: "dealer" },
    { key: "seed_rice", label: "Certified rice seed: FARO 44, FARO 66/67 or NERICA", unit: "1 kg", want: "dealer" },
    { key: "seed_soybean", label: "Improved soybean seed: TGX 1951-3F, TGX 1835-10E or TGX 1448-2E", unit: "1 kg", want: "dealer" },
    { key: "seed_sorghum", label: "Improved sorghum seed: SAMSORG 45, SAMSORG 46 or Improved Kaura", unit: "1 kg", want: "dealer" },
    { key: "stems_cassava", label: "Cassava stems: TME 419, TMS 98/0581 or UMUCASS", unit: "bundle of about 50 stems", want: "dealer" },
    { key: "seed_tomato", label: "Tomato seed: UC82B, Roma VF or a hybrid such as Padma F1", unit: "10g pack", want: "dealer" },
    { key: "inoculant", label: "Soybean rhizobium inoculant (e.g. NoduMax)", unit: "100g sachet", want: "dealer" },
  ],
  [
    { key: "ploughing", label: "Tractor ploughing and harrowing", unit: "1 hectare", want: "service" },
    { key: "labour_day", label: "Hired farm labour", unit: "1 person-day", want: "service" },
    { key: "petrol", label: "Petrol (PMS) at the pump", unit: "1 litre", want: "retail" },
    { key: "manure", label: "Poultry or cow manure", unit: "50kg bag", want: "dealer" },
    { key: "empty_bag", label: "Empty 100kg polypropylene grain bag", unit: "1 bag", want: "dealer" },
    { key: "basket", label: "Tomato basket or plastic crate (about 50kg)", unit: "1 basket", want: "dealer" },
    { key: "transport_bag", label: "Transport of produce from village to the nearest market", unit: "100kg bag", want: "service" },
  ],
  [
    { key: "crop_maize", label: "Maize grain", unit: "100kg bag", want: "farm-gate" },
    { key: "crop_rice", label: "Paddy rice (unmilled)", unit: "100kg bag", want: "farm-gate" },
    { key: "crop_soybean", label: "Soybean grain", unit: "100kg bag", want: "farm-gate" },
    { key: "crop_sorghum", label: "Sorghum grain", unit: "100kg bag", want: "farm-gate" },
    { key: "crop_cassava", label: "Fresh cassava roots", unit: "1 tonne", want: "farm-gate" },
    { key: "crop_tomato", label: "Fresh tomato", unit: "50kg basket", want: "farm-gate" },
  ],
];

export const PRICE_ITEMS: PriceItem[] = GROUPS.flat();

const SCHEMA = {
  type: "object",
  properties: {
    prices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          found: { type: "boolean" },
          typical: { type: "number" },
          low: { type: "number" },
          high: { type: "number" },
          sourceTitle: { type: "string" },
          sourceUrl: { type: "string" },
          sourceDate: { type: "string" },
          note: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          matchedProduct: { type: "string" },
          priceType: { type: "string", enum: ["farm-gate", "wholesale", "retail", "dealer", "service"] },
        },
        required: ["key", "found", "typical", "low", "high", "sourceTitle", "sourceUrl", "sourceDate", "note", "confidence", "matchedProduct", "priceType"],
        additionalProperties: false,
      },
    },
  },
  required: ["prices"],
  additionalProperties: false,
};

async function searchGroup(items: PriceItem[], state: string): Promise<Price[]> {
  const today = new Date().toISOString().slice(0, 10);
  const list = items.map((i) => `- ${i.key}: ${i.label}, price per ${i.unit} (want: ${i.want} price)`).join("\n");
  const res = await meta().responses.create({
    model: MODELS.spark,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "developer",
        content: `You research current farm prices in Nigeria for smallholder farmers. Today is ${today}.
Use web search. Prefer prices from ${state} State or nearby northern markets; otherwise use national Nigerian prices.
Prices in Nigeria swing a lot between seasons, so be careful:
- Prefer dated market surveys and reports from established outlets (Daily Trust, BusinessDay, Punch, Premium Times, Guardian, Nairametrics, The Gazette, Vanguard) or named markets (Dawanau, Saminaka, Giwa, Zaria, Mile 12), and input prices from agro-dealer listings.
- Prefer the last 3 months; never use anything older than 12 months.
- Cross-check each price with at least 2 sources. Treat "price in Nigeria" SEO listing sites as weak unless they agree with a news report.
- confidence: "high" if 2+ recent credible sources agree, "medium" if one credible recent source, "low" otherwise.
- Convert every price to the unit asked for and explain the conversion and any disagreement between sources in "note".
- matchedProduct: the exact product, variety, pack size or market the price is for. For seed, say which variety you actually priced; if it is not one of the varieties listed, say so.
- priceType: what the source price actually is. For crops we want the farm-gate price (what a buyer pays the farmer in the village). If you only find market wholesale prices, report priceType "wholesale" and say so in note; do not adjust it yourself.
If you cannot find a credible current price, set found=false and give your best estimate with typical/low/high and explain in note.
sourceUrl must be a real page you found; sourceDate is its publication or listing date (YYYY-MM or YYYY-MM-DD).
Return one entry per key, using exactly the keys given.`,
      },
      { role: "user", content: `Find the current price in naira for each item:\n${list}` },
    ],
    text: { format: { type: "json_schema", name: "price_sheet", schema: SCHEMA, strict: true } },
  });
  // The model narrates between searches; the structured answer is the last message.
  const messages = res.output.filter((o) => o.type === "message");
  const last = messages.at(-1);
  const text = last?.type === "message" ? last.content.map((c) => (c.type === "output_text" ? c.text : "")).join("") : "";
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { prices: Omit<Price, "label" | "unit">[] };
  return items.map((item) => {
    const p = parsed.prices.find((x) => x.key === item.key);
    return p
      ? { ...item, ...p, key: item.key }
      : { ...item, found: false, typical: 0, low: 0, high: 0, sourceTitle: "", sourceUrl: "", sourceDate: "", note: "Not returned by search", confidence: "low" as const, matchedProduct: "", priceType: item.want };
  });
}

// Price sheets are cached per state for a day, on disk so restarts and demos stay fast.
const CACHE_DIR = path.join(process.cwd(), ".cache", "prices");
const DAY = 24 * 3_600_000;
const inflight = new Map<string, Promise<PriceSheet>>();

const cacheFile = (state: string) => path.join(CACHE_DIR, `${state.toLowerCase().replace(/[^a-z]+/g, "-")}.json`);

async function readCache(state: string): Promise<PriceSheet | null> {
  try {
    return JSON.parse(await readFile(cacheFile(state), "utf8")) as PriceSheet;
  } catch {
    return null;
  }
}

export async function getPriceSheet(state: string, { fresh = false } = {}): Promise<PriceSheet> {
  const cached = await readCache(state);
  // Refetch when the cached sheet predates newly added items or fields.
  const complete = cached != null && PRICE_ITEMS.every((i) => cached.prices.some((p) => p.key === i.key && "matchedProduct" in p));
  if (cached && complete && !fresh && Date.now() - new Date(cached.fetchedAt).getTime() < DAY) return cached;

  const key = state.toLowerCase();
  if (!inflight.has(key)) {
    inflight.set(
      key,
      (async () => {
        try {
          const groups = await Promise.all(GROUPS.map((g) => searchGroup(g, state)));
          const sheet: PriceSheet = { state, fetchedAt: new Date().toISOString(), prices: groups.flat() };
          await mkdir(CACHE_DIR, { recursive: true });
          await writeFile(cacheFile(state), JSON.stringify(sheet, null, 2));
          return sheet;
        } catch (err) {
          // A stale sheet beats no sheet: fall back to the last one we saved.
          if (cached) return cached;
          throw err;
        } finally {
          inflight.delete(key);
        }
      })(),
    );
  }
  return inflight.get(key)!;
}
