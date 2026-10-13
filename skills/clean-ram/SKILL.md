---
name: clean-ram
description: Free memory on a small Linux machine (VPS, cloud VM, dev box) by finding processes that coding-agent sessions left behind, such as orphaned headless browsers, stale dev servers and test servers. It shows what looks safe to stop and why, stops only what the user approves, and reports memory before and after. Use only when the user explicitly asks to clean up or free RAM or memory, or runs /clean-ram.
---

# clean-ram

Coding agents leave processes running after a session ends: headless Chrome from browser automation, `next dev`, `vite`, `wrangler dev`, `python -m http.server`, mock servers. On a machine with a few GB of RAM they pile up until it swaps. Find them, show the user what looks safe to stop and why, stop only what they approve, and report.

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

## 2. Classify (still read-only)

Sort every candidate into one of three groups.

**Likely leftovers.** Propose these, but don't stop them:
- `chrome-headless-shell`, `chrome --headless`, Playwright or Puppeteer browsers orphaned to PPID 1
- dev servers orphaned to PPID 1: `next-server`, `next dev`, `vite`, `wrangler`/`workerd`, `esbuild --service`, `npm run dev`, `python -m http.server`, `node mock*.js`, and the like
- anything whose cwd is a temp or scratch directory, or shows `(deleted)`
- duplicate copies of the same server started from the same directory

**Needs a closer look.** Mark these as such in the table:
- other agent sessions, and anything their process trees started
- tmux or screen sessions, SSH logins
- anything large, started recently, or unclear

**Never stop.** Leave these out of the table:
- the current agent process and its ancestors (walk the PPIDs up from `$$` and exclude every one)
- systemd services, databases, web servers, SSH, VPN and container runtimes
- containers, which were deployed on purpose
- anything the user says is in use

**Another session may still need a leftover.** Several agent sessions can run on one machine at once, and an orphaned process can still be in use. For each candidate, check:
- **Connections:** any established connection to its port (`ss -tnp state established | grep :PORT`)?
- **Proxies:** is its port the target of a reverse proxy (nginx, Caddy, a tunnel)?
- **Shared folder:** is another live agent process working in the same folder? Compare `readlink /proc/PID/cwd` across `ps` rows for `claude`, `codex`, `gemini`, `cursor-agent` and similar.
- **Age:** did it start in the last hour?

Any yes moves it to "needs a closer look", and the reason goes in the table.

## 3. Get approval (nothing is stopped without it)

Show one numbered table:

```
#  PID    what              age    RAM    cwd               why it looks safe / risk
1  4121   chrome-headless   3d     410M   /tmp/x            orphaned, no connections
2  5230   vite :5173        2h     180M   ~/app             ⚠ another session's cwd is ~/app
```

Ask: **"Stop which? (numbers, `all`, or `none`)"**. Then stop exactly the rows the user names:
- **Approval:** being asked to "clean ram" is not approval. `all` covers only the rows in the table, not anything found later.
- **No answer or unclear answer:** if the reply is ambiguous, or you are running with no one to ask, stop nothing. Report the table.
- **Check before stopping:** right before you stop a process, confirm the PID still belongs to the same process. Its start time (`ps -o lstart= -p PID`) and command must match the survey, because PIDs get reused.

## 4. How to stop (gotcha)

**Don't use `pkill -f <pattern>` or `pgrep -f <pattern>`.** An agent's shell carries the pattern in its own command line, so `-f` matches your own shell and kills it. Collect PIDs first, then stop by PID:

```bash
PIDS=$(pgrep chrome-headl)            # without -f, pgrep matches the process name only
kill -TERM $PIDS; sleep 3
for p in $PIDS; do kill -0 $p 2>/dev/null && kill -KILL $p; done
```

## 5. Report

A short table: what was stopped, its age, and the user's approval. Then available RAM and swap used, before and after. Last, list anything left running that the user may want to decide on.
