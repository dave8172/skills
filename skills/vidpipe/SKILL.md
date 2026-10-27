---
name: vidpipe
description: Make short silent videos, paced so every word can be read. Two modes. Explainer turns an article, blog post or doc into a 720p MP4 of at most 60 seconds with animated text, charts and diagrams. Demo films a real web app, tool or game in action (a live run recorded, then replayed frame by frame at real speed) with an intro card, captions and an end card. Both check the reading time, preview, then render with headless Chromium and ffmpeg. Use when the user asks to turn an article, post, README or URL into a video, explainer, reel or clip; for a demo, walkthrough or screen recording of an app, tool or game, or a video that shows it working; or runs /vidpipe.
---

# vidpipe — silent explainer and demo videos

**Pick the mode first, from the user's words.**
- **Explainer** ("explain", "turn this article into a video"): words, numbers and diagrams from an article. This file.
- **Demo** ("demo", "walkthrough", "show it working", "screen recording", a video of an app, tool or game): the real thing running, with a short intro and captions over it. **Read `DEMO.md` in this folder and follow it instead of the workflow below.** Never hand over an explainer when a demo was asked for.
- Unclear? Ask which one, in one line.

You write one JSON **spec** (a list of scenes) from the article. The bundled renderer turns it into a 720p, 30 fps MP4 with **no audio**. Timing comes from a reading rule, so text never flashes by.

## Fixed rules

- **Silent.** No voice-over and no music. The words on screen carry the whole story.
- **720p, 30 fps.** These are fixed.
- **60 s maximum.** The renderer refuses longer specs (exit 3). Aim for 25–45 s.
- **Readable.** Each text block needs **0.7 s + words ÷ 3** (3 words a second, about 180 words a minute: the usual pace for subtitles; people read plain prose faster, near 240 a minute, but here they also watch the picture). Numbers count as words. **Text that shares the screen adds up:** the check reads like one viewer, block by block in the order they appear, so a caption, a second caption and a list on one scene need the sum of their times, not each one's alone. Text may not shrink below a readable size or run off screen. If either rule fails, the renderer refuses (exit 2). Fix the spec. Never work around the check.
- **Every number says where it applies.** On the same frame as the number, name what it was measured on: the model, dataset, product or condition ("92% on model X's test set", not just "92%"). A badge in the corner is not enough. The first time an unfamiliar name appears, say in a few words what it is ("a small open model").
- **Only the article's facts.** Use its own numbers, names and examples. Never invent or round a figure the article doesn't give. If it has no numbers, use `statement` and `flow` scenes.

## Setup (once per machine)

Needs Node 18+ and `ffmpeg` on PATH. The skill folder may be read-only, so copy the app to a working directory:

```bash
cp -r <this skill's folder>/app ./vidpipe && cd vidpipe
npm install
npx playwright install chromium   # or: export VIDPIPE_CHROME=/path/to/chrome-or-chromium
```

If a step fails (no network, no ffmpeg), tell the user exactly what is missing. Still write the spec, so they can render it elsewhere.

## Workflow

1. **Read the article.** Fetch the URL or open the file. Pull out only the core idea, the 3–6 key steps or claims, the exact numbers, one concrete example, and the canonical URL.
2. **Plan 5–8 scenes.** Open with a `title`. Give each scene one idea. End with an `end` card that shows the article's URL. Ask the user for the URL if you don't have it; never make one up. **For newcomers, lead with the problem and one worked example; technical terms come last**, each in plain words. Use short, plain sentences: one idea, active voice, common words.
3. **Write the spec** as `specs/<slug>.json`, using `<this skill's folder>/examples/dns.json` as a pattern. Keep captions to **7 words or fewer**, one line each. Charts take **5 rows or fewer**. Prefer one caption per scene: a second caption costs its full reading time on top of the first. Keep the spec next to the video's source (not only in a temp folder), so a later re-cut starts from it.
4. **Check:** `node render.mjs specs/<slug>.json --check`. It prints every text block's time on screen (after the blocks before it are read) against the time needed, plus any layout problems. To fix a `SHORT` block, cut words or add `"hold": <seconds>` to that scene. For `TOO SMALL`, use fewer or shorter items. Over 60 s: cut words or whole scenes. Fewer words is the only real lever.
5. **Preview:** `node render.mjs specs/<slug>.json --preview` writes `specs/<slug>.sheet.jpg`, one frame per scene. Look at it once. Check for clipped or overlapping text and anything that misstates the article.
6. **Render:** `node render.mjs specs/<slug>.json --out out/<slug>.mp4`. About 4 minutes for 30 s of video on one CPU core, faster with more cores. Options: `--blur 1` turns off motion blur (fastest). `--workers N` sets parallel browsers; the default is one per core.
7. **Report** the MP4 path, its length, and the scene list in one line each. Don't paste the spec unless asked.

