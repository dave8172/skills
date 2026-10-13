# A minimal memory system

For a user with no memory or notes system yet. The design goal is that a new session reads as little as possible and still knows where to look.

## Layout

```
AGENTS.md or CLAUDE.md     the instruction file the agent already loads; add the pointer below
memory/
  INDEX.md                 read every session; at most 100 lines
  decisions.md             one line per decision, under ## <topic>
  facts.md                 gotchas, measured numbers, how-tos, under ## <topic>
  refs.md                  links, dashboards, where secrets live (never their values)
  user.md                  the user's preferences and corrections (personal: see Git below)
  log/YYYY-MM.md           optional: dated one-line entries; never read whole
```

Create only `INDEX.md`, plus the files you have content for now. An empty file still costs a read.

**The pointer** goes in the instruction file. Without it, the next session never opens the memory:

```
## Memory
Read `memory/INDEX.md` at the start. Read other memory files one section at a time (`grep -n '^## '`, then that range).
```

## INDEX.md

```
# Memory index

## Now
<the handoff: rewritten at every close, at most 10 lines>
- Goal:
- Done:
- Next:
- Open:

## Files
- [Decisions](decisions.md): what we chose and why; sections: auth, storage, deploy
- [Facts](facts.md): gotchas and measured numbers; sections: build, api, tests
```

## Entries

- **Format:** one line, `- 2026-10-13 · <fact>. Why: <clause>`
- **Headings:** a heading is a topic, and stays the same once created, because other notes and future searches refer to it.
- **Newest information wins:** fix the old line instead of adding a contradicting one.

## Git

- **Project knowledge** that teammates should share (decisions, facts, refs): commit it.
- **Personal notes** (`user.md`, the handoff if it's personal): add them to `.gitignore`, or keep them in the harness's user-level memory if there is one.
- **Claude Code** already has a per-user auto memory. Use that for facts about the user, and this folder for project facts.

## Keeping it small

When a file passes about 200 lines:
- merge similar lines
- drop facts that are stale or now visible in the code
- move finished log months out of the index

The size limit is what keeps every future session cheap.
