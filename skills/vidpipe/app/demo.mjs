#!/usr/bin/env node
// vidpipe demo: film a real web app in action, then add cards and captions.
// The film is the real page, its real code and animations. Only the responses of requests matching the shot's
// `replay` pattern come from the recording, at their recorded latencies. A manual clock drives timers, animation
// frames, scrolls and every CSS/Web Animation, so each frame is exactly 1/30 s apart however slow the machine is.
// Refuses captions or cards that fail the reading rule (exit 2) and videos over 180 s (exit 3).
// Browser: Playwright's Chromium, or set VIDPIPE_CHROME to an installed Chrome/Chromium binary.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [cmd, input, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i < 0 ? d : (rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : true); };
const USAGE = `vidpipe demo: film a real web app in action, then add cards and captions.
  node demo.mjs record  shot.mjs [--out take1]                   live run; saves the app's answers (calls.json) and marks
  node demo.mjs film    shot.mjs [--calls take1] [--out film]    replays that run frame by frame at exactly 30 fps
                                                                 (--calls only if the shot has \`replay\`; --debug logs every frame)
  node demo.mjs compose video.json --film film --check           caption + card timing only
  node demo.mjs compose video.json --film film --preview         contact sheet, one frame per caption
  node demo.mjs compose video.json --film film --out demo.mp4 [--max-mb 5]
  Several pages: film one shot per page, then --film film1,film2 (or "film": [...] in video.json).`;
