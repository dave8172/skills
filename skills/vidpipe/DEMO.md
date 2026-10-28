# vidpipe demo — a real tool in action

A demo shows the real app, tool or game running. It is a short intro card (what it is, the question the run answers), then the run with one caption at a time saying what is happening, then an end card with the URL. Words alone are an explainer (`SKILL.md`), not a demo.

## Fixed rules

- **A real run only.** Every answer from a model or API comes from a live recording (`record`), never typed by hand or edited. If a take doesn't show what you want, record another take or change the setup. Never change what the app did. "A real run, at real speed" is a true label, because the film keeps every recorded latency.
- **Silent, 720p, 30 fps, at most 120 s** (refused over, exit 3). Aim for 30–60 s for a launch or social post, up to 90 s for a full walkthrough. Ask where it will be posted: some launch sites take only a link to a hosted video (such as YouTube), not a file.
- **Readable.** Captions and cards follow the same rule as explainers: **0.7 s + words ÷ 3**, with a caption's tag counted. A caption is one line (a wider one is refused). Captions never overlap. On `SHORT`: move a mark, add a wait in the director, or cut words. Never work around the check (exit 2).
- **One caption at a time, 10 words or fewer.** Each one says what the viewer is seeing or why it matters. Every number says what it applies to. A caption claims only what its frames show.
- **Cost.** `record` runs the app for real. If the app calls a paid API, estimate the cost and tell the user before each take. `film` and `compose` replay the recording and cost nothing.

## Why three steps

Live screen capture drops frames on a small machine: a one-core box managed about 7 fps. So vidpipe records once and films later:

- **`record`** runs the page live and saves the responses of requests that match `replay`, with their latencies.
- **`film`** loads the same real page under a manual clock. Timers, `requestAnimationFrame`, `performance.now`, `Date.now`, and every CSS transition, CSS animation and `element.animate` step exactly 1/30 s per frame. The recorded responses come back after their recorded latency. The film plays at real speed and is smooth on any machine.

Measured on one CPU core: filming 78 s took 4.5 minutes, and encoding the 92 s video took 1.7 minutes.

## Workflow

Same `app` folder and setup as explainers. Keep `shot.mjs`, `video.json` and the take you film next to the product's source (for example `videos/<slug>/`), so a re-cut starts from them. Frames and other takes are temporary.

1. **Plan the story before any code.** It has five parts:
   - the question for the intro card
   - what the user sets up
   - what the app does, beat by beat
   - the result
   - the URL for the end card

   Pick a setup whose real result is worth showing. Try it by hand first, or rehearse with `record`.
