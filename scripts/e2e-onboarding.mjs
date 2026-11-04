// Smoke test: walk the onboarding flow in headless Edge with a faked GPS fix.
// Usage (dev server running): node scripts/e2e-onboarding.mjs <outDir>
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
await page.waitForSelector(".leaflet-container");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/1-start.png` });

await page.getByRole("button", { name: /on my farm now/ }).click();
await page.getByText("Is the green field your farm?").waitFor({ timeout: 90_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/2-confirm.png` });

// Walk mode: tap 4 corners on the map, as a desktop user would.
await page.getByRole("button", { name: /walk around your farm/i }).click();
for (const [x, y] of [[560, 330], [720, 330], [720, 450], [560, 450]]) await page.mouse.click(x, y);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/3-walk.png` });
await page.getByRole("button", { name: "Cancel" }).click();

// Back to SAM: tap a field again, then confirm.
await page.mouse.click(640, 400);
await page.getByText("Is the green field your farm?").waitFor({ timeout: 90_000 });
await page.getByRole("button", { name: /Yes, this is my farm/ }).click();
await page.getByPlaceholder("e.g. Musa's farm").fill("Musa's farm");
await page.getByRole("button", { name: /Analyse my farm/ }).click();
await page.getByText("Your soil", { exact: true }).waitFor({ timeout: 90_000 });
await page.getByText("Reading your farm and writing").waitFor({ state: "detached", timeout: 90_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/4-report.png`, fullPage: true });

// Lab results should replace the satellite estimates.
await page.getByRole("button", { name: "Enter lab results" }).click();
await page.getByPlaceholder("e.g. 5.8").fill("6.3");
await page.getByPlaceholder("e.g. 0.9").fill("1.2");
await page.getByRole("button", { name: "Use my lab results" }).click();
await page.getByText("Reading your farm and writing").waitFor({ state: "detached", timeout: 90_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/6-lab.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/5-report-mobile.png`, fullPage: true });
await browser.close();
console.log("done");
