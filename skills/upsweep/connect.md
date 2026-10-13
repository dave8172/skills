# Connect Upwork's MCP

The server is `https://mcp.upwork.com/mcp`: streamable HTTP with OAuth sign-in, and free to use. The user can revoke access at any time on upwork.com, under Settings → Connected Apps. Find the section for the agent you are running in. Commands were checked against each vendor's docs on 2026-10-02.

## Claude Code
- Add: `claude mcp add --transport http --scope user upwork https://mcp.upwork.com/mcp`
- Sign in: restart Claude Code, run `/mcp`, choose **upwork**, then **Authenticate**.

## Codex (CLI or app)
- Add: `codex mcp add upwork --url https://mcp.upwork.com/mcp`
- Sign in: `codex mcp login upwork`. Check it in `/mcp`. In the app or IDE extension, restart after adding.

## Gemini CLI
- Add: `gemini mcp add --transport http -s user upwork https://mcp.upwork.com/mcp`
- Sign in: in a session, `/mcp auth upwork`.

## Cursor (app or CLI)
- Add to `~/.cursor/mcp.json`:
  ```json
  { "mcpServers": { "upwork": { "url": "https://mcp.upwork.com/mcp" } } }
  ```
- Sign in: in Settings → Tools & MCP, click **Needs login**. In the CLI, run `agent mcp login upwork`.

## VS Code / GitHub Copilot
- Add: run **MCP: Open User Configuration** and add:
  ```json
  { "servers": { "upwork": { "type": "http", "url": "https://mcp.upwork.com/mcp" } } }
  ```
- Sign in: a browser opens on first use. Manage it with **MCP: List Servers**.

## OpenCode
- Add to `opencode.json`:
  ```json
  { "mcp": { "upwork": { "type": "remote", "url": "https://mcp.upwork.com/mcp" } } }
  ```
- Sign in: `opencode mcp auth upwork`, or it starts automatically on first use.

## Amp
- Add: `amp mcp add upwork https://mcp.upwork.com/mcp`
- Sign in: starts when the TUI starts.

## Goose
- Add: `goose configure` → Add Extension → Remote Extension (Streamable HTTP), with the URL above.
- Sign in: a browser opens automatically.

## Claude (web or desktop)
- Add: Customize → Connectors → Add custom connector, and paste the URL. Or use the directory listing: https://claude.ai/directory/connectors/upwork
- Sign in: click **Connect**. In a chat, enable it with + → Connectors → Upwork.
- Skills here can't write files, so the user keeps their profile block and pastes it in.

## ChatGPT
- Add: from the plugin directory, or via Developer mode → add an MCP server URL, with OAuth. This needs a paid plan, and a model with Medium or High reasoning; Instant can't call MCP tools.
- Sign in: click **Sign in**.

## Anything else
Any agent that supports remote MCP servers with OAuth should work. Add a server named `upwork` with the URL above, sign in when prompted, and restart the agent if the tools don't appear.
