# close-session

**End a session so the next one starts where you left off, without re-reading everything.**

Say **"close the session"** (or run `/close-session`) before you quit, and the agent will:

- find your memory or notes system (an agent's built-in memory, `CLAUDE.md`, `AGENTS.md`, a `notes/` folder) and follow its rules
- save only what the next session needs: where the work stands, decisions and why, your corrections, gotchas, pointers
- write it compactly, one line per fact under fixed headings, so a later session reads one section instead of a whole file
- update or delete old entries instead of adding duplicates
- stop processes the session started, and list uncommitted work
- give you a one-line prompt to resume with

No memory system yet? It recommends a small one (an index file plus topic files) and sets it up if you agree. In a chat app with no files, it gives you a handoff block to paste instead.

It never stores secret values, and it never commits, pushes or deletes your work unless you or your project's rules say so.

## Install

```
npx skills add dave8172/skills --skill close-session
```

Claude Code plugin: `/plugin install close-session --marketplace dave8172/skills`.

Needs nothing else. Works in any agent that reads `SKILL.md` files.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
