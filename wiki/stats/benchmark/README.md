# Benchmark History Page

This directory *is* the benchmark page, served at
<https://flowr-analysis.github.io/flowr/wiki/stats/benchmark>.

| file | written by | purpose |
|------|------------|---------|
| `data.js` | the release workflow | the history, a `window.BENCHMARK_DATA = {...}` assignment appended to on every release by [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) |
| `index.html`, `viewer.js`, `stats.js`, `style.css` | us | the page that renders it, no build step, no framework, no network access |

To work on the page, open `index.html` in a browser, it reads the `data.js` next to it.
The pure helpers of `stats.js` are covered by `test/functionality/benchmark/viewer-stats.test.ts`, so
`npm test` catches a broken median, delta, or grouping.

What the benchmark measures and how to run it locally is described in
[`test/performance/README.md`](../../../test/performance/README.md).
