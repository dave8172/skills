# clean-ram

**Get your memory back from the processes your coding agent left running.**

Agents start headless browsers, dev servers and mock servers, and often leave them running when the session ends. On a small VPS or cloud VM they pile up until the machine swaps. Say **"clean ram"** and the agent will:

- survey memory, swap, ports and process trees
- list orphaned browsers and dev servers, with why each looks safe to stop or why it might still be needed (connections, a reverse proxy, another agent session in the same folder)
- stop only the ones you approve, after checking each PID is still the same process
- never touch services, containers, databases or its own process tree
- report what it stopped, and memory before and after

Linux only. It doesn't need any tools beyond `ps`, `ss` and `/proc`.

## Install

```
npx skills add dave8172/skills --skill clean-ram
```

Claude Code plugin: `/plugin install clean-ram --marketplace dave8172/skills`.

MIT licensed. Made by [@dave8172](https://x.com/dave8172).
