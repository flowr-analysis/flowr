# flowR MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server with a single `query` tool that lets LLM
clients analyze R code with [flowR](https://github.com/flowr-analysis/flowr): slicing, linting, dependencies,
version guessing, signature database search, and every other query of the
[Query API](https://github.com/flowr-analysis/flowr/wiki/Query-API). No R installation is needed.

On its first start, the server downloads flowR's signature database (about 66 MB) from the
[flowR releases](https://github.com/flowr-analysis/flowr/releases) into `~/.cache/flowr` and checks its hash.
Version guessing and signature search need this database. Everything else also works offline. The server never
runs the analyzed code. It contacts no other server, unless a query asks the linter to check the URLs in the code
(`checkUrls`, which is never allowed over HTTP).

In Claude Code, one plugin installs both this server and the flowR skill:

```text
/plugin install flowr --marketplace flowr-analysis/flowr
```

Other local clients start it over stdio:

```shell
claude mcp add flowr -- npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp      # Claude Code
codex mcp add flowr -- npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp       # OpenAI Codex
gemini mcp add flowr npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp         # Gemini CLI
```

or, configured by JSON (Claude Desktop, Cursor, VS Code, ...):

```json
{ "mcpServers": { "flowr": { "command": "npx", "args": ["-y", "--omit=optional", "--ignore-scripts", "@eagleoutice/flowr-mcp"] } } }
```

The flags keep the install small. They skip the optional dependencies flowR does not need here, and they run no
install scripts. The package's `npm-shrinkwrap.json` pins every dependency.

Remote clients (ChatGPT, claude.ai, ...) need the server running over HTTP behind HTTPS:

```shell
npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp --http 1042
cloudflared tunnel --url http://localhost:1042
```

Then add `https://<host>/mcp` as a connector (in ChatGPT, this needs developer mode). Without a port, the server
uses `$PORT` or 1042. It listens on `127.0.0.1` unless `HOST` says otherwise, for example `HOST=0.0.0.0` in a
container. Setting `FLOWR_MCP_PATH=/mcp/<random>` replaces `/mcp` with a secret path. A secret path is the only
access control that every remote client supports.

Over HTTP, the server treats the code as untrusted:

- It never reads its own files: there is no `files` argument, `source()` is ignored, and the `config` query is refused.
- It runs in flowR's secure mode, without network access, processes, or R.
- It keeps stack traces to itself.
- It refuses requests from browser pages and requests over 1 MB.
- It runs one analysis at a time, with at most 16 waiting, and stops each after 30 seconds or 2 GB of memory.
- It cuts answers at 50000 characters.

Put a rate limit in front of a public instance.

[`SKILL.md`](SKILL.md) is an agent skill (Claude, Codex, Gemini CLI, ...) that says when and how to use flowR,
with or without this server. To use it, copy it to, for example, `~/.claude/skills/flowr/SKILL.md`.
