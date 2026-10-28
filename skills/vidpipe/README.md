# vidpipe

**Short, silent videos that people can actually read: explainers from articles, and demos of real apps.**

Give your agent an article (a URL, a Markdown file, a README). It writes a scene list from the article's own facts and renders a 720p MP4: animated captions, numbers, charts and diagrams. No audio, at most 60 seconds.

- **Paced for reading.** Each piece of text gets 0.7 s + words ÷ 3 (subtitle pace, about 180 words a minute), and text that shares the screen adds up: the check reads like one viewer, block by block. If anything would flash by, the renderer refuses and names the scene to fix.
- **Hard limits.** 720p, 30 fps, no sound, 60 s maximum. Text is never shrunk to fit; too much text is an error.
- **Facts from the article only.** The skill tells the agent to use the article's own numbers and never to invent figures.
- **Check before you wait.** `--check` reports timing in about a second. `--preview` draws one contact sheet. Only then does it do the full render.

## Install

```
npx skills add dave8172/skills --skill vidpipe
```

Claude Code plugin: `/plugin install vidpipe --marketplace dave8172/skills`.

Then ask: *"turn this article into a video: <url>"*.

**Needs:** Node 18+, `ffmpeg`, and a Chromium. The agent installs Chromium through Playwright on first use. To use a browser you already have, set `VIDPIPE_CHROME`. Rendering runs on your machine. Chat apps whose sandbox can't install npm packages or run a browser can still write the spec for you to render elsewhere.

## Without an agent

```bash
cp -r skills/vidpipe/app vidpipe && cd vidpipe && npm install && npx playwright install chromium
node render.mjs ../skills/vidpipe/examples/dns.json --check      # timing report
node render.mjs ../skills/vidpipe/examples/dns.json --preview    # contact sheet
node render.mjs ../skills/vidpipe/examples/dns.json --out dns.mp4
```

The spec format and every scene type are in [`SKILL.md`](SKILL.md).

## Demo mode

Ask for *"a demo video of <your web app>"*. The agent scripts a viewer (taps, typing, waits) and films the real page running, then adds an intro card, captions and an end card.

- **Real run, real speed.** `record` runs the app live once and saves the answers from its server or model, with their latencies. `film` replays them into the real page under a manual clock, one exact 1/30 s frame at a time, so the video is smooth even on a one-core machine that can't capture live. Answers are never written by hand.
- **Same reading rule.** Captions and cards get 0.7 s + words ÷ 3. Captions must fit on one line. At most 120 s.
- **Fits a size cap.** `--max-mb 5` raises the compression until the file fits.
- **Several pages.** Film one shot per page and join them in one video, with a cut between pages.
- **Catches common mistakes.** It warns about runs of blank frames and captions that sit over a fixed header.

```bash
cd vidpipe
node demo.mjs record ../skills/vidpipe/examples/demo/shot.mjs --out take1    # live run
node demo.mjs film ../skills/vidpipe/examples/demo/shot.mjs --calls take1 --out film
node demo.mjs compose ../skills/vidpipe/examples/demo/video.json --film film --preview
node demo.mjs compose ../skills/vidpipe/examples/demo/video.json --film film --out tiny.mp4 --max-mb 5
```

Measured on one CPU core: filming 78 s of a web app took 4.5 minutes; encoding the 92 s video took 1.7 minutes and gave 2.5 MB. How to write a shot, and what the clock doesn't cover: [`DEMO.md`](DEMO.md).

## Good to know

- **Speed:** about 4 minutes for 30 s of video on one CPU core, faster with more cores; about 250 MB of RAM. `--blur 1` skips motion blur and is faster.
- **Scenes:** general ones (title, statement, big number, bar chart, A-vs-B, slider, flow diagram, end card) plus a set for ML/LLM articles (tokens, vectors, attention heatmap, generation loop).
- **Look:** warm paper background, one accent colour, Inter Tight and JetBrains Mono. Override colours with `theme` in the spec.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