const usage = () => { console.error(USAGE); process.exit(1); };
if (!['record', 'film', 'compose'].includes(cmd) || !input) usage();
const FPS = 30, W = 1280, H = 720, MAX_SECONDS = 180;
const need = (words) => 0.7 + words / 3;
const words = (...s) => s.flat().filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
const launch = () => chromium.launch({ executablePath: process.env.VIDPIPE_CHROME || undefined, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-gpu', '--hide-scrollbars'] });
const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------- in-page helpers ----------
// Seeded Math.random, so the page makes the same choices in the recording and the film.
const SEED = (seed) => `(() => { let s = ${seed >>> 0} || 1; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

// Records responses to matching fetches: status, headers, body text, latency.
const RECORDER = (match) => `(() => { window.__calls = []; const f = window.fetch, m = ${JSON.stringify(match)};
  window.fetch = async (u, o) => { const url = String(u && u.url || u); if (!url.includes(m)) return f(u, o);
    const t = performance.now(); const r = await f(u, o); const body = await r.clone().text();
    window.__calls.push({ url, ms: Math.round(performance.now() - t), status: r.status, type: r.headers.get('content-type') || '', body }); return r; }; })();`;

// The manual clock: setTimeout/setInterval/requestAnimationFrame/performance.now/Date.now, and every animation the
// document runs (CSS transitions, CSS animations, element.animate) are paused and stepped by __advance(ms).
// Replays recorded responses in order, at their recorded latency.
const CLOCK = (calls, match) => `(() => {
  let vnow = 0; const dateBase = Date.now();
  const timers = new Map(); let tid = 1; const rafs = new Map(); let rid = 1;
  window.setTimeout = (f, ms = 0, ...a) => { const id = tid++; timers.set(id, { at: vnow + Math.max(0, +ms || 0), f, a }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.setInterval = (f, ms = 0, ...a) => { const id = tid++; const arm = () => timers.set(id, { at: vnow + Math.max(1, +ms || 0), f: () => { arm(); f(...a); }, a: [] }); arm(); return id; };
  window.requestAnimationFrame = (f) => { const id = rid++; rafs.set(id, f); return id; };
  window.cancelAnimationFrame = (id) => rafs.delete(id);
  performance.now = () => vnow; Date.now = () => Math.floor(dateBase + vnow);   // whole ms: pages call BigInt(Date.now())
  const anims = new Map(); const track = (a, start) => { if (anims.has(a)) return; a.pause(); anims.set(a, start); };
  const CALLS = ${JSON.stringify(calls)}, M = ${JSON.stringify(match)}; let call = 0; window.__replayed = () => call;
  const realFetch = window.fetch;
  window.fetch = async (u, o) => {
    const url = String(u && u.url || u); if (!M || !url.includes(M)) return realFetch(u, o);
    const c = CALLS[call++];
    if (!c) { window.__replayError = 'the page made more matching requests than the recording has (' + CALLS.length + ')'; return new Promise(() => {}); }
    await new Promise((r) => setTimeout(r, c.ms));
    return new Response([101, 204, 205, 304].includes(c.status) ? null : c.body, { status: c.status, headers: c.type ? { 'content-type': c.type } : {} });
  };
  window.__advance = async (ms) => {
    const from = vnow, target = vnow + ms;
    for (const a of document.getAnimations()) track(a, from);
    for (let guard = 0; guard < 500; guard++) {
      let next = null;
      for (const [id, tm] of timers) if (tm.at <= target && (!next || tm.at < next[1].at)) next = [id, tm];
      if (!next) break;
      vnow = Math.max(vnow, next[1].at); timers.delete(next[0]);
      try { next[1].f(...next[1].a); } catch (e) { console.error('timer:', e && e.message); }
      for (let k = 0; k < 20; k++) await Promise.resolve();   // let promise chains run before the next timer
    }
    vnow = target;
    for (const a of document.getAnimations()) track(a, from);
    for (const [a, start] of anims) {
      if (a.playState === 'idle') { anims.delete(a); continue; }
      const end = a.effect ? a.effect.getComputedTiming().endTime : 0, tt = (vnow - start) * (a.playbackRate || 1);
      if (end !== Infinity && tt >= end) { try { a.finish(); } catch {} anims.delete(a); } else a.currentTime = tt;
    }
    const cbs = [...rafs.values()]; rafs.clear();
    for (const f of cbs) try { f(vnow); } catch (e) { console.error('raf:', e && e.message); }
    return [scrollX, scrollY];   // the screenshot clip is in page coordinates, so the film needs the scroll
  };
})();`;

// Smooth scrolls on the page clock. The browser runs smooth scrolling on its own real-time clock, which the film can't
// step, so CSS scroll-behavior is turned off and every scroll asked for with behavior 'smooth' (scrollTo, scrollBy,
// scroll, scrollIntoView) glides instead: an ease over timers the clock steps. Used live too, so marks match.
const SMOOTH = `(() => {
  const css = document.createElement('style'); css.textContent = 'html, * { scroll-behavior: auto !important; }';
  const put = () => (document.head || document.documentElement).append(css);
  if (document.documentElement) put(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); put(); } }).observe(document, { childList: true });
  const ease = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, owner = new WeakMap();
  // glide(jump, scrollers, ms): runs jump(), notes where the scrollers ended up, puts them back, then eases them there
  const glide = window.__glide = async (jump, scrollers, ms = 600) => {
    const from = scrollers.filter(Boolean).map((e) => [e, e.scrollLeft, e.scrollTop]); jump();
    const moves = from.map(([e, x, y]) => [e, x, y, e.scrollLeft, e.scrollTop]).filter((m) => m[1] !== m[3] || m[2] !== m[4]);
    if (!moves.length || !(ms > 0)) return;
    const me = {}; for (const [e, x, y] of moves) { e.scrollLeft = x; e.scrollTop = y; owner.set(e, me); }
    const t0 = performance.now();
    for (;;) { const u = Math.min(1, (performance.now() - t0) / ms), k = ease(u);
      for (const [e, x0, y0, x1, y1] of moves) if (owner.get(e) === me) { e.scrollLeft = x0 + (x1 - x0) * k; e.scrollTop = y0 + (y1 - y0) * k; }
      if (u >= 1) return; await new Promise((r) => setTimeout(r, 1000 / 60)); }
  };
  const smooth = (o) => o && typeof o === 'object' && o.behavior === 'smooth', P = Element.prototype;
  for (const k of ['scroll', 'scrollTo', 'scrollBy']) {
    const el = P[k], win = window[k];
    P[k] = function (...a) { return smooth(a[0]) ? void glide(() => el.call(this, { ...a[0], behavior: 'auto' }), [this]) : el.apply(this, a); };
    window[k] = function (...a) { return smooth(a[0]) ? void glide(() => win.call(window, { ...a[0], behavior: 'auto' }), [document.scrollingElement]) : win.apply(window, a); };
  }
  const into = P.scrollIntoView;
  window.__scrollers = (e) => { const s = []; for (let p = e.parentElement; p; p = p.parentElement) s.push(p); if (!s.includes(document.scrollingElement)) s.push(document.scrollingElement); return s; };
  P.scrollIntoView = function (o) { return smooth(o) ? void glide(() => into.call(this, { ...o, behavior: 'auto' }), __scrollers(this)) : into.call(this, o); };
})();`;

// D: what a shot's director uses. Waits run on the page's clock, so the same director works live and filmed.
const DIRECTOR_KIT = (finger, cropTop) => `(() => {
  const vs = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = (t) => typeof t === 'string' ? document.querySelector(t) : t;
  const f = document.createElement('div');
  Object.assign(f.style, { position: 'fixed', left: '50%', top: '75%', width: '28px', height: '28px', margin: '-14px 0 0 -14px', borderRadius: '50%',
    background: ${JSON.stringify(finger.fill)}, border: '3px solid ' + ${JSON.stringify(finger.ring)}, zIndex: 2147483647, pointerEvents: 'none',
    transition: 'left .6s cubic-bezier(.3,.7,.2,1), top .6s cubic-bezier(.3,.7,.2,1), transform .15s ease' });
  const t0 = performance.now(); const marks = [];
  const D = window.__D = {
    $: (s) => document.querySelector(s), $$: (s) => [...document.querySelectorAll(s)],
    wait: vs,
    mark: (what) => marks.push({ t: +((performance.now() - t0) / 1000).toFixed(3), what }),
    async point(t) { const e = el(t); if (!e) throw new Error('not found: ' + t); if (!f.isConnected) document.body.append(f);
      await __glide(() => { e.scrollIntoView({ block: 'nearest', inline: 'nearest' });   // glides into the filmed band, clear of cropTop and caption bars
        const top = ${cropTop} + 100, bot = innerHeight - 100, r = e.getBoundingClientRect(), s = document.scrollingElement;
        if (r.top < top) s.scrollTop -= top - r.top; else if (r.bottom > bot) s.scrollTop += Math.min(r.bottom - bot, r.top - top); }, __scrollers(e), 500);
      await vs(120); const r = e.getBoundingClientRect();
      f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px'; await vs(700); return e; },
    async press(t, what) { const e = await D.point(t); f.style.transform = 'scale(.7)'; await vs(150); f.style.transform = 'scale(1)'; if (what) D.mark(what); return e; },
    async tap(t, what) { const e = await D.press(t); e.click(); if (what) D.mark(what); return e; },
    async type(t, text, perSecond = 14) { const e = await D.tap(t); for (const ch of text) { e.value += ch; e.dispatchEvent(new Event('input', { bubbles: true })); await vs(1000 / perSecond); } return e; },
    async until(test, timeout = 180000) { const fn = typeof test === 'string' ? () => document.querySelector(test) : test;
      for (let w = 0; w <= timeout; w += 100) { const v = fn(); if (v) return v; await vs(100); } throw new Error('until: timed out'); },
    on(selector, fn) { const seen = new WeakSet(); const run = () => { for (const e of document.querySelectorAll(selector)) if (!seen.has(e)) { seen.add(e); fn(e); } };
      new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true }); run(); },
    scroll(t, top, ms = 600) { const e = t == null ? document.scrollingElement : el(t); return __glide(() => { e.scrollTop = top; }, [e], ms); },
    done: () => { D.mark('end'); window.__done = true; },
    marks, finger: f,
  };
})();`;

async function loadShot(file) {
  const shot = (await import(pathToFileURL(path.resolve(file)).href)).default;
  if (!shot?.url || typeof shot.director !== 'function') { console.error('a shot exports default { url, director: async (D) => {...} }'); process.exit(1); }
  const url = /^[a-z]+:/i.test(shot.url) ? shot.url : pathToFileURL(path.resolve(path.dirname(file), shot.url)).href;
  return { cropTop: 0, seed: 1, settle: 1, timeout: 180, ...shot, url,
    finger: { fill: 'rgba(255,90,31,.55)', ring: '#17171c', ...shot.finger } };
}

async function openShot(shot, init) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H + shot.cropTop } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const s of init) await page.addInitScript(s);
  await page.goto(shot.url, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  return { browser, page, errors };
}
// A shot is one page: navigating away ends the director. Same-page changes (hash links, pushState) are fine.
const watchNav = (page) => { let started = false, to = '', hit; const left = new Promise((r) => { hit = r; });
  page.on('domcontentloaded', () => { if (started && !to) { to = page.url(); hit(); } });
  return { start: () => { started = true; }, get to() { return to; }, left,
    after: (e) => Promise.race([left, new Promise((r) => setTimeout(r, 5000))]).then(() => { if (!to) throw e; }) }; };   // an error from leaving the page, or a real one
const navStop = (to) => { console.error(`the page navigated to ${to}, which ends the director: a shot films one page.
  End this shot on the link with D.press(selector), film the next page as its own shot, and join the films in compose (--film a,b).`); process.exit(1); };
// a director may be written as an arrow, a function, or a method (`async director(D) {…}`)
const fnSource = (fn) => { const s = fn.toString(); return /^(async\s*)?(function\b|\(|[\w$]+\s*=>)/.test(s) ? s : s.startsWith('async ') ? 'async function ' + s.slice(6) : 'function ' + s; };
const run = (shot) => `(${fnSource(shot.director)})(window.__D).then(() => window.__D.done(), (e) => { window.__err = String(e && e.message || e); window.__D.done(); }); 0`;

// ---------- record: a live run ----------
if (cmd === 'record') {
  const shot = await loadShot(input), out = path.resolve(opt('out', 'take1'));
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, errors } = await openShot(shot, [SEED(shot.seed), SMOOTH, shot.replay && RECORDER(shot.replay)].filter(Boolean));
  await page.waitForTimeout(shot.settle * 1000);
  const nav = watchNav(page);
  await page.evaluate(DIRECTOR_KIT(shot.finger, shot.cropTop)); nav.start(); await page.evaluate(run(shot));
  log('recording live…');
  await Promise.race([nav.left, page.waitForFunction(() => window.__done, null, { timeout: shot.timeout * 1000, polling: 250 })]).catch(() => nav.to || errors.push(`not done after ${shot.timeout} s`));
  if (nav.to) { await browser.close(); navStop(nav.to); }
  const marks = await page.evaluate(() => window.__D.marks), calls = await page.evaluate(() => window.__calls || []), err = await page.evaluate(() => window.__err);
  fs.writeFileSync(path.join(out, 'calls.json'), JSON.stringify(calls, null, 1));
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify(marks, null, 1));
  await page.screenshot({ path: path.join(out, 'last.png') });
  await browser.close();
  for (const m of marks) console.log(`  ${m.t.toFixed(1).padStart(6)}s  ${m.what}`);
  console.log(`\n${calls.length} replayed request${calls.length === 1 ? '' : 's'} saved (${calls.map((c) => c.ms + ' ms').join(', ') || 'none'}); run ${marks.at(-1)?.t.toFixed(1)} s`);
  console.log(`check the outcome in ${path.join(out, 'last.png')} before filming`);
  if (err || errors.length) console.log('page errors:\n  ' + [err, ...errors].filter(Boolean).join('\n  '));
  process.exit(err ? 1 : 0);
}

// Fixed and sticky elements inside the filmed band, so compose can warn when a caption covers one.
const FIXED = ([crop, h]) => { const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e === window.__D.finger) continue; const cs = getComputedStyle(e);
    if ((cs.position !== 'fixed' && cs.position !== 'sticky') || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(), top = Math.round(r.top - crop), bottom = Math.round(r.bottom - crop);
    if (r.width < 4 || r.height < 4 || bottom <= 0 || top >= h) continue;
    out.push([e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.classList[0] ? '.' + e.classList[0] : ''), top, bottom]); }
  return out; };

// ---------- film: replay the recorded run, frame by frame ----------
if (cmd === 'film') {
  const shot = await loadShot(input), take = opt('calls'), out = path.resolve(opt('out', 'film')), debug = !!opt('debug', false);
  const calls = shot.replay ? JSON.parse(fs.readFileSync(path.join(take || usage(), 'calls.json'), 'utf8')) : [];
  fs.rmSync(path.join(out, 'f'), { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'f'), { recursive: true });
  const { browser, page, errors } = await openShot(shot, [SEED(shot.seed), CLOCK(calls, shot.replay || ''), SMOOTH]);
  const cdp = await page.context().newCDPSession(page);
  const snap = (x, y) => cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x, y, width: W, height: H, scale: 1 } }).then((r) => Buffer.from(r.data, 'base64'));
  for (let i = 0; i < shot.settle * FPS; i++) { await page.evaluate((ms) => __advance(ms), 1000 / FPS); await page.waitForTimeout(10); }   // first paints, fonts, entrance animations
  const blank = (await snap(0, 1e5)).length * 1.15;   // the size of an empty frame (a clip outside the viewport), plus a margin
  const nav = watchNav(page);
  await page.evaluate(DIRECTOR_KIT(shot.finger, shot.cropTop)); nav.start(); await page.evaluate(run(shot));
  const MAX = MAX_SECONDS * FPS; let n = 0, tail = 0, why = ''; const sizes = [], rows = [], fixed = [];
  log('filming…');
  while (n < MAX) {
    const jpg = await page.evaluate((ms) => __advance(ms), 1000 / FPS)
      .then(([sx, sy]) => (debug && rows.push([n, (n / FPS).toFixed(3), sx, sy].join('\t')), snap(sx, sy + shot.cropTop)))   // page coordinates: the window starts at the scroll
      .catch(nav.after);
    if (nav.to) { await browser.close(); navStop(nav.to); }
    fs.writeFileSync(path.join(out, 'f', String(n).padStart(5, '0') + '.jpg'), jpg);
    sizes.push(jpg.length); if (debug) rows[n] += '\t' + jpg.length;
    if (n % 15 === 0) { const els = await page.evaluate(FIXED, [shot.cropTop, H]); if (els.length) fixed.push({ t: +(n / FPS).toFixed(2), els }); }
    if (++n % (FPS * 10) === 0) log(`${n / FPS} s filmed`);
    const st = await page.evaluate(() => ({ done: !!window.__done, err: window.__replayError || '' }));
    if (st.err) { why = st.err; break; }
    if (st.done && ++tail > FPS * 0.7) break;
  }
  const marks = await page.evaluate(() => window.__D.marks), err = await page.evaluate(() => window.__err), used = await page.evaluate(() => window.__replayed());
  await browser.close();
  fs.writeFileSync(path.join(out, 'marks.json'), JSON.stringify(marks, null, 1));
  fs.writeFileSync(path.join(out, 'film.json'), JSON.stringify({ frames: n, seconds: n / FPS, fixed }));
  if (debug) { fs.writeFileSync(path.join(out, 'debug.tsv'), 'frame\tt\tscrollX\tscrollY\tbytes\n' + rows.join('\n') + '\n'); console.log(`per-frame scroll and size → ${path.join(out, 'debug.tsv')}`); }
  for (const m of marks) console.log(`  ${m.t.toFixed(1).padStart(6)}s  ${m.what}`);
  console.log(`\n${n} frames, ${(n / FPS).toFixed(1)} s → ${out}`);
  // runs of empty-looking frames (0.5 s or more) usually mean the page drew nothing where the film looked
  for (let i = 0; i < sizes.length; ) { let j = i; while (j < sizes.length && sizes[j] < blank) j++;
    if (j - i >= FPS / 2) console.log(`⚠ frames ${i}–${j - 1} (${(i / FPS).toFixed(1)}–${(j / FPS).toFixed(1)} s) look blank: check them, and rerun with --debug to see the scroll per frame`);
    i = Math.max(j, i + 1); }
  if (calls.length && used !== calls.length) console.log(`⚠ replayed ${used} of ${calls.length} recorded requests: the film and the recording differ; check the director`);
  if (n >= MAX) why = `over ${MAX_SECONDS} s: shorten the shot`;
  if (why || err || errors.length) console.log('problems:\n  ' + [why, err, ...errors].filter(Boolean).join('\n  '));
  process.exit(why ? 3 : err ? 1 : 0);
}

// ---------- compose: cards + captions over the film ----------
const spec = JSON.parse(fs.readFileSync(input, 'utf8')), specDir = path.dirname(path.resolve(input));
// One film, or several (one per page) played back to back with a cut between them. Film k's marks shift by the films
// before it and are also named "k:mark" (1-based), so a caption can hang on "2:start".
const filmOpt = opt('film', false);
const films = (typeof filmOpt === 'string' ? filmOpt.split(',').map((f) => path.resolve(f))
  : [].concat(spec.film ?? 'film').map((f) => path.resolve(specDir, f)));
const marks = [], frames = [], fixed = [];
for (const [i, dir] of films.entries()) {
  const off = frames.length / FPS, info = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
  for (const k of JSON.parse(fs.readFileSync(path.join(dir, 'marks.json'), 'utf8'))) {
    marks.push({ t: k.t + off, what: k.what }); if (films.length > 1) marks.push({ t: k.t + off, what: `${i + 1}:${k.what}` }); }
  for (const s of info.fixed || []) fixed.push({ t: s.t + off, u: Math.min(s.t + 0.5, info.seconds) + off, els: s.els });   // a sample stands for the next 0.5 s of its film
  for (let j = 0; j < info.frames; j++) frames.push(path.join(dir, 'f', String(j).padStart(5, '0') + '.jpg'));
}
const filmLen = frames.length / FPS;
// a time is seconds, or a mark name ("play", or a prefix like "status:Done"), optionally "+1.5" / "-0.4". "end" is the last film's end.
const at = (x) => { if (typeof x === 'number') return x; const m = /^(.*?)([+-]\d+(?:\.\d+)?)?$/.exec(String(x).trim());
  if (m[1] === 'end' && !marks.some((k) => k.what === 'end')) return filmLen + +(m[2] || 0);
  const k = m[1] === 'end' ? marks.findLast((k) => k.what === 'end') : marks.find((k) => k.what === m[1]) || marks.find((k) => k.what.startsWith(m[1]));
  if (!k) { console.error(`no mark "${m[1]}". Marks: ${[...new Set(marks.map((k) => k.what))].join(', ')}`); process.exit(1); }
  return k.t + +(m[2] || 0); };
const caps = (spec.captions || []).map((c, i, all) => ({ ...c, a: at(c.from), b: Math.min(filmLen, at(c.to ?? all[i + 1]?.from ?? filmLen)) }));
const FADE = 0.4;
const cardLen = (c, min) => Math.max(min, need(words(c.title, c.text, c.tag, c.url))) + FADE;   // min = seconds fully visible, after the fade
const INTRO = cardLen(spec.intro, 2.5), END = cardLen(spec.end, 3);
const total = INTRO + filmLen + END - 2 * FADE;
console.log('\nreading check (0.7 s + words/3; captions include their tag):');
let ok = true;
const row = (good, a, b, have, nd, label) => { ok &&= good; console.log(`  ${good ? 'ok   ' : 'SHORT'} ${a.toFixed(1).padStart(6)}–${b.toFixed(1).padStart(6)}  ${have.toFixed(1)} s / ${nd.toFixed(1)} s  ${label.slice(0, 70)}`); };
row(true, 0, INTRO, INTRO - FADE, need(words(spec.intro.title, spec.intro.text, spec.intro.tag)), `intro: ${spec.intro.title}`);
for (const c of caps) { const nd = need(words(c.tag, c.text)); row(c.b - c.a >= nd, c.a, c.b, c.b - c.a, nd, `${c.tag ? c.tag + ': ' : ''}${c.text}`); }
caps.forEach((c, i) => i && c.a < caps[i - 1].b - 0.01 && (ok = false, console.log(`  OVERLAP caption ${i} starts before caption ${i - 1} ends`)));
row(true, total - END, total, END - FADE, need(words(spec.end.title, spec.end.text, spec.end.url)), `end: ${spec.end.url}`);
// a caption bar over a fixed or sticky part of the page (a header, a cookie bar) hides it for the whole caption
const band = (spec.captionAt || 'top') === 'bottom' ? [H - 90, H - 14] : [14, 90];
for (const [i, c] of caps.entries()) {
  const hit = new Set(fixed.filter((s) => s.t < c.b && s.u > c.a).flatMap((s) => s.els.filter(([, t, b]) => t < band[1] && b > band[0]).map(([name]) => name)));
  if (hit.size) console.log(`  COVERS caption ${i} sits over ${[...hit].join(', ')} (fixed or sticky): set captionAt, raise cropTop, or check the preview`);
}
const tooLong = total > MAX_SECONDS;
console.log(`\nfilm ${filmLen.toFixed(1)} s, video ${total.toFixed(1)} s${tooLong ? `  ✗ over the ${MAX_SECONDS} s limit` : ''}   reading ${ok ? 'all ok' : 'HAS SHORT CAPTIONS: move a mark, add a wait in the director, or cut words'}`);
if (!ok) process.exit(2); if (tooLong) process.exit(3);

// draw the cards
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpipe-demo-'));
const server = http.createServer((q, s) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); fs.createReadStream(p).pipe(s); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launch(); const page = await browser.newPage({ viewport: { width: W, height: H } });
const dataUrl = (p) => `data:image/${path.extname(p).slice(1).replace('jpg', 'jpeg')};base64,${fs.readFileSync(path.resolve(specDir, p)).toString('base64')}`;
const font = spec.font && `data:font/${path.extname(spec.font).slice(1)};base64,${fs.readFileSync(path.resolve(specDir, spec.font)).toString('base64')}`;
const draw = async (kind, d, file) => {
  await page.goto(`http://127.0.0.1:${server.address().port}/demo/cards.html`);
  const bad = await page.evaluate(([k, d, th, f]) => window.CARD(k, d, th, f), [kind, d, spec.theme || {}, font]);
  if (bad.length) { console.error(`${kind === 'cap' ? `caption "${d.text}"` : kind + ' card'}: ${bad.join('; ')}. Cut words.`); process.exit(2); }
  await page.screenshot({ path: path.join(tmp, file), omitBackground: kind === 'cap' });
};
await draw('intro', { ...spec.intro, image: spec.intro.image && dataUrl(spec.intro.image) }, 'intro.png');
await draw('end', { ...spec.end, image: spec.end.image && dataUrl(spec.end.image) }, 'end.png');
for (const [i, c] of caps.entries()) await draw('cap', { tag: c.tag, color: c.color, text: c.text, at: spec.captionAt || 'top' }, `cap${i}.png`);
const frame = (t) => frames[Math.min(frames.length - 1, Math.max(0, Math.round(t * FPS)))];
if (opt('preview', false)) {   // one tile per caption, at its midpoint, plus both cards
  const img = (p) => `data:image/${p.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(p).toString('base64')}`;
  const tile = (bg, cap) => `<div><img src="${img(bg)}">${cap ? `<img src="${img(cap)}">` : ''}</div>`;
  const tiles = [tile(path.join(tmp, 'intro.png')), ...caps.map((c, i) => tile(frame((c.a + c.b) / 2), path.join(tmp, `cap${i}.png`))), tile(path.join(tmp, 'end.png'))];
  await page.setViewportSize({ width: 1288, height: 400 });
  await page.setContent(`<style>body{margin:0;background:#fff;display:grid;grid-template-columns:640px 640px;gap:8px}div{position:relative;width:640px;height:360px}
    img{position:absolute;inset:0;width:640px;height:360px}</style>${tiles.join('')}`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const out = input.replace(/\.json$/, '') + '.sheet.jpg';
  await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 85 });
  console.log('preview sheet →', out); await browser.close(); server.close(); process.exit(0);
}
await browser.close(); server.close();

