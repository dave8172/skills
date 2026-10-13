---
name: clean-ram
description: Free memory on a small Linux machine (VPS, cloud VM, dev box) by finding and stopping processes that coding-agent sessions left behind, such as orphaned headless browsers, stale dev servers and test servers. Reports memory before and after. Use only when the user explicitly asks to clean up or free RAM or memory, or runs /clean-ram.
---

# clean-ram

Coding agents leave processes running after a session ends: headless Chrome from browser automation, `next dev`, `vite`, `wrangler dev`, `python -m http.server`, mock servers. On a machine with a few GB of RAM they pile up until it swaps. Find them, stop the safe ones, ask about the rest, and report.

Linux only (it reads `/proc` and cgroups). Run each command yourself and read the output; don't ask the user to run them.

## 1. Survey (read-only)

```bash
free -m; uptime
ps -eo pid,ppid,user,etime,rss,tty,cmd --sort=-rss | head -40
ss -ltnp                                    # listening ports and who owns them
who; tmux ls 2>/dev/null                    # logins and terminal sessions
docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null
```

Swap hogs: `grep VmSwap /proc/[0-9]*/status | sort -k2 -n -r | head`.

For each suspect PID, read `readlink /proc/PID/cwd` and `cat /proc/PID/cgroup`:

- `system.slice/<name>.service` or `docker-…scope` / `containerd`: a managed service. **Keep.**
- `user.slice/…/session-N.scope` with PPID 1: started by hand in an old shell or agent session, then orphaned. **Candidate.**

## 2. Stop without asking

- `chrome-headless-shell`, `chrome --headless`, Playwright or Puppeteer browsers orphaned to PPID 1, unless the current session clearly started them in the last hour
- Dev servers orphaned to PPID 1: `next-server`, `next dev`, `vite`, `wrangler`/`workerd`, `esbuild --service`, `npm run dev`, `python -m http.server`, `node mock*.js`, and the like
- Anything whose cwd is a temp or scratch directory, or shows `(deleted)`
- Duplicate copies of the same server started from the same directory

Before stopping a server, check that nothing is using it: no established connections (`ss -tnp state established | grep :PORT`), and the port isn't the target of a reverse proxy (nginx, Caddy, a tunnel).

## 3. Ask first

- Other agent sessions (not the current one). Show tty, age, cwd and how long since activity, and let the user pick.
- tmux or screen sessions, SSH logins
- Anything large, recently started, or unclear

## 4. Never stop

- The current agent process and its ancestors. Walk the PPIDs up from `$$` and exclude every one.
- systemd services, databases, web servers, SSH, VPN and container runtimes
- Containers. They were deployed on purpose.
- Anything the user says is in use

## 5. How to stop (gotcha)

**Don't use `pkill -f <pattern>` or `pgrep -f <pattern>`.** An agent's shell carries the pattern in its own command line, so `-f` matches your own shell and kills it. Collect PIDs first, then stop by PID:

```bash
PIDS=$(pgrep chrome-headl)            # without -f, pgrep matches the process name only
kill -TERM $PIDS; sleep 3
for p in $PIDS; do kill -0 $p 2>/dev/null && kill -KILL $p; done
```

## 6. Report

A short table: what was stopped, its age, and why it was safe. Then available RAM and swap used, before and after. Last, list anything left running that the user may want to decide on.
