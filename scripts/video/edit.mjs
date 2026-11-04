// Edit recorded demo clips into one MP4: real speed for the action, loading
// waits sped up, clips joined in order. Prints where each chapter and mark
// lands in the final video, for writing the voiceover.
// Usage: node scripts/video/edit.mjs <ffmpeg.exe> <out.mp4> <clipDir> [clipDir ...]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [ffmpeg, out, ...clips] = process.argv.slice(2);
const FPS = 30;
const MAX_SPEED = 8;
const MIN_WAIT_SHOWN = 1.4; // seconds of each wait the viewer still sees

const lines = [];
const marks = [];
let offset = 0;

for (const dir of clips) {
  const tl = JSON.parse(readFileSync(path.join(dir, "timeline.json"), "utf8"));
  const end = tl.end;
  // Build segments of [srcStart, srcEnd, speed].
  const segs = [];
  let cursor = 0;
  for (const [a0, b0] of tl.fast.sort((x, y) => x[0] - y[0])) {
    const a = Math.max(a0, cursor);
    const b = Math.min(b0, end);
    if (b <= a) continue;
    if (a > cursor) segs.push([cursor, a, 1]);
    const len = b - a;
    const shown = Math.min(Math.max(MIN_WAIT_SHOWN, len / MAX_SPEED), len);
    segs.push([a, b, len / shown]);
    cursor = b;
  }
  if (cursor < end) segs.push([cursor, end, 1]);

  const srcToOut = (s) => {
    let o = 0;
    for (const [a, b, sp] of segs) {
      if (s <= a) break;
      o += (Math.min(s, b) - a) / sp;
    }
    return o;
  };
  const outLen = srcToOut(end);
  const frames = tl.frames;
  let fi = 0;
  let last = null;
  let run = 0;
  const total = Math.floor(outLen * FPS);
  // Walk output frames; map each back to source time and pick the latest captured frame.
  for (let k = 0; k < total; k++) {
    const T = k / FPS;
    let acc = 0;
    let S = end;
    for (const [a, b, sp] of segs) {
      const segOut = (b - a) / sp;
      if (T < acc + segOut) {
        S = a + (T - acc) * sp;
        break;
      }
      acc += segOut;
    }
    while (fi + 1 < frames.length && frames[fi + 1].t <= S) fi++;
    const file = frames[fi].file;
    if (file === last) run++;
    else {
      if (last) lines.push(`file '${last.replace(/\\/g, "/")}'\nduration ${(run / FPS).toFixed(4)}`);
      last = file;
      run = 1;
    }
  }
  if (last) lines.push(`file '${last.replace(/\\/g, "/")}'\nduration ${(run / FPS).toFixed(4)}`);
  for (const m of tl.marks) marks.push({ ...m, t: Math.round((offset + srcToOut(m.t)) * 10) / 10, clip: path.basename(dir) });
  console.log(`${path.basename(dir)}: ${end.toFixed(1)}s recorded → ${outLen.toFixed(1)}s in the video`);
  offset += outLen;
}
// The concat demuxer needs the last file repeated to honour its duration.
const lastFile = lines.at(-1).split("\n")[0];
const list = `${lines.join("\n")}\n${lastFile}\n`;
const listFile = `${out}.txt`;
writeFileSync(listFile, list);
execFileSync(
  ffmpeg,
  ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out],
  { stdio: ["ignore", "ignore", "inherit"] },
);
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 1));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
console.log(`\nwrote ${out} (${fmt(offset)})`);
for (const m of marks) console.log(`${fmt(m.t)}  ${m.kind === "chapter" ? `[${m.n}] ${m.title}${m.model ? ` · ${m.model}` : ""}` : `   ${m.label}`}`);
