// Record the full FarmPilot product demo in three sessions (each its own clip):
//   A: map the farm → report → season plan → calendar & poster → today → market
//   B: ask by voice
//   C: connect: sell together, shared storage, shared equipment
// Usage (production server running): node scripts/video/record-demo.mjs <outDir> <assetsDir> [A|B|C ...]
// assetsDir needs ask.wav, listing.wav and crate.jpg/webp (a crate of tomatoes).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createDirector } from "./director.mjs";

const [outDir, assets, ...which] = process.argv.slice(2);
const clips = which.length ? which : ["A", "B", "C"];
const BASE = process.env.DEMO_URL ?? "http://localhost:3001";
const VIEW = { width: 1440, height: 810 };
const FARM = { latitude: 11.1752, longitude: 7.5902, accuracy: 9 };
const farmFile = path.join(outDir, "demo-farm.json");
const crate = ["crate.jpg", "crate.webp", "crate.png"].map((f) => path.join(assets, f)).find(existsSync);

async function session(name, { audio } = {}) {
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
  if (audio) args.push(`--use-file-for-fake-audio-capture=${audio}`);
  const browser = await chromium.launch({ channel: "msedge", args });
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, geolocation: FARM, permissions: ["geolocation", "microphone"] });
  const d = await createDirector(context, name, outDir);
  d.page.on("pageerror", (e) => console.log(`  [${name}] page error: ${e.message}`));
  d.page.on("dialog", (dlg) => dlg.accept());
  return { browser, d, page: d.page };
}

const btn = (page, name, exact = false) => page.getByRole("button", { name, exact }).first();

/** Wait for something slow (AI or network), marking it so the edit speeds it up. */
async function waitFast(d, fn) {
  d.waitStart();
  try {
    await fn();
  } finally {
    d.waitEnd();
  }
}