## Spec format

```json
{ "series": "Networking basics",      // optional: small header top-left, and the end card's kicker
  "badge": "v2.1",                    // optional: pill top-right
  "theme": { "acc": "#2f78e3" },      // optional colour overrides: paper ink mute faint line card acc accT
  "scenes": [ ... ] }
```

Every scene except `title` and `end` takes an optional `caption`. That is a string, or `[line1, line2]`, where line 2 appears later in a muted colour. It also takes an optional `chapter`, a label in the bottom progress bar (`columns` accepts `[ch1, ch2]`). Any scene accepts `hold`: extra seconds on screen.

**General scenes:**

| type | fields | shows |
|---|---|---|
| `title` | `title`, `sub?` | big title with a blinking cursor |
| `statement` | `text` (`\n` between lines), `sub?`, `muteLine?` (index of a line to mute), `size?` | one big centred sentence |
| `stat` | `value` (e.g. `"538 MB"`, counts up), `label`, `sub?` | one huge number |
| `bars` | `rows[[label, value]]`, `header?`, `unit?`, `decimals?`, `highlight?`=0, `max?` | horizontal bar chart |
| `compare` | `items[{label, value, sub?, amount}]`, `highlight?` | A vs B: labelled bars with big values |
| `steps` | `rows[]`, `stops[{at, values[], label?, hold?}]`, `ticks?`, `label`, `ends?[left, right]`, `unit?`, `axisMax?`=100 | bars that change as a slider moves from stop to stop |
| `flow` | `nodes[]` (≤ 6), `loop?`, `highlight?`, `note?` | boxes and arrows with a travelling pulse |
| `end` | `url`, `next?` (`"Next: Title"`, the text after `:` is bold), `kicker?` | end card |

**For ML / LLM articles** (token strings: a leading space shows as `·`, tokenizer style):

| type | fields | shows |
|---|---|---|
| `tokens` | `tokens[]`, `sub[]?` (ids), `prompt?`, `label?` | a prompt is typed, then splits into coloured token chips |
| `columns` | `tokens[]`, `layers?`=30, `cells?`=12, `attention?`=true, `counter?` | each token becomes a vector column; layers sweep through |
| `sequence` | `prefix[]`, `generated[]`, `loop?`=true, `note?`, `gap?`=0.3 | tokens appended one by one, with a loop-back arrow |
| `heatmap` | `rows[]` (≤ 8), `cols?`=rows, `values[[...]]`, `causal?`=true, `highlightRow?`, `max?`=1, `decimals?`=2, `note?`, `colLabel?` | attention-style grid |
| `matrix` | `label`, `meta` | a "file of numbers" card (model weights) |

**Rough timing:** a title takes about 3 s, a caption with a visual 4–6 s, an end card about 4 s.

## Extending

Scene types live in `app/engine/engine.js` in the object `T`. Each has `plan` (timings and the text blocks the reading check measures), `build` (the DOM, on a 1920×1080 stage) and `render(u)` (draws local time `u`). A new type must declare all its text in `plan`, so the reading check covers it.
