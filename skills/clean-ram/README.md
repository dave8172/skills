# clean-ram

**Get your memory back from the processes your coding agent left running.**

Agents start headless browsers, dev servers and mock servers, and often leave them running when the session ends. On a small VPS or cloud VM they pile up until the machine swaps. Say **"clean ram"** and the agent will:

- survey memory, swap, ports and process trees
- stop orphaned browsers and dev servers that nothing is using
- ask before touching other agent sessions, tmux or SSH logins
- never touch services, containers, databases or its own process tree
- report what it stopped, and memory before and after

Linux only. It doesn't need any tools beyond `ps`, `ss` and `/proc`.

## Install

```
npx skills add dave8172/skills --skill clean-ram
```

Claude Code plugin: `/plugin install clean-ram --marketplace dave8172/skills`.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
