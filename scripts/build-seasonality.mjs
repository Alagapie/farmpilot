// Build seasonal price indices for FarmPilot's crops from WFP market prices.
//
// Input: the WFP "Nigeria - Food Prices" CSV from HDX (CC BY-IGO):
//   https://data.humdata.org/dataset/wfp-food-prices-for-nigeria
// Usage: node scripts/build-seasonality.mjs <wfp_food_prices_nga.csv>
// Output: src/data/seasonality.json
//
// Method: for every market × commodity series, prices are divided by a centred
// 12-month moving average (ratio-to-moving-average). That removes inflation and
// long-run trends, leaving how prices typically move through the year. Monthly
// ratios are averaged across markets and years and normalised to a mean of 1.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Pass the path to wfp_food_prices_nga.csv");

const NORTH = new Set(["Adamawa", "Bauchi", "Borno", "Gombe", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Niger", "Plateau", "Sokoto", "Taraba", "Yobe", "Zamfara", "Kwara", "Nasarawa", "Benue", "Kogi", "Federal Capital Territory", "FCT"]);

// FarmPilot crop → WFP commodity names (first match wins per row).
const CROPS = {
  maize: /^maize/i,
  sorghum: /^sorghum/i,
  rice: /^rice/i,
  soybean: /soy/i,
  cassava: /^(gari|cassava)/i,
  tomato: /tomato/i,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

const rows = parseCsv(readFileSync(file, "utf8"));
const header = rows[0];
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Column "${name}" not found. Columns: ${header.join(", ")}`);
  return i;
};
const [cDate, cAdmin1, cMarket, cCommodity, cUnit, cPriceType, cPrice] = ["date", "admin1", "market", "commodity", "unit", "pricetype", "price"].map(col);

// series[region][crop][market|commodity|unit|type] = Map(yyyy-mm → price)
const series = { north: {}, south: {} };
let minDate = "9999";
let maxDate = "0000";
for (const r of rows.slice(1)) {
  if (!r[cDate] || r[cDate].startsWith("#")) continue; // HXL tag row
  const price = Number(r[cPrice]);
  if (!(price > 0)) continue;
  const crop = Object.keys(CROPS).find((k) => CROPS[k].test(r[cCommodity]));
  if (!crop) continue;
  const region = NORTH.has(r[cAdmin1]) ? "north" : "south";
  const ym = r[cDate].slice(0, 7);
  if (ym < minDate) minDate = ym;
  if (ym > maxDate) maxDate = ym;
  const key = [r[cMarket], r[cCommodity], r[cUnit], r[cPriceType]].join("|");
  ((series[region][crop] ??= {})[key] ??= new Map()).set(ym, price);
}

const monthIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

function seasonalIndex(seriesByKey) {
  const ratios = Array.from({ length: 12 }, () => []);
  let used = 0;
  const markets = new Set();
  for (const [key, points] of Object.entries(seriesByKey)) {
    const byIdx = new Map([...points].map(([ym, p]) => [monthIndex(ym), p]));
    let contributed = false;
    for (const [i, p] of byIdx) {
      // Centred 2×12 moving average needs 6 months either side.
      const window = [];
      for (let k = -6; k <= 6; k++) window.push(byIdx.get(i + k));
      if (window.some((v) => v == null)) continue;
      const cma = (window[0] / 2 + window.slice(1, 12).reduce((s, v) => s + v, 0) + window[12] / 2) / 12;
      ratios[i % 12].push(p / cma);
      contributed = true;
    }
    if (contributed) {
      used++;
      markets.add(key.split("|")[0]);
    }
  }
  if (ratios.some((m) => m.length < 3)) return null;
  // Median per month resists outliers; then normalise to a mean of 1.
  const median = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const raw = ratios.map(median);
  const mean = raw.reduce((s, v) => s + v, 0) / 12;
  return {
    index: raw.map((v) => Math.round((v / mean) * 1000) / 1000),
    observations: ratios.reduce((s, m) => s + m.length, 0),
    series: used,
    markets: markets.size,
  };
}

const out = { source: "WFP VAM market prices for Nigeria via HDX (CC BY-IGO)", sourceUrl: "https://data.humdata.org/dataset/wfp-food-prices-for-nigeria", period: `${minDate}–${maxDate}`, generatedAt: new Date().toISOString().slice(0, 10), regions: {} };
for (const region of ["north", "south"]) {
  out.regions[region] = {};
  for (const crop of Object.keys(CROPS)) {
    const s = series[region][crop];
    const result = s ? seasonalIndex(s) : null;
    if (result) out.regions[region][crop] = result;
    console.log(region.padEnd(5), crop.padEnd(8), result ? `${result.markets} markets, ${result.observations} obs: ${result.index.join(" ")}` : "not enough data");
  }
}
writeFileSync(new URL("../src/data/seasonality.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`\nWrote src/data/seasonality.json (${out.period})`);
