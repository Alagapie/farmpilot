// Helpers for recording product demos: a high-quality CDP screencast, a visible
// cursor with click ripples, chapter cards, and a log of "waiting" spans that
// the editor speeds up.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OVERLAY = () => {
  const style = document.createElement("style");
  style.textContent = `
    #__cursor { position: fixed; z-index: 2147483647; width: 26px; height: 26px; margin: -4px 0 0 -4px; pointer-events: none; transition: transform .12s; }
    #__cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
    .__ripple { position: fixed; z-index: 2147483646; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 9999px; border: 3px solid #4ade80; pointer-events: none; animation: __rip .6s ease-out forwards; }
    @keyframes __rip { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.6); opacity: 0 } }
    #__chapter { position: fixed; z-index: 2147483645; left: 50%; bottom: 36px; transform: translateX(-50%) translateY(20px); opacity: 0; transition: all .45s ease; pointer-events: none;
      font: 700 22px "Plus Jakarta Sans", system-ui, sans-serif; color: #fff; background: rgba(16,51,27,.94); border: 1px solid rgba(255,255,255,.18); border-radius: 9999px; padding: 12px 26px; box-shadow: 0 10px 30px rgba(0,0,0,.3); white-space: nowrap; }
    #__chapter.on { opacity: 1; transform: translateX(-50%) translateY(0); }
    #__chapter b { color: #4ade80; margin-right: 10px; }
    #__chapter span { color: #cfe0ff; margin-left: 10px; font-weight: 600; }
    nextjs-portal { display: none !important; }`;
  // Init scripts run before the document exists, so attach once the body is there.
  const add = () => {
    if (document.getElementById("__cursor")) return;
    document.head.appendChild(style);
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(c);
    const ch = document.createElement("div");
    ch.id = "__chapter";
    document.body.appendChild(ch);
  };
  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add);
  window.addEventListener("mousemove", (e) => {
    const c = document.getElementById("__cursor");
    if (!c) return;
    c.style.left = `${e.clientX}px`;
    c.style.top = `${e.clientY}px`;
  }, true);
  window.addEventListener("mousedown", (e) => {
    const r = document.createElement("div");
    r.className = "__ripple";
    r.style.left = `${e.clientX}px`;
    r.style.top = `${e.clientY}px`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
    const c = document.getElementById("__cursor");
    if (c) { c.style.transform = "scale(.85)"; setTimeout(() => (c.style.transform = ""), 140); }
  }, true);
  window.__showChapter = (n, title, model) => {
    const ch = document.getElementById("__chapter");
    if (!ch) return;
    ch.innerHTML = `<b>${n}</b>${title}${model ? `<span>· ${model}</span>` : ""}`;
    ch.classList.add("on");
    clearTimeout(window.__chT);
    window.__chT = setTimeout(() => ch.classList.remove("on"), 4200);
  };
};

export async function createDirector(context, name, outDir) {
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  const frames = [];
  const dir = path.join(outDir, name);
  mkdirSync(dir, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const t0 = Date.now();
  const marks = [];
  const fast = [];
  let fastStart = null;

  cdp.on("Page.screencastFrame", async (f) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });

  // Absolute epoch seconds, the same clock as screencast frame timestamps.
  const now = () => Date.now() / 1000;

  const d = {
    page,
    async start() {
      const vp = page.viewportSize();
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
    },
    /** Glide the visible cursor to an element, then click it. */
    async click(locator, { hold = 350 } = {}) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error("element not visible");
      const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(target.x, target.y, { steps: 24 });
      await page.waitForTimeout(hold);
      await page.mouse.down();
      await page.mouse.up();
    },
    async move(x, y, steps = 24) {
      await page.mouse.move(x, y, { steps });
    },
    async hover(locator) {
      const box = await locator.boundingBox();
      if (box) await d.move(box.x + box.width / 2, box.y + box.height / 2);
    },
    async type(locator, text, delay = 45) {
      await d.click(locator);
      await locator.pressSequentially(text, { delay });
    },
    /** Smoothly scroll the page by `dy` pixels over `ms`. */
    async scroll(dy, ms = 1200) {
      const steps = Math.max(8, Math.round(ms / 30));
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await page.waitForTimeout(ms / steps);
      }
    },
    async scrollTo(locator, offset = 120) {
      const box = await locator.boundingBox();
      if (box) await d.scroll(box.y - offset, 1000);
    },
    async pause(ms) {
      await page.waitForTimeout(ms);
    },
    async chapter(n, title, model) {
      marks.push({ t: now(), kind: "chapter", n, title, model });
      await page.evaluate(([a, b, c]) => window.__showChapter?.(a, b, c), [n, title, model ?? ""]);
    },
    mark(label) {
      marks.push({ t: now(), kind: "mark", label });
    },
    /** Everything between waitStart and waitEnd is sped up in the edit. */
    waitStart() {
      fastStart = now();
    },
    waitEnd() {
      if (fastStart != null) fast.push([fastStart, now()]);
      fastStart = null;
    },
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => {});
      await page.waitForTimeout(300);
      const base = frames[0]?.t ?? t0 / 1000;
      const timeline = {
        end: now() - base,
        frames: frames.map((f) => ({ file: f.file, t: f.t - base })),
        fast: fast.map(([a, b]) => [a - base, b - base]),
        marks: marks.map((m) => ({ ...m, t: m.t - base })),
      };
      writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(timeline, null, 1));
      return timeline;
    },
  };
  return d;
}