if (opt('check', false)) process.exit(0);

const OUT = path.resolve(opt('out', input.replace(/\.json$/, '') + '.mp4')); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const maxBytes = opt('max-mb', spec.maxMB) ? +opt('max-mb', spec.maxMB) * 1e6 : Infinity;
fs.mkdirSync(path.join(tmp, 'f'));   // every film's frames as one numbered sequence
frames.forEach((p, i) => fs.symlinkSync(p, path.join(tmp, 'f', String(i).padStart(5, '0') + '.jpg')));
const inputs = ['-loop', '1', '-framerate', String(FPS), '-t', String(INTRO), '-i', path.join(tmp, 'intro.png'),
  '-framerate', String(FPS), '-i', path.join(tmp, 'f', '%05d.jpg'),
  '-loop', '1', '-framerate', String(FPS), '-t', String(END), '-i', path.join(tmp, 'end.png'),
  ...caps.flatMap((_, i) => ['-i', path.join(tmp, `cap${i}.png`)])];
let f = '[1:v]format=yuv420p[v0]';
caps.forEach((c, i) => { f += `;[v${i}][${i + 3}:v]overlay=0:0:enable='between(t,${c.a.toFixed(3)},${(c.b - 0.001).toFixed(3)})'[v${i + 1}]`; });
f += `;[0:v]format=yuv420p,setsar=1[in];[v${caps.length}]setsar=1[fm];[2:v]format=yuv420p,setsar=1[en]`;
f += `;[in][fm]xfade=transition=fade:duration=${FADE}:offset=${(INTRO - FADE).toFixed(3)}[x];[x][en]xfade=transition=fade:duration=${FADE}:offset=${(INTRO - FADE + filmLen - FADE).toFixed(3)}[v]`;
for (let crf = +opt('crf', 22); ; crf += 2) {
  log(`encoding at CRF ${crf}…`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', f, '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT], { stdio: 'inherit' });
  const size = fs.statSync(OUT).size;
  if (size <= maxBytes) { console.log(`${OUT}  ${total.toFixed(1)} s  ${(size / 1e6).toFixed(2)} MB  CRF ${crf}`); break; }
  if (crf >= 34) { console.error(`still ${(size / 1e6).toFixed(2)} MB at CRF ${crf}: shorten the film`); process.exit(4); }
}
fs.rmSync(tmp, { recursive: true, force: true });