async function loadSavedFarm(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((f) => localStorage.setItem("farmpilot.farm.v2", f), readFileSync(farmFile, "utf8"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(/Musa/).first().waitFor({ timeout: 60_000 });
}

// ------------------------------------------------------------------ clip A
async function clipA() {
  const { browser, d, page } = await session("A");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Your AI farming co-pilot").waitFor();
  await page.waitForTimeout(2500); // let map tiles settle before recording
  await d.start();
  await d.move(720, 650, 1);
  await d.pause(2500);

  // 01 Map the farm
  await d.chapter("01", "Map the farm", "Meta SAM 3.1");
  await d.click(btn(page, /on my farm now/));
  await waitFast(d, () => page.getByText("Is the green field your farm?").waitFor({ timeout: 120_000 }));
  await d.pause(2500);
  const yellow = page.locator("path.leaflet-interactive[stroke='#facc15']");
  if ((await yellow.count()) > 3) {
    await d.hover(yellow.nth(2));
    await d.pause(1500);
    await d.click(yellow.nth(2));
    await d.pause(1800);
    await d.click(page.locator("path.leaflet-interactive[stroke='#4ade80']").last());
    await d.pause(1200);
  }
  await d.click(btn(page, /walk around (your|my) farm/i));
  await d.pause(1200);
  for (const [x, y] of [[640, 330], [800, 320], [810, 450], [650, 460]]) {
    await d.move(x, y, 16);
    await page.mouse.down();
    await page.mouse.up();
    await d.pause(500);
  }
  await d.pause(2200);
  await d.click(btn(page, "Cancel", true));
  await d.pause(600);
  await page.mouse.move(720, 400);
  await d.click(page.locator(".leaflet-container"), { hold: 300 });
  await waitFast(d, () => page.getByText("Is the green field your farm?").waitFor({ timeout: 120_000 }));
  await d.pause(1500);
  await d.click(btn(page, /Yes, this is my farm/));

  // Farm details
  await page.getByText("Tell us about your farm").waitFor();
  await d.pause(800);
  await d.type(page.getByPlaceholder("e.g. Musa's farm"), "Musa's farm");
  await d.click(btn(page, "₦600,000", true));
  await d.click(btn(page, "A few seasons", true));
  await d.click(btn(page, "Sell for profit", true));
  await d.click(btn(page, "Maize", true));
  await d.click(btn(page, "Sorghum", true));
  await d.pause(700);
  await d.click(btn(page, /Analyse my farm/));

  // 02 Report
  await waitFast(d, async () => {
    await page.getByText("Your soil", { exact: true }).waitFor({ timeout: 120_000 });
    await page.getByText("Reading your farm and writing").waitFor({ state: "detached", timeout: 120_000 });
  });
  await d.chapter("02", "Your farm in plain words", "Muse Spark");
  await d.pause(4500);
  await d.scrollTo(page.getByText("When does it usually rain?"), 100);
  await d.pause(3500);
  await d.scrollTo(page.getByText("Your soil", { exact: true }), 90);
  await d.pause(3500);
  await d.scroll(520, 1400);
  await d.pause(3000);
  await d.scrollTo(page.getByText("Weather forecast", { exact: true }), 90);
  await d.pause(3000);

  // 03 Season plan
  await d.click(btn(page, /Build my season plan/));
  await page.getByText("Two quick questions before we plan").waitFor();
  await d.chapter("03", "Plan the season", "Muse Wonder");
  await d.pause(1500);
  await d.click(btn(page, /Mostly my family/));
  await d.pause(600);
  await d.click(btn(page, /Build my season plan/));
  await page.getByText("Building your season plan").waitFor();
  await d.pause(3000);
  await waitFast(d, () => page.getByText("Your season plan · by Muse Wonder").waitFor({ timeout: 300_000 }));
  await d.pause(5000);
  await d.click(page.getByRole("button", { name: /Show details/ }));
  await d.pause(3500);
  await d.click(page.getByRole("button", { name: /Hide/ }).first());
  await d.scrollTo(page.getByText("Your crops", { exact: true }), 120);
  await d.pause(3500);
  await d.scroll(450, 1200);
  await d.pause(2500);
  await d.click(btn(page, "Crops & shopping list", true));
  await d.pause(2500);
  await d.scrollTo(page.getByText("Shopping list", { exact: true }).first(), 110);
  await d.pause(3500);
  await d.scrollTo(page.getByText("Sales and margin", { exact: false }).first(), 110);
  await d.pause(3000);
  await d.click(btn(page, "Money", true));
  await d.pause(3500);
  await d.click(btn(page, "Compare crops", true));
  await d.pause(4500);
  await d.click(btn(page, "Prices", true));
  await d.pause(3500);
  await d.scroll(500, 1300);
  await d.pause(2000);

  // 04 Calendar & poster
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await d.pause(800);
  await d.click(btn(page, "Calendar", true));
  await d.chapter("04", "Season calendar and poster", "Muse Image");
  await d.pause(2500);
  await d.scroll(700, 1800);
  await d.pause(1500);
  await d.click(btn(page, /Create my season poster/));
  await waitFast(d, () => page.getByAltText(/Season poster/).waitFor({ timeout: 240_000 }));
  await d.pause(800);
  await d.scrollTo(page.getByAltText(/Season poster/), 140);
  await d.pause(4500);

  // 05 Today
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await d.click(btn(page, "Today", true));
  await d.chapter("05", "Daily, weather-checked advice", "Muse Spark");
  await waitFast(d, () => page.getByText("Reading your tasks").waitFor({ state: "detached", timeout: 90_000 }).catch(() => {}));
  await d.pause(3500);
  for (const name of [/Planting ·/, /Fertilizer ·/, /Harvest ·/]) {
    const chip = page.getByRole("button", { name }).first();
    if (!(await chip.count())) continue;
    await d.click(chip);
    await d.pause(900);
    await waitFast(d, () => page.getByText("Reading your tasks").waitFor({ state: "detached", timeout: 90_000 }).catch(() => {}));
    await d.pause(4500);
  }

  // 06 Market
  await d.click(btn(page, "Market", true));
  await d.chapter("06", "Know when to sell", "WFP history + Muse Spark");
  await waitFast(d, () => page.getByText("How the price usually moves").first().waitFor({ timeout: 120_000 }).catch(() => {}));
  await d.pause(3500);
  await d.click(btn(page, /market news/));
  await waitFast(d, () => page.getByText("Searching the news").waitFor({ state: "detached", timeout: 180_000 }));
  await d.pause(3000);
  await d.scroll(600, 1500);
  await d.pause(3000);

  writeFileSync(farmFile, await page.evaluate(() => localStorage.getItem("farmpilot.farm.v2")));
  await d.stop();
  await browser.close();
}

// ------------------------------------------------------------------ clip B
async function clipB() {
  const { browser, d, page } = await session("B", { audio: path.join(assets, "ask.wav") });
  await loadSavedFarm(page);
  await page.getByRole("button", { name: "Ask FarmPilot", exact: true }).click();
  await page.getByText("Try asking:").waitFor();
  await d.start();
  await d.move(720, 500, 1);
  await d.chapter("07", "Ask anything, by voice", "Muse Voice Transcribe + Muse Spark");
  await d.pause(2000);
  await d.click(btn(page, /What should I do on my farm this week/));
  await waitFast(d, () => page.getByText("FarmPilot is checking").waitFor({ state: "detached", timeout: 150_000 }));
  await d.pause(5500);
  await d.click(page.getByTitle("Ask with your voice"));
  await d.pause(5900); // the fake microphone plays the spoken question
  await d.click(page.getByTitle("Stop and send"));
  await waitFast(d, async () => {
    await page.getByText("FarmPilot is checking").waitFor({ timeout: 60_000 });
    await page.getByText("FarmPilot is checking").waitFor({ state: "detached", timeout: 150_000 });
  });
  await d.pause(6500);
  await d.stop();
  await browser.close();
}

// ------------------------------------------------------------------ clip C
async function clipC() {
  const { browser, d, page } = await session("C", { audio: path.join(assets, "listing.wav") });
  await loadSavedFarm(page);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByText("What do you want to sell?").waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.waitForTimeout(2500);
  await d.start();
  await d.move(720, 500, 1);
  await d.chapter("08", "Sell together: share a truck", "Muse Spark + SAM 3.1");
  await d.pause(3500);
  await d.click(page.getByTitle("Say it"));
  await d.pause(4300);
  await d.click(page.getByTitle("Stop"));
  await waitFast(d, () => page.getByText(/Filled in from what you said/).waitFor({ timeout: 90_000 }));
  await d.pause(3000);
  if (crate) {
    await page.locator('input[type="file"]').setInputFiles(crate);
    await waitFast(d, () => page.getByText(/^Grade [ABC]$/).waitFor({ timeout: 120_000 }));
    await d.pause(800);
    await d.scrollTo(page.getByText(/^Grade [ABC]$/), 260);
    await d.pause(5000);
  }
  await d.click(btn(page, /Find me the best market/));
  await waitFast(d, () => page.getByText("Muse Spark", { exact: true }).waitFor({ timeout: 150_000 }));
  await d.pause(800);
  await d.scrollTo(page.getByText("Muse Spark", { exact: true }), 140);
  await d.pause(6000);
  await d.scroll(330, 1200);
  await d.pause(5000);
  await d.click(page.getByRole("button", { name: /Book · pay transport from the sale/ }).first());
  await waitFast(d, () => page.getByText("My shipments").waitFor({ timeout: 60_000 }));
  await d.scrollTo(page.getByText("My shipments"), 120);
  await d.pause(4000);
  for (let i = 0; i < 3; i++) {
    const next = page.getByRole("button", { name: /Demo: move to the next step/ });
    if (!(await next.count())) break;
    await d.click(next);
    await d.pause(2200);
  }
  await d.pause(2500);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await d.pause(900);
  await d.click(btn(page, "Shared storage", true));
  await d.chapter("09", "Shared storage and equipment", "one engine");
  await d.pause(3500);
  await d.click(page.getByRole("button", { name: "Reserve space" }).first());
  await waitFast(d, () => page.getByText(/^Booked /).waitFor({ timeout: 30_000 }));
  await d.pause(3500);
  await d.click(btn(page, "Shared equipment", true));
  await d.pause(2500);
  const suggestion = page.getByRole("button", { name: /find a tractor/ });
  if (await suggestion.count()) {
    await d.click(suggestion);
    await d.pause(2000);
  }
  await d.scroll(350, 1000);
  await d.pause(1500);
  const book = page.getByRole("button", { name: "Book", exact: true });
  for (let i = 0; i < (await book.count()); i++) {
    if (await book.nth(i).isEnabled()) {
      await d.click(book.nth(i));
      break;
    }
  }
  await waitFast(d, () => page.getByText(/^Booked /).waitFor({ timeout: 30_000 }).catch(() => {}));
  await d.pause(4000);
  await d.stop();
  await browser.close();
}

const run = { A: clipA, B: clipB, C: clipC };
for (const c of clips) {
  const t = Date.now();
  console.log(`recording clip ${c}…`);
  await run[c]();
  console.log(`clip ${c} done in ${Math.round((Date.now() - t) / 1000)}s`);
}
