// Smoke test: Ask FarmPilot by text and by voice (a WAV file stands in for the microphone).
// Usage (dev server running): node scripts/e2e-ask.mjs <outDir> <farm.json> <question.wav>
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [out, farmPath, wavPath] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wavPath}`],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));

// Start from a saved farm with a plan, so the test doesn't rebuild one.
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await page.evaluate((farm) => localStorage.setItem("farmpilot.farm.v2", farm), readFileSync(farmPath, "utf8"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Ask FarmPilot" }).click();

await page.getByRole("button", { name: /What should I do on my farm this week/ }).click();
await page.getByText("FarmPilot is checking").waitFor();
await page.getByText("FarmPilot is checking").waitFor({ state: "detached", timeout: 120_000 });

await page.getByTitle("Ask with your voice").click();
await page.waitForTimeout(6000); // the fake microphone plays the question
await page.getByTitle("Stop and send").click();
await page.getByText("FarmPilot is checking").waitFor({ timeout: 60_000 });
await page.getByText("FarmPilot is checking").waitFor({ state: "detached", timeout: 120_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/a1-ask.png`, fullPage: true });
console.log(await page.locator("p.bg-leaf-600").allInnerTexts());
await browser.close();
console.log("done");
