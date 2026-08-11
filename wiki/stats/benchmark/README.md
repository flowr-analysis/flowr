# Benchmark History Page

This directory *is* the benchmark page, served at
<https://flowr-analysis.github.io/flowr/wiki/stats/benchmark>.

| file | written by | purpose |
|------|------------|---------|
| `data.js` | the release workflow | the history, a `window.BENCHMARK_DATA = {...}` assignment appended to on every release by [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) |
| `index.html`, `viewer.js`, `stats.js`, `style.css` | us | the page that renders it, no build step, no framework, no network access |

Every release writes two suites: the measurements under, say, `"real-world" Benchmark Suite (tree-sitter)`,
and the counters of that same run under `… [info]`. The action alerts whenever an uploaded value grew, which
is right for a runtime and wrong for a count of linting rules, so the counters are uploaded separately with
alerting off (see `isInfoEntry` in `src/benchmark/summarizer/second-phase/graph.ts`). The failures and the
threshold hits stay with the measurements, because a release that fails to re-parse more slices *should*
alert. `mergeInfoSuites` in `stats.js` folds the two back into one suite before anything is drawn.

Every plotted number is the **mean**; the median and the standard deviation ride along in `extra` and show up
on hover. One series must never mix the two, or a release that switched statistics reads as a change that
never happened.

A metric is drawn only if `groupOf` sorts it into one of the `GROUPS`; ids that no group claims
(`per-line`, `memory-detail`, `reduction-detail`, `graphs-detail`, `totals`) are recorded, downloadable, and
simply not shown.

To work on the page, open `index.html` in a browser, it reads the `data.js` next to it.
The pure helpers of `stats.js` are covered by `test/functionality/benchmark/viewer-stats.test.ts`, so
`npm test` catches a broken median, delta, or grouping.

What the benchmark measures and how to run it locally is described in
[`test/performance/README.md`](../../../test/performance/README.md).
