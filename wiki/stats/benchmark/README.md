# Benchmark History Page

This directory *is* the benchmark page, served at
<https://flowr-analysis.github.io/flowr/wiki/stats/benchmark>.

| file | written by | purpose |
|------|------------|---------|
| `data.js` | the release workflow | the history, a `window.BENCHMARK_DATA = {...}` assignment appended to on every release by [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) |
| `index.html`, `viewer.js`, `stats.js`, `style.css` | us | the page that renders it, no build step, no framework |

The page draws the `data.js` next to it first, and only then asks the network two things.

The first is whether main already has a newer history than the build this page came from, at
`raw.githubusercontent.com/.../main/wiki/stats/benchmark/data.js` (`adoptNewer` in `viewer.js`). Whichever
history is newer by `lastUpdate` wins, and the footer states which one is on the page: `from flowR main` where
main's was newer, `as on flowR main` where the two agree, `ahead of flowR main, so from another branch` where
this page shipped with the newer one, and `main not reachable` where the question could not be answered. The
branch is not recorded anywhere in `data.js`, so being ahead of main is the only evidence the page has of
having been published from something else. The file is a
megabyte, so the comparison reads only the first chunk of the answer and cancels the rest; the whole file is
downloaded only once it is known to be newer. It is parsed as JSON rather than run, because a page must not
execute what it downloads, and every failure, from being offline to an answer that is not a history, leaves
the shipped one in place. A page whose own `data.js` is missing gets its history this way too.

The second is whether the `data.js` next to it has changed since, by its `ETag`: a page that is left open
checks every ten minutes and whenever the tab is brought back to the front (`watchForUpdates`). If a release
has published a newer history it offers a reload, and takes it itself once the tab is in the background or the
reader has been idle for a while, which is safe because the address carries the whole view and a reload lands
on it again. Opened from disk there is no server to ask, so the footer says `auto-update off` instead.

Every release writes two suites: the measurements under, say, `"real-world" Benchmark Suite (tree-sitter)`,
and the counters of that same run under `… [info]`. The action alerts whenever an uploaded value grew, which
is right for a runtime and wrong for a count of linting rules, so the counters are uploaded separately with
alerting off (see `isInfoEntry` in `src/benchmark/summarizer/second-phase/graph.ts`). The failures and the
threshold hits stay with the measurements, because a release that fails to re-parse more slices *should*
alert. `mergeInfoSuites` in `stats.js` folds the two back into one suite before anything is drawn.

Every plotted number is the **mean**; the median and the standard deviation ride along in `extra` and show up
on hover. One series must never mix the two, or a release that switched statistics reads as a change that
never happened. Each chart says which of the two it draws, because a counter such as the number of linting
rules is exact and a timing is not (`statisticOf` in `viewer.js`).

The smoothing slider does **not** run a rolling median. A rolling median repeats the middle value of its
window, so a series that rises by one per release reads one release behind, and the release it flattens most
is the newest one, which is the one a decision rests on. `rollingSmooth` fits a line through the window
instead, weighted by the distance from the release it describes and by how far each release lies off the
rolling median, so a trend survives and a single noisy run still does not set the curve. The breakdown bars
are never smoothed: they state what one release ships, so there is nothing across releases to average.

A metric is drawn only if `groupOf` sorts it into one of the `GROUPS`; ids that no group claims
(`per-line`, `memory-detail`, `reduction-detail`, `graphs-detail`, `totals`) are recorded, downloadable, and
simply not shown.

To work on the page, open `index.html` in a browser, it reads the `data.js` next to it.
The pure helpers of `stats.js` are covered by `test/functionality/benchmark/viewer-stats.test.ts`, so
`npm test` catches a broken median, delta, or grouping.

What the benchmark measures and how to run it locally is described in
[`test/performance/README.md`](../../../test/performance/README.md).
