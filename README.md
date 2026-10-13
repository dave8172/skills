# skills

**Agent skills you can drop into Claude Code, Codex, Cursor, Gemini CLI, Copilot, OpenCode or a chat app.** Each skill is a folder with a `SKILL.md`. Install one or all of them, or copy them into your own pipeline.

| Skill | What it does |
|---|---|
| [**upsweep**](skills/upsweep) | Finds Upwork jobs that match your filters, and sums up what clients in your niche keep asking for. Uses Upwork's official MCP, with your own login. |
| [**vidpipe**](skills/vidpipe) | Turns an article into a silent 720p explainer video of at most 60 s, paced so every word can be read. |
| [**clean-ram**](skills/clean-ram) | Frees memory on a small Linux machine by stopping the browsers and dev servers that agent sessions left behind. |

## Install

**Any agent** (asks which agents to install into):

```
npx skills add dave8172/skills                      # pick from the list
npx skills add dave8172/skills --skill vidpipe      # just one
npx skills add dave8172/skills --skill '*'          # all of them
```

To update later, run `npx skills update`.

**Claude Code plugin:**

```
/plugin install vidpipe --marketplace dave8172/skills      # one skill (or upsweep, clean-ram)
/plugin install all --marketplace dave8172/skills          # every skill
```

On Claude Code older than 2.1.275, run `/plugin marketplace add dave8172/skills` first, then `/plugin install <name>@dave8172-skills`.

**Claude on the web or desktop:** download this repo as a ZIP and upload a skill's folder (for example `skills/vidpipe`) under Customize → Skills.

**Anything else:** each folder is plain Markdown plus scripts. Copy it wherever your agent reads instructions from.

Each skill's README covers what it needs and what it costs to run.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
