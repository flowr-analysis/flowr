---
name: flowr
description: Statically analyze R code with flowR. Use when asked what affects a variable or result in an R script (program slicing), which packages, data files, and outputs an R script or project uses, which package versions it works with, which packages export a function or what signature it has in which version, to lint R code (unused definitions, dead code, absolute paths, unseeded randomness, leaked credentials, ...), or to find calls, definitions, and dataflow in R code.
---

# flowR: static analysis for R

flowR analyzes R code without running it and understands R's scoping. Prefer it over grepping when the
question is about dataflow ("where does this value come from", "is this used") rather than text.

flowR answers [queries](https://github.com/flowr-analysis/flowr/wiki/Query-API), the most useful being:

- `{"type":"static-slice","criteria":["12@x"]}`: the minimal code affecting `x` in line 12 (also `12:5` for line 12, column 5).
- `{"type":"linter"}`: lint findings, optionally only some `"rules"`. Findings marked `uncertain` deserve a second look.
- `{"type":"dependencies"}`: loaded libraries, files read and written, plots.
- `{"type":"guess-dep-versions"}`: the package versions the code works with, optionally only those released before a `"date"`.
- `{"type":"call-context","callName":"^read_"}`: all calls matching a regex.
- `{"type":"signature","package":"dplyr","function":"across"}`: signature, properties, and calls of a package function, optionally in a `"version"` (globs allowed, no code needed).
- `{"type":"function-info","name":"filter"}`: the packages exporting a function (no code needed).

If the `flowr` MCP server is available, pass these to its `query` tool together with R `code` (or, locally,
`files`: R files or project folders). Otherwise run them with Docker from the folder holding the code:

```sh
docker run --rm -u "$(id -u)" -v "$PWD:/w" -w /w eagleoutice/flowr-slim \
  --execute ':query [{"type":"static-slice","criteria":["12@x"]}] file://analysis.R'
docker run --rm -u "$(id -u)" -v "$PWD:/w" -w /w eagleoutice/flowr-slim --execute ':query @dependencies file://.'
```

`:query*` instead of `:query` prints JSON, and inline code works in place of `file://...`.
