// Screenshot one element of a page: node tools/element-shot.mjs <url> <selector> <width> <out.jpg>
import { spawn } from "node:child_process"; import { mkdtempSync, writeFileSync, rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const [url, sel, width, out] = process.argv.slice(2);
const port = 9900 + Math.floor(Math.random() * 90); const prof = mkdtempSync(join(tmpdir(), "mv-el-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(tabs.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const w = +width; await send("Page.enable"); await send("Emulation.setDeviceMetricsOverride", { width: w, height: w < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: w < 768 });
await send("Page.navigate", { url }); await sleep(1800);
const r = await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async()=>{document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in','is-visible'));const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView();await new Promise(r=>setTimeout(r,400));await Promise.all([...e.querySelectorAll('img')].map(i=>(i.loading='eager',i.decode?i.decode().catch(()=>{}):0)));await new Promise(r=>setTimeout(r,500));const b=e.getBoundingClientRect();return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height}})()` });
const b = r.result.result.value;
const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 82, captureBeyondViewport: true, clip: { x: b.x, y: b.y, width: b.w, height: Math.min(b.h, 3000), scale: 1 } });
writeFileSync(out, Buffer.from(s.result.data, "base64")); ws.close(); chrome.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {} console.log("saved", out, b);
