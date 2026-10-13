#!/usr/bin/env node
// vidpipe — render a JSON scene spec to a silent 720p MP4.
//   node render.mjs spec.json --check          timing + reading report only (no frames)
//   node render.mjs spec.json --preview        one contact sheet (spec.sheet.jpg)
//   node render.mjs spec.json                  full render (720p30, blur on fast moves)
// options: --fps 30  --blur 3 (subsamples on fast moves, 1 = off)  --workers N  --out file.mp4
// Refuses to render when any text block is on screen too briefly to read, when text would be
// too small or overflow, or when the video runs over 60 s. Exit codes: 2 unreadable, 3 too long.
// Browser: Playwright's Chromium, or set VIDPIPE_CHROME to an installed Chrome/Chromium binary.
import { chromium } from 'playwright';
import sharp from 'sharp';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const specPath = args.find(a => !a.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
if (!specPath) { console.error('usage: node render.mjs spec.json [--check|--preview] [--fps 30] [--blur 3] [--workers N] [--out out.mp4]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const MAX_SECONDS = 60, TARGET_SECONDS = 45;
const RES = 720, FPS = +opt('fps', spec.fps || 30), BLUR = +opt('blur', 3);
const W = Math.round(1920 * RES / 1080), H = RES, SCALE = RES / 1080;
const WORKERS = +opt('workers', Math.max(1, os.cpus().length));
const OUT = path.resolve(opt('out', spec.out || specPath.replace(/\.json$/, '.mp4')));
const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// tiny static server for engine + fonts
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((q, s) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/engine/engine.html`;

async function openPage() {
  const browser = await chromium.launch({ executablePath: process.env.VIDPIPE_CHROME || undefined, args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto(URL); await page.evaluate(() => window.FONTS);
  const tl = await page.evaluate(([s, sc]) => { window.__scale = sc; document.getElementById('stage').style.transform = `scale(${sc})`; return window.SETUP(s); }, [spec, SCALE]);
  const cdp = await page.context().newCDPSession(page);
  const shot = async t => { await page.evaluate(t => window.render(t), t); const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true }); return Buffer.from(r.data, 'base64'); };
  return { browser, page, tl, shot };
}

const main = await openPage();
const TL = main.tl;
// ---------- report ----------
console.log('\nscenes:'); TL.scenes.forEach((s, i) => console.log(`  ${String(i).padStart(2)} ${s.type.padEnd(10)} start ${s.start.toFixed(2).padStart(6)}s  dur ${s.dur.toFixed(2)}s`));
console.log('\nreading check (0.7s + words/3 on screen):');
let allOk = true; TL.reading.forEach(r => { allOk &&= r.ok; console.log(`  ${r.ok ? 'ok   ' : 'SHORT'} [${r.scene}] ${r.label.slice(0, 48).padEnd(48)} ${String(r.words).padStart(2)}w  ${r.have.toFixed(2)}s / ${r.need.toFixed(2)}s`); });
const warnings = TL.warnings || [];
if (warnings.length) { console.log('\nlayout:'); warnings.forEach(w => console.log(`  TOO SMALL [${w.scene}] ${w.msg}`)); }
const tooLong = TL.duration > MAX_SECONDS;
console.log(`\nduration ${TL.duration.toFixed(1)}s${tooLong ? `  ✗ over the ${MAX_SECONDS}s limit — cut scenes or words` : TL.duration > TARGET_SECONDS ? `  ⚠ over ${TARGET_SECONDS}s — consider trimming` : ''}   reading ${allOk ? 'all ok' : 'HAS SHORT BLOCKS'}${warnings.length ? '   layout HAS PROBLEMS' : ''}`);
const code = (!allOk || warnings.length) ? 2 : tooLong ? 3 : 0;
if (opt('check', false) || (code && !opt('preview', false))) {
  if (code && !opt('check', false)) console.error('\nnot rendering: fix the spec (see above), then run again.');
  await main.browser.close(); server.close(); process.exit(code);
}

// ---------- preview contact sheet ----------
if (opt('preview', false)) {
  const times = TL.scenes.map(s => s.start + Math.max(0.6, s.dur - (s.type === 'end' ? 0.1 : 0.45)));
  const tw = 480, th = 270, cols = 3, rows = Math.ceil(times.length / cols);
  const tiles = [];
  for (let i = 0; i < times.length; i++) { const b = await main.shot(times[i]); tiles.push({ input: await sharp(b).resize(tw, th).toBuffer(), left: (i % cols) * tw, top: Math.floor(i / cols) * th }); }
  const out = specPath.replace(/\.json$/, '') + '.sheet.jpg';
  await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(out);
  log('preview sheet →', out); await main.browser.close(); server.close(); process.exit(code);
}
await main.browser.close();

// ---------- full render ----------
const N = Math.ceil(TL.duration * FPS);
const fast = t => TL.fast.some(([a, b]) => t >= a && t <= b);
const subs = [...Array(N)].map((_, n) => (BLUR > 1 && fast(n / FPS)) ? BLUR : 1);
const total = subs.reduce((a, b) => a + b, 0);
// split frames into contiguous chunks of roughly equal cost
const chunks = []; { let acc = 0, start = 0; const per = total / WORKERS; for (let n = 0; n < N; n++) { acc += subs[n]; if (acc >= per * (chunks.length + 1) && chunks.length < WORKERS - 1) { chunks.push([start, n + 1]); start = n + 1; } } chunks.push([start, N]); }
log(`rendering ${N} frames (${total} captures, ${RES}p${FPS}) on ${chunks.length} worker(s)…`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpipe-'));
let done = 0;
await Promise.all(chunks.map(async ([a, b], w) => {
  const { browser, shot } = await openPage();
  const seg = path.join(tmp, `seg${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const acc = new Uint16Array(W * H * 3);
  for (let n = a; n < b; n++) {
    const k = subs[n]; let frame;
    if (k === 1) frame = await sharp(await shot(n / FPS)).raw().toBuffer();
    else { acc.fill(0); for (let j = 0; j < k; j++) { const r = await sharp(await shot(n / FPS + j * (0.5 / FPS) / k)).raw().toBuffer(); for (let p = 0; p < r.length; p++) acc[p] += r[p]; }
      frame = Buffer.alloc(acc.length); for (let p = 0; p < acc.length; p++) frame[p] = (acc[p] + (k >> 1)) / k; }
    if (!ff.stdin.write(frame)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 150 === 0) log(`  ${done}/${N} frames`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
}));
fs.writeFileSync(path.join(tmp, 'list.txt'), chunks.map((_, w) => `file 'seg${w}.mp4'`).join('\n'));
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', '-an', '-movflags', '+faststart', OUT], { stdio: 'inherit' }).on('close', c => c ? rej(c) : res()));
fs.rmSync(tmp, { recursive: true, force: true }); server.close();
log(`done → ${OUT}  (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${TL.duration.toFixed(1)}s video)`);
