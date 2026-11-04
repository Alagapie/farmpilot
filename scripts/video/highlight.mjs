// Cut a short highlight reel from the full demo: pick time ranges, speed some
// up, join with hard cuts. Prints where each range lands, for the voiceover.
// Usage: node scripts/video/highlight.mjs <ffmpeg.exe> <full.mp4> <out.mp4>
import { execFileSync } from "node:child_process";

const [ffmpeg, input, out] = process.argv.slice(2);

// [start s, end s, speed, label] on the full 5:50 demo.
const CUTS = [
  [1, 13, 1, "01 Map the farm: SAM outlines the fields"],
  [24, 28, 1, "   walk the corners with GPS"],
  [44, 50, 3, "   farm details"],
  [57, 68, 1.6, "02 Report in plain words"],
  [84, 87, 1, "03 Plan: two questions"],
  [87, 91, 2, "   building the plan"],
  [93, 100, 1.2, "   the plan"],
  [99, 102, 1.5, "   plan checks"],
  [114, 122, 2, "   shopping list"],
  [135, 139, 1.3, "   compare crops"],
  [151, 155, 2, "04 Calendar"],
  [164, 169, 1.2, "   season poster"],
  [173, 177, 1.3, "05 Today"],
  [180, 202, 2, "   planting, fertilizer, harvest"],
  [207, 219, 2, "06 When to sell"],
  [230, 243, 2, "07 Ask"],
  [249, 259, 2, "   ask by voice"],
  [264, 287, 2, "08 Spoken listing and photo grade"],
  [291, 302, 1.5, "   shared truck deals"],
  [315, 322, 2, "   pay from the sale"],
  [328, 332, 1.5, "09 Shared storage"],
  [342, 350, 1.5, "   shared equipment"],
];

const parts = CUTS.map(([a, b, sp], i) => `[0:v]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${sp},fps=30[v${i}]`);
const filter = `${parts.join(";")};${CUTS.map((_, i) => `[v${i}]`).join("")}concat=n=${CUTS.length}:v=1:a=0,format=yuv420p[out]`;
execFileSync(ffmpeg, ["-y", "-i", input, "-filter_complex", filter, "-map", "[out]", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out], {
  stdio: ["ignore", "ignore", "inherit"],
});

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let t = 0;
for (const [a, b, sp, label] of CUTS) {
  console.log(`${fmt(t)}  ${label}`);
  t += (b - a) / sp;
}
console.log(`total ${fmt(t)} (${t.toFixed(1)}s) → ${out}`);
