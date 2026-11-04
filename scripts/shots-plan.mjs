// Screenshot each tab of the season plan for a saved farm.
// Usage (dev server running): node scripts/shots-plan.mjs <outDir> <farm.json> [width]
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [out, farmPath, width = "1280"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: Number(width), height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await page.evaluate((farm) => localStorage.setItem("farmpilot.farm.v2", farm), readFileSync(farmPath, "utf8"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Season plan" }).first().click();
await page.getByText("Your season plan · by Muse Wonder").waitFor({ timeout: 60_000 });
for (const tab of ["Overview", "Crops & shopping list", "Money", "Compare crops", "Prices"]) {
  await page.getByRole("button", { name: tab, exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/plan-${width}-${tab.split(" ")[0].toLowerCase()}.png`, fullPage: true });
}
console.log("page width", await page.evaluate(() => document.documentElement.scrollWidth));
await browser.close();
