# flowR MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server with a single `query` tool that lets LLM
clients analyze R code with [flowR](https://github.com/flowr-analysis/flowr): slicing, linting, dependencies,
version guessing, signature database search, and every other query of the
[Query API](https://github.com/flowr-analysis/flowr/wiki/Query-API). No R installation is needed. On its first
start, it downloads flowR's signature database (about 66 MB, hash-checked, from the
[flowR releases](https://github.com/flowr-analysis/flowr/releases) into `~/.cache/flowr`), which version guessing
and signature search need; everything else also works offline. It never runs the analyzed code and contacts no
other server, unless a query explicitly asks the linter to check the URLs in the code (`checkUrls`, never over HTTP).

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

The flags keep the install small: they skip the optional dependencies flowR does not need here and run no install
scripts, while the package's `npm-shrinkwrap.json` pins every dependency.

Remote clients (ChatGPT, claude.ai, ...) need `npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp --http [port]` (default `$PORT`
or 1042) behind HTTPS, e.g., `cloudflared tunnel --url http://localhost:1042`, and `https://<host>/mcp` added as
a connector (in ChatGPT: developer mode). It listens on `127.0.0.1` unless `HOST` says otherwise (e.g.,
`HOST=0.0.0.0` in a container), and `FLOWR_MCP_PATH=/mcp/<random>` replaces `/mcp` with a secret path, the one
access control every remote client supports.

Over HTTP, the code is untrusted: the server never reads its own files (no `files`, `source()` is ignored, no
`config` query), runs in flowR's secure mode (no network access, processes, or R), keeps stack traces to itself,
and refuses browser pages and requests over 1 MB. Analyses run one at a time with at most 16 waiting, each
stopped after 30 seconds or 2 GB of memory. Answers are cut at 50000 characters. Put a rate limit in front of a
public instance.

[`SKILL.md`](SKILL.md) is an agent skill (Claude, Codex, Gemini CLI, ...) for when and how to use flowR, with
or without this server; copy it to, e.g., `~/.claude/skills/flowr/SKILL.md`.
