---
name: close-session
description: End a working session cleanly so the next one continues without re-reading, re-asking or re-discovering. Saves only what is worth keeping (state, decisions, preferences, gotchas) into the user's existing memory or notes system in compact, sectioned form, or recommends a minimal one if there is none. Then reports what is still open: uncommitted work, unkept promises, the next step. Use when the user says "close the session", "log the useful things and close cleanly", "wrap up", "save context for next time", or runs /close-session.
---

# close-session

**Goal:** the next session picks up where this one stopped, at the lowest token cost. That means two jobs:
1. Save what is worth keeping, compactly, where the next session will find it.
2. Report what is still open, so nothing is lost.

## Rules

- **Save only what the next session will act on and can't get cheaply elsewhere.** Skip what the code, git history, docs or an existing note already say. Never write a recap of the conversation.
- **One fact, one place.** Update the existing line. Never add a second copy. Delete lines that turned out wrong.
- **Compress at write time.** One line per fact where possible, with the reason in one clause.
- **Absolute dates** (`2026-10-13`), never "today" or "last week".
- **Strict sections with stable headings,** so a later session runs `grep -n '^## '` and reads one section instead of the whole file.
- **Indexes stay small.** They are read every session. One line per entry.
- **Never store secret values.** Store where a secret lives (a path or an env var name), never the value. Store other people's personal details only if the user asks.
- **Never commit, push, deploy or delete** unless the user or the project's own rules say to. **Never stop processes:** another session may still be using them.
- **The user's existing system wins.** Its file names, formats and rules override the defaults here.

## 1. Find the memory system

Read cheaply: headings, indexes and file lists, not whole files. Check in this order:

1. **The harness's own memory.** The system prompt may name a memory directory or tool. Claude Code's auto memory, for example, uses `MEMORY.md` plus one file per fact. Use it for facts about the user and how they work.
2. **Instruction files:** `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.windsurfrules`. These often say where logs and notes go, and how to keep them.
3. **Notes folders:** `memory/`, `.memory/`, `notes/`, `progress/`, `docs/decisions/`, `docs/adr/`, `HANDOFF.md`, `TODO.md`.
4. **A notes service** (Notion, Obsidian, a memory MCP server), only if the instructions name it as the place for this.

- **Found one:** use it as it is.
- **Found several:** each fact goes to the one whose job it is. Never write the same fact to two places.
- **Found none:** go to step 1b.

### 1b. No memory system

In three lines, recommend the minimal system in `memory-system.md` (in this skill's folder; read it only now). Then ask once: "Set it up here? Commit it to git, or keep it out?"

- **Yes:** create it. Make only the files you have content for, plus the pointer in the instruction file. Without that pointer, the next session never reads the memory.
- **No, or you can't write files** (a chat app, a read-only folder): output a handoff block (see step 5) for the user to paste into their project notes or custom instructions.

## 2. Pick what to save

Go through the whole session. If the context was compacted, the summary counts as part of it. Don't claim anything that isn't in either.

| Kind | Example | Usually goes to |
|---|---|---|
| **State** | done, in progress, the exact next step, blockers | the handoff section, rewritten each close |
| **Decision** | chose X over Y, because Z | decisions |
| **Preference or correction** | "don't mock the DB", "answers in one paragraph" | user memory. The instruction file only if the user asked for a standing rule |
| **Fact or gotcha** | a measured number, an error and its fix, a version quirk | the topic's file and section |
| **Pointer** | where a dashboard, doc, ticket or secret lives | references |

**The test for each line:** would the next session do worse without it? If not, drop it.

- **Drop:** anything already stored (check the index first, and update instead of adding), dead ends that won't come up again, chit-chat.
- **Scope:** decide whether a fact is about the user (true across projects), about one project, or about one session only (drop those). Files committed to a shared repo get no personal data.
- **Several projects touched:** each fact goes to its own project.
- **The user said not to save something:** don't save it.

## 3. Write

- **Before editing,** read the index and only the target section. Find it with `grep -n '^## '` and read that line range. Re-read the section right before editing, because a parallel session may have changed it.
- **Edit in place.** Replace stale lines, merge duplicates, delete wrong ones. Make one batched edit per file.
- **Entry format:** follow the file's existing format. The default is `- 2026-10-13 · <fact>. Why: <clause>`.
- **A new file** gets one index line, `- [Title](file.md) — hook`. Write the hook in the words a future question would use.
- **Index too long:** if the index nears its load limit (Claude Code loads the first 200 lines of `MEMORY.md`), merge entries instead of adding.
- **The handoff** is rewritten, never appended, and is at most 10 lines:
  - the goal
  - what's done
  - the next step, as a command or `file:line`
  - open questions
  - anything still running or uncommitted
- **Don't re-read files to check your writes.** A failed write shows up as a tool error.

## 4. Check what is still open

Report these. Don't fix them:
- **Running:** processes you know this session started (dev servers, watchers, background jobs). List them, but never stop them, because another session or the user may still be using them.
- **Uncommitted or unpushed work:** each repo, with its count of changes. Commit only if allowed (see Rules), and only your own files.
- **Promises not kept:** anything you said you'd do but didn't goes into the handoff.

## 5. Report

Keep it this short:

```
Saved:
- <file> § <section>: <what, in a few words>
Skipped: <only if something notable was left out, and why>
Left open: <uncommitted, running or blocked work, or "nothing">
Next session: "<a one-line prompt to resume>"
Safe to close.
```

If nothing was worth saving, say so and write nothing.

**Handoff block,** for setups where you can't write files. Fenced, at most 15 lines, with these sections:
- Goal
- State
- Decisions (with why)
- Next step
- Gotchas
- Where things are
