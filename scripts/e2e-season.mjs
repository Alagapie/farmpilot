// Smoke test: onboard, plan, then calendar, poster and the Today advisor.
// Usage (dev server running): node scripts/e2e-season.mjs <outDir>
import { chromium } from "playwright-core";

const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  geolocation: { latitude: 11.1752, longitude: 7.5902, accuracy: 9 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));

await page.goto("http://localhost:3000");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: /on my farm now/ }).click();
await page.getByRole("button", { name: /Yes, this is my farm/ }).click({ timeout: 90_000 });
await page.getByPlaceholder("e.g. Musa's farm").fill("Musa's farm");
await page.getByRole("button", { name: /Analyse my farm/ }).click();
await page.getByRole("button", { name: /Build my season plan/ }).click({ timeout: 90_000 });

await page.getByRole("button", { name: /Mostly my family/ }).click();
await page.screenshot({ path: `${out}/p1-questions.png`, fullPage: true });
const t = Date.now();
await page.getByRole("button", { name: /Build my season plan/ }).click();
await page.getByText("Building your season plan").waitFor();
await page.waitForTimeout(15_000);
await page.screenshot({ path: `${out}/p2-building.png` });
await page.getByText("Your season plan · by Muse Wonder").waitFor({ timeout: 300_000 });
console.log(`plan built in ${((Date.now() - t) / 1000).toFixed(0)}s`);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/p3-plan.png`, fullPage: true });
// Calendar, poster and the advisor with the date simulator.
await page.getByRole("button", { name: "Calendar" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/s1-calendar.png` });
await page.getByRole("button", { name: /Create my season poster/ }).click();
await page.getByAltText(/Season poster/).waitFor({ timeout: 180_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/s2-poster.png`, fullPage: true });
await page.getByRole("button", { name: "Today", exact: true }).first().click();
await page.getByText("Morning briefing").waitFor();
await page.getByText("Reading your tasks").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
await page.screenshot({ path: `${out}/s3-today.png`, fullPage: true });
await page.getByRole("button", { name: /Planting ·/ }).first().click();
await page.waitForTimeout(1200);
await page.getByText("Reading your tasks").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
await page.screenshot({ path: `${out}/s4-planting.png`, fullPage: true });
await page.getByRole("button", { name: /Fertilizer ·/ }).first().click();
await page.waitForTimeout(1200);
await page.getByText("Reading your tasks").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
await page.screenshot({ path: `${out}/s5-fertilizer.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
console.log("mobile page width", await page.evaluate(() => document.documentElement.scrollWidth), "(viewport 390)");
await page.screenshot({ path: `${out}/p4-plan-mobile.png`, fullPage: true });
await browser.close();
console.log("done");
