# upsweep

**Find Upwork jobs that match your filters, and see what clients in your niche keep asking for.**

A skill for AI agents: Claude Code, Codex, Cursor, Gemini CLI, Copilot, OpenCode and others. It uses Upwork's official MCP, so it reads Upwork through your own login. No scraping, and no extra keys.

Say **"upsweep"** and you get:

1. **Matching jobs:** every job that passes your filters (verified payment, posted recently, few proposals, a client who actually hires, client location), newest first. Each comes with the link and the Connects cost.
2. **What those clients ask for:** the problems they describe most, the tools they name (including ones missing from your profile), what they screen applicants on, typical budgets, and how fast posts fill up.

## Install

```
npx skills add dave8172/skills --skill upsweep
```

This works for most agents; it asks which ones to install into. To get the latest rules and fixes later, run `npx skills update upsweep`. Then say **"upsweep"**. If Upwork isn't connected yet, the skill sets it up or shows you how. That's usually one command, then signing in to Upwork.

Claude Code plugin: `/plugin install upsweep --marketplace dave8172/skills`.

For Claude on the web or desktop, download [the repo](https://github.com/dave8172/skills) as a ZIP, upload the `skills/upsweep` folder under Customize → Skills, and add the Upwork connector.

## First run

The skill reads your Upwork profile and proposes your searches and filters in one message. Reply **ok**, or change anything in plain words.

| Filter | Default | Why |
|---|---|---|
| Payment verified | yes | The client has a payment method on file |
| Posted within | 5 days | Clients who hire usually do it within 3–5 days |
| Proposals | under 20 | Past that, a good proposal gets buried |
| Client hire rate | 80%+ | Some clients post and never hire. New clients are shown and labelled |
| Hourly floor | 60% of your profile rate | Hides the bargain-bin posts |
| Fixed-price floor | $100 | Same |
| Client location | any | Keep only, or exclude, the countries or regions you name |

## What a sweep looks like

The shape of a report. Your counts come from your own sweep; nothing is kept afterwards.

> **Matches (newest first):** linked title · posted · client country · budget · proposals · client hire rate and spend · Connects
>
> **One filter away:** up to 5 jobs, each with its client country and the filter it missed
>
> **What these clients ask for (out of N jobs):**
> - the problems they describe most, each with a count
> - the tools they name, with ✗ on any missing from your profile skills
> - what they screen applicants on, counted from the postings read in full
> - typical budgets, and how many already had 20+ proposals

## Then

- **"draft 2"**: a short proposal draft for job 2. The hook comes first, then your real proof, then a question. Put it in your own words, then submit it on Upwork, or say **"send"** and the agent shows you Upwork's preview to approve.
- **"change filters"**: edit them in plain words.

## Plays by Upwork's rules

Upwork's [API & MCP Terms](https://www.upwork.com/legal#apimcpterms) set the limits, and upsweep stays inside them:
- It runs only when you ask, never on a schedule.
- It uses only your search terms and filters, and never ranks jobs by its own judgment.
- It stores no job data. Only your settings are saved, in `~/.upsweep/profile.md`.
- A sweep only reads. A proposal is sent only after you approve Upwork's preview for it, one at a time.

## Good to know

- **Cost:** a sweep is about 25–30 read-only calls and takes about 3 minutes. Measured on Claude Opus through the API, it was ~$1.75 including setup; on a subscription it uses your plan.
- **Agent support:** tested on Claude Code. Connection steps for every other agent are in [`connect.md`](connect.md).
- **Not affiliated with Upwork.** Upwork is a trademark of Upwork Inc.; this project is unofficial and not endorsed by Upwork.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
