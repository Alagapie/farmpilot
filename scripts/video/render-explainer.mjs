// Render explainer.html to MP4 frame by frame: pause the GSAP timeline, step it
// to each frame's exact time and screenshot. Smooth 30fps regardless of how
// fast this machine can render live.
// Usage: node scripts/video/render-explainer.mjs <ffmpeg.exe> <out.mp4> <workDir> [fps]
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const [ffmpeg, out, work, fpsArg = "30"] = process.argv.slice(2);
const fps = Number(fpsArg);
const html = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "explainer.html")).href;

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__duration);
// Return nothing from the page: the timeline object can't be serialised back.
await page.evaluate(() => {
  const tl = gsap.globalTimeline.getChildren(false, false, true)[0];
  window.__seek = (t) => {
    tl.time(t, false);
  };
});

const total = Math.ceil(duration * fps);
console.log(`rendering ${total} frames (${duration.toFixed(1)}s at ${fps}fps)`);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => {
    window.__seek(t);
  }, i / fps);
  await page.screenshot({ path: path.join(work, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (i % (fps * 10) === 0) console.log(`  ${Math.round(i / fps)}s`);
}
await browser.close();

execFileSync(ffmpeg, ["-y", "-framerate", String(fps), "-i", path.join(work, "f%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out], { stdio: ["ignore", "ignore", "inherit"] });
console.log(`wrote ${out}`);
