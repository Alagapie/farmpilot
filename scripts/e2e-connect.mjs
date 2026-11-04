// Smoke test: FarmPilot Connect from listing to booked shared truck, plus storage and equipment.
// Usage (dev server running): node scripts/e2e-connect.mjs <outDir> <farm.json> <crate photo>
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [out, farmPath, photoPath] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await page.evaluate((farm) => localStorage.setItem("farmpilot.farm.v2", farm), readFileSync(farmPath, "utf8"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Connect", exact: true }).click();
await page.getByText("What do you want to sell?").waitFor({ timeout: 60_000 });
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Reset demo" }).click();
await page.waitForTimeout(1500);

await page.getByPlaceholder(/I have 100 crates/).fill("I have 100 crates of tomatoes ready on Friday");
await page.getByRole("button", { name: /Fill in/ }).click();
await page.getByText(/Filled in from what you said/).waitFor({ timeout: 60_000 });
await page.locator('input[type="file"]').setInputFiles(photoPath);
await page.getByText(/^Grade [ABC]$/).waitFor({ timeout: 90_000 });
await page.screenshot({ path: `${out}/c1-listing.png`, fullPage: true });

await page.getByRole("button", { name: /Find me the best market/ }).click();
await page.getByText("Muse Spark", { exact: true }).waitFor({ timeout: 120_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/c2-deals.png`, fullPage: true });

await page.getByRole("button", { name: /Book · pay transport from the sale/ }).first().click();
await page.getByText("My shipments").waitFor({ timeout: 60_000 });
await page.getByRole("button", { name: /Demo: move to the next step/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/c3-shipment.png`, fullPage: true });

await page.getByRole("button", { name: "Shared storage" }).click();
await page.getByRole("button", { name: "Reserve space" }).first().click();
await page.getByText(/^Booked /).waitFor({ timeout: 30_000 });
await page.screenshot({ path: `${out}/c4-storage.png`, fullPage: true });

await page.getByRole("button", { name: "Shared equipment" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/c5-equipment.png`, fullPage: true });
await browser.close();
console.log("done");
