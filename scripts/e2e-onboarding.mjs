// Smoke test: walk the onboarding flow in headless Edge and save screenshots.
// Usage (dev server running): node scripts/e2e-onboarding.mjs <outDir>
import { chromium } from "playwright-core";

const out = process.argv[2] ?? ".";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));

await page.goto("http://localhost:3000");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector(".leaflet-container");
await page.screenshot({ path: `${out}/1-start.png` });

await page.getByRole("button", { name: "Try a demo farm" }).click();
await page.waitForTimeout(3500); // fly animation + tiles
await page.mouse.click(640, 400);
await page.getByText("SAM 3.1 is mapping").waitFor();
await page.getByText("This is my farm").waitFor({ timeout: 90_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/2-mapped.png` });

await page.getByText("This is my farm").click();
await page.getByPlaceholder("e.g. Musa's farm").fill("Musa's farm");
await page.screenshot({ path: `${out}/3-details.png`, fullPage: true });
await page.getByRole("button", { name: /Analyse my farm/ }).click();
await page.getByText("Soil health").waitFor({ timeout: 90_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/4-report.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/5-report-mobile.png`, fullPage: true });
await browser.close();
console.log("done");