2. **Write `shot.mjs`.** Use `<this skill's folder>/examples/demo/shot.mjs` as the pattern.

   | field | default | |
   |---|---|---|
   | `url` | | a URL, or a file next to the shot |
   | `director(D)` | | async function that plays the viewer, run inside the page |
   | `cropTop` | 0 | px cut off the top of the window; the viewport is 1280 × (720 + cropTop). Suits a fixed or sticky header. If the header scrolls away with the page, a scrolled film loses that much page instead: use 0 |
   | `replay` | none | substring of request URLs to record and replay. Fetch only. Omit if nothing comes from a server. |
   | `seed` | 1 | seeds `Math.random`, so the page makes the same choices in record and film |
   | `settle` | 1 | seconds after load before the director starts |
   | `timeout` | 180 | seconds `record` waits for the director |
   | `finger` | | `{ fill, ring }` colours of the tap dot |

   **`D`, inside the page** (waits run on the page's clock, so one director works live and filmed):

   | call | does |
   |---|---|
   | `D.tap(target, mark?)` | moves the visible finger to a selector or element, presses, clicks |
   | `D.press(target, mark?)` | the same press, without the click. Ends a shot on a link (see "Several pages") |
   | `D.type(target, text, perSecond = 14)` | taps the field, then types into it character by character |
   | `D.point(target)` | moves the finger without clicking. If the target is off screen, the page glides until it is at least 100 px clear of the top (below `cropTop`) and bottom, where captions sit |
   | `D.wait(ms)` | pause |
   | `D.until(selector or fn, timeout?)` | waits for the app; use this for app work, never a fixed wait |
   | `D.on(selector, fn)` | runs `fn(el)` once for each matching element that appears: approval prompts, dialogs |
   | `D.mark(name)` | a named moment; captions hang on marks |
   | `await D.scroll(target, top, ms = 600)` | glides an element, or the page when target is `null`, to `top` px. `ms` 0 jumps |
   | `D.$`, `D.$$` | `querySelector`, and `querySelectorAll` as an array |

   Tips:
   - **Mark every beat a caption will hang on.** For app states, observe a status element and mark each change: `new MutationObserver(() => D.mark('status:' + el.textContent)).observe(el, { childList: true, characterData: true, subtree: true })`. A caption can then start at `"status:Done"`.
   - **Prompts:** answer prompts after about 2.5 s, so the viewer can read them.
   - **Captions:** keep them over a band of the page that doesn't change (`captionAt` top or bottom) and scroll what you caption into view.
   - **Scrolling:** use `D.scroll` or `D.point`, never a jump. The page's own smooth scrolls also glide on the film's clock.
   - **Ending:** hold 3–5 s on the result.
3. **Record:** `node demo.mjs record shot.mjs --out take1`. No `replay` (a static site, or nothing comes from a server)? `record` is then only a rehearsal: it checks the marks and the last frame, and `film` needs no `--calls`. Look at `take1/last.png` and the marks. Does the run show what the captions will say? If not, record `take2`: model answers vary from run to run.
4. **Film:** `node demo.mjs film shot.mjs --calls take1 --out film`. If it warns that it replayed a different number of requests, the director took a different path. Make it deterministic. If it warns that frames look blank, look at them; `--debug` writes each frame's scroll position and size to `film/debug.tsv`.
5. **Write `video.json`.** Use `examples/demo/video.json` as the pattern.

   | field | |
   |---|---|
   | `intro` | `{ title, text?, tag?, image? }`. `text` is a string or a list of lines. `tag` is a small label, such as "A real run, at real speed". `image` is a path. |
   | `end` | `{ title, url, text?, image? }` |
   | `film` | the film folder, or a list of them, one per page (see "Several pages"). `--film` overrides it |
   | `captions` | `[{ from, to?, tag?, color?, text }]`. A time is seconds, or a mark name (`"play"`, or a prefix such as `"status:Done"`), optionally with an offset (`"play+5.2"`). `to` defaults to the next caption's `from`, or the film's end. |
   | `captionAt` | `"top"` (default) or `"bottom"` |
   | `theme` | colours: `paper ink mute acc card` |
   | `font` | a `.woff2` path, for the product's own typeface |
   | `maxMB` | size cap; same as `--max-mb` |

   Card times come from the reading rule, so keep the intro short.
6. **Check:** `node demo.mjs compose video.json --film film --check`. `COVERS` means a caption sits over a fixed or sticky part of the page, such as a header. Move the caption (`captionAt`), cut the header off with `cropTop`, or confirm in the preview that nothing important is hidden.
7. **Preview:** run the same command with `--preview` and look at `video.sheet.jpg`. Check that each caption is true for its frame and covers nothing that matters.
8. **Render:** `--out out/<slug>.mp4 [--max-mb 5]`. If the file is over the cap, vidpipe raises the CRF until it fits. App UIs compress well: 92 s at CRF 22 was 2.5 MB.
9. **Report** the path, length, size and caption list. Say how it was made (recorded live, filmed frame by frame), so the user can describe it truthfully.

## Several pages

A shot films one page. A click that loads a new page ends the director, so `record` and `film` stop with an error. Film a multi-page walkthrough as one shot per page:

1. End each shot on the link with `D.press('a.next', 'leave')`: the viewer sees the tap, and nothing navigates.
2. Start the next shot's `url` at the page that link opens, and record and film it on its own.
3. Join them in `video.json`: `"film": ["film-home", "film-category", "film-item"]`, or `--film film-home,film-category,film-item`. They play back to back with a cut between them. A mark in film 2 or later is also named `"2:start"`, `"3:leave"` and so on; a plain name finds the first film that has it. `"end"` is the last film's end.

The cut skips the page load, so the time across a cut isn't real. Don't caption speed across a cut.

## What the clock doesn't cover

- **Durations the page measures itself** read as 0 or close to it, for example span times in a trace or "took 1.2 s". Recorded latencies are kept. Don't caption those numbers, and mention it if they are visible.
- **Not recorded:** XHR, WebSocket and EventSource requests. A streamed response replays whole, at the end of its latency. Requests that `replay` doesn't match go to the real network during filming.
- **Not stepped:** `<video>`, `<audio>`, timers inside workers, and anything that reads real time some other way.
- **Smooth scrolling** is the page clock's: CSS `scroll-behavior: smooth` is turned off, and every scroll asked for with `behavior: 'smooth'` glides on the clock. A click on a `#anchor` link jumps.
