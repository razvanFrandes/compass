#!/usr/bin/env node
/*
  Does a chart's tooltip stay while the pointer is on the chart?

    node apps/web/scripts/tooltip-check.mjs https://juyo.razvanfrandes.com /catalog / "/ask?c=<id>"
    node apps/web/scripts/tooltip-check.mjs http://localhost:4200 /catalog --min=95 --headed

  For every chart (<juyo-echart>) on each page: it scrolls the chart into the middle of the window, finds the
  stretch of its middle line where a tooltip answers (a sweep, one pointer move per step), then moves the pointer
  continuously inside that stretch (a mouseMoved every ~16 ms for 3 s, back and forth, as a hand does) and holds it
  still for 2 s, sampling every 50 ms whether the ECharts tooltip is on screen. A chart passes when the tooltip is
  visible in at least --min % (default 95) of the samples of both phases. Exit code 1 when one does not.

  No dependencies: Chrome is driven over the DevTools protocol with Node's own WebSocket (Node 22+). CHROME=<path>
  names the browser (default: Google Chrome on macOS, else google-chrome on PATH). Headless by default; --headed
  opens a window.
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}`));
  if (!hit) return fallback;
  const [, value] = hit.split('=');
  return value ?? true;
};
const positional = args.filter((a) => !a.startsWith('--'));
const base = (positional[0] ?? 'http://localhost:4200').replace(/\/$/, '');
const paths = positional.slice(1).length ? positional.slice(1) : ['/catalog'];
const MIN = Number(flag('min', 95));
const HEADED = !!flag('headed', false);
const WIDTH = Number(flag('width', 1440));
const HEIGHT = Number(flag('height', 900));
const CHROME = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'tooltip-check-'));
  const flags = [`--user-data-dir=${dir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', `--window-size=${WIDTH},${HEIGHT}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
  if (!HEADED) flags.push('--headless=new');
  const proc = spawn(CHROME, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let out = '';
    proc.stderr.on('data', (d) => {
      out += d;
      const m = out.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on('error', reject);
    setTimeout(() => reject(new Error(`Chrome did not start (${CHROME})`)), 20000);
  });
  const port = new URL(wsUrl).port;
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) events.forEach((l) => l(msg));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const goto = async (url) => {
    const loaded = new Promise((resolve) => {
      const l = (m) => {
        if (m.method !== 'Page.loadEventFired') return;
        events.splice(events.indexOf(l), 1);
        resolve();
      };
      events.push(l);
    });
    await send('Page.navigate', { url });
    await loaded;
  };
  const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const close = () => {
    ws.close();
    proc.kill();
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 500);
  };
  return { evaluate, goto, move, close };
}

/** In the page: is chart i's ECharts tooltip on screen (shown, not faded out)? */
const VISIBLE = (i) => `(() => {
  const host = document.querySelectorAll('juyo-echart')[${i}];
  const tip = host && [...host.querySelectorAll('div')].find((d) => d.style.zIndex === '9999999');
  if (!tip) return false;
  const cs = getComputedStyle(tip), r = tip.getBoundingClientRect();
  return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5 && r.width > 0 && r.height > 0;
})()`;

async function checkChart(b, i) {
  const info = await b.evaluate(`(async () => {
    const host = document.querySelectorAll('juyo-echart')[${i}];
    host.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 600));
    const r = host.getBoundingClientRect();
    const w = host.closest('juyo-widget-chart');
    const title = w?.querySelector('.wc-title')?.textContent ?? w?.closest('figure, article')?.querySelector('h2, h3')?.textContent ?? '';
    return { kind: w?.dataset.kind ?? '?', title: title.trim().slice(0, 60), x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);
  // Where on the middle line does a tooltip answer? One pointer move per 2.5% of the width, each held longer than a
  // tooltip's hide delay, so a gap between two marks reads as a gap and not as the tooltip lingering over it.
  const STEPS = 40;
  let best = null;
  for (const fy of [0.5, 0.4, 0.6]) {
    const y = info.y + info.height * fy;
    const hits = [];
    for (let s = 0; s <= STEPS; s++) {
      await b.move(info.x + (info.width * s) / STEPS, y);
      await sleep(320);
      hits.push(await b.evaluate(VISIBLE(i)));
    }
    let run = null;
    for (let s = 0; s <= STEPS; s++) {
      if (hits[s] && !run) run = { from: s, to: s };
      else if (hits[s] && run) run.to = s;
      if ((!hits[s] || s === STEPS) && run) {
        if (!best || run.to - run.from > best.to - best.from) best = { ...run, y };
        run = null;
      }
    }
    if (best && best.to - best.from >= 3) break;
  }
  await b.move(2, 2);
  await sleep(400);
  if (!best) return { ...info, skipped: 'no tooltip on its middle line' };
  // Within the stretch, from its first answering step to its last.
  const from = info.x + (info.width * best.from) / STEPS;
  const to = info.x + (info.width * best.to) / STEPS;
  await b.move(from, best.y);
  await sleep(300);
  await b.evaluate(`(() => {
    window.__tipPhase = 'moving';
    window.__tipSamples = [];
    window.__tipTimer = setInterval(() => window.__tipSamples.push([window.__tipPhase, ${VISIBLE(i)}]), 50);
  })()`);
  const start = Date.now();
  while (Date.now() - start < 3000) {
    // Back and forth across the stretch, about once a second each way.
    const t = ((Date.now() - start) / 1000) % 2;
    const f = t < 1 ? t : 2 - t;
    await b.move(from + (to - from) * f, best.y);
    await sleep(16);
  }
  await b.move((from + to) / 2, best.y);
  await b.evaluate(`window.__tipPhase = 'holding'`);
  await sleep(2000);
  const samples = await b.evaluate(`(clearInterval(window.__tipTimer), window.__tipSamples)`);
  await b.move(2, 2);
  await sleep(300);
  const phase = (name) => {
    const s = samples.filter((x) => x[0] === name).map((x) => x[1]);
    return { pct: s.length ? Math.round((100 * s.filter(Boolean).length) / s.length) : 0, trace: s.map((v) => (v ? '█' : '·')).join('') };
  };
  return { ...info, stretch: [best.from / STEPS, best.to / STEPS], moving: phase('moving'), holding: phase('holding') };
}

const b = await launch();
let failed = 0;
let checked = 0;
try {
  for (const path of paths) {
    await b.goto(base + path);
    const start = Date.now();
    while (Date.now() - start < 30000 && !(await b.evaluate(`document.querySelectorAll('juyo-echart svg').length > 0`))) await sleep(250);
    await sleep(2500);
    const count = await b.evaluate(`document.querySelectorAll('juyo-echart').length`);
    console.log(`\n${base}${path}: ${count} chart${count === 1 ? '' : 's'}`);
    for (let i = 0; i < count; i++) {
      const r = await checkChart(b, i);
      const name = `${String(i).padStart(2)} ${r.kind.padEnd(16)}`;
      if (r.skipped) {
        console.log(`${name} skipped: ${r.skipped}  ${r.title}`);
        continue;
      }
      checked++;
      const ok = r.moving.pct >= MIN && r.holding.pct >= MIN;
      if (!ok) failed++;
      console.log(`${name} ${ok ? 'ok  ' : 'FAIL'} moving ${String(r.moving.pct).padStart(3)}% ${r.moving.trace}  holding ${String(r.holding.pct).padStart(3)}% ${r.holding.trace}  ${r.title}`);
    }
  }
} finally {
  b.close();
}
console.log(`\n${checked - failed} of ${checked} charts keep their tooltip in at least ${MIN}% of the samples.`);
process.exit(failed ? 1 : 0);
