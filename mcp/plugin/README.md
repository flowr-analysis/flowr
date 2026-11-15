# flowR plugin

The [flowR](https://github.com/flowr-analysis/flowr) plugin for Claude Code: the flowR skill, which says when and how
to analyze R code with flowR (slicing, linting, dependencies, version guessing, signature search, and every other
query of the [Query API](https://github.com/flowr-analysis/flowr/wiki/Query-API)).

```text
/plugin install flowr --marketplace flowr-analysis/flowr
```

The skill runs the queries through the `query` tool of the [flowR MCP server](../README.md) when it is connected,
and through flowR's command line (`npx @eagleoutice/flowr`) otherwise. To connect the server as well:

```shell
claude mcp add flowr -- npx -y --omit=optional --ignore-scripts @eagleoutice/flowr-mcp
```
