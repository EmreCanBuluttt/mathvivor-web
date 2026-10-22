// Headless Chrome smoke test + viewport screenshots for the local preview (http://localhost:4430 serves docs/).
//   node tools/smoke.mjs --out <dir> --pages index,oyunlar [--widths 1440,390] [--shots 4] [--eval "<js run before shots>"]
// Prints per page/width: JS exceptions, console errors, horizontal overflow, broken images.
// Writes <out>/<page>-<width>-<n>.jpg viewport screenshots (n = scroll segment, up to --shots).
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg("out", join(tmpdir(), "mv-smoke")); mkdirSync(out, { recursive: true });
const pages = arg("pages", "index").split(",").filter(Boolean);
const widths = arg("widths", "1440,390").split(",").map(Number);
const shots = +arg("shots", "4");
const pre = arg("eval", "");
const at = arg("at", "");  // optional CSS selector: screenshots start at this element instead of the page top
const base = arg("base", "http://localhost:4430");
const port = 9400 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), "mv-cdp-"));
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chrome = spawn(CH, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(tabs.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const events = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } else if (m.method) events.push(m); };
const send = (method, params = {}) => Promise.race([new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); }), sleep(30000).then(() => ({ timeout: true }))]);
await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
let failed = 0;
for (const page of pages) for (const w of widths) {
  const h = w >= 1000 ? 900 : 844; events.length = 0;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: `${base}/${page}.html` }); await sleep(1800);
  await send("Runtime.evaluate", { awaitPromise: true, expression: "(async()=>{document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in'));const H=document.documentElement.scrollHeight;for(let y=0;y<H;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);await Promise.race([Promise.all([...document.images].map(i=>i.decode?i.decode().catch(()=>{}):0)),new Promise(r=>setTimeout(r,5000))]);return 1})()" });
  if (pre) { const r = await send("Runtime.evaluate", { awaitPromise: true, expression: pre }); if (r.result?.exceptionDetails) console.log("  eval error:", r.result.exceptionDetails.text); await sleep(600); }
  const info = (await send("Runtime.evaluate", { returnByValue: true, expression: "({H:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,w:innerWidth,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.ticker,[data-allow-overflow]')}).slice(0,5).map(e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).join('.'):''))})" })).result?.result?.value || {};
  const exc = events.filter(m => m.method === "Runtime.exceptionThrown").map(m => m.params.exceptionDetails.exception?.description?.split("\n")[0] || m.params.exceptionDetails.text);
  const cerr = events.filter(m => (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") || (m.method === "Log.entryAdded" && m.params.entry.level === "error")).map(m => m.params.entry ? m.params.entry.text + " " + (m.params.entry.url || "") : m.params.args.map(a => a.value ?? a.description).join(" "));
  const bad = exc.length || cerr.length || info.sw > info.w || (info.broken || []).length;
  if (bad) failed++;
  console.log(`${bad ? "FAIL" : "ok  "} ${page} @${w}: height ${info.H}${info.sw > info.w ? ` OVERFLOW scrollWidth=${info.sw} wide=${JSON.stringify(info.wide)}` : ""}${exc.length ? " EXC " + JSON.stringify(exc) : ""}${cerr.length ? " CONSOLE " + JSON.stringify(cerr) : ""}${info.broken?.length ? " BROKEN " + JSON.stringify(info.broken) : ""}`);
  let y0 = 0;
  if (at) { const r = await send("Runtime.evaluate", { returnByValue: true, expression: `(()=>{const e=document.querySelector(${JSON.stringify(at)});return e?Math.max(0,e.getBoundingClientRect().top+scrollY-90):0})()` }); y0 = r.result?.result?.value || 0; }
  for (let n = 0; n < shots && y0 + n * h < info.H; n++) {
    await send("Runtime.evaluate", { expression: `scrollTo(0, ${y0 + n * h})` }); await sleep(350);
    const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 78 });
    if (s.result?.data) writeFileSync(join(out, `${page}-${w}-${n}.jpg`), Buffer.from(s.result.data, "base64"));
  }
}
ws.close(); chrome.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
console.log(failed ? `${failed} page/width combos with problems` : "all clean", "| screenshots ->", out);
process.exit(0);
