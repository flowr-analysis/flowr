_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="compiled-code">Compiled Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

R CMD check: [#20](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-20) 🟩, [#65](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-65) 🟩, [#66](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-66) 🟩, [#67](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-67) 🟩, [#68](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-68) 🟩, [#69](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-69) 🟩, [#70](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-70) 🟩, [#71](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-71) 🟩, [#72](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-72) 🟩, [#73](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-73) 🟩, [#74](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-74) 🟩, [#75](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-75) 🟩, [#76](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-76) 🔷, [#77](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-77) 🔷, [#78](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-78) 🔷

This rule is a `best-effort` rule.
 
Checks `src/` and the build files: non-portable Makevars flags, BLAS/LAPACK and OpenMP flag use, GNU make extensions, pragmas, line endings, Fortran KIND, the C++ standard, calls to non-API or non-portable entry points, and `useDynLib` against `src/`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L354">src/linter/rules/cmd-check/compiled-code.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `compiled-code` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L27"><code><span title="flags (with the dash) that are fine even though they match nonPortableFlags">allowedFlags</span></code></a>\
flags (with the dash) that are fine even though they match
<code>nonPortableFlags</code>
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L39"><code><span title="also look for calls of the non-API entry points of R (default true)">checkNonApi</span></code></a>\
also look for calls of the non-API entry points of R (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L43"><code><span title="also look for the missing registration of native routines (default true)">checkRegistration</span></code></a>\
also look for the missing registration of native routines (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L41"><code><span title="further non-API entry points to flag besides the ones R lists">extraNonApiEntryPoints</span></code></a>\
further non-API entry points to flag besides the ones `R` lists
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L47"><code><span title="also flag Fortran type declarations like real*8, which are no standard Fortran (default true)">flagStarKinds</span></code></a>\
also flag Fortran type declarations like `real*8`, which are no standard Fortran (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L45"><code><span title="the header (a file name, or a directory prefix ending in /) to the package that has to be in LinkingTo for it">headerPackages</span></code></a>\
the header (a file name, or a directory prefix ending in `/`) to the package that has to be in `LinkingTo` for it
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L29"><code><span title="the C++ standards R still honors; others requested through CXX_STD are unknown">knownCxxStandards</span></code></a>\
the C++ standards `R` still honors; others requested through `CXX_STD` are unknown
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L25"><code><span title="regular expressions (anchored by flowR, without the leading dash) for the compiler flags R CMD check calls non-portable">nonPortableFlags</span></code></a>\
regular expressions (anchored by flowR, without the leading dash) for the compiler flags `R CMD check` calls non-portable
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L31"><code><span title="the C++ standards R ignores as obsolete">obsoleteCxxStandards</span></code></a>\
the C++ standards `R` ignores as obsolete
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L23"><code><span title="checks (by their R CMD check title) to skip">skip</span></code></a>\
checks (by their `R CMD check` title) to skip
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L33"><code><span title="the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or [v]sprintf">unportableCalls</span></code></a>\
the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or `[v]sprintf`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L37"><code><span title="the Fortran statements compiled code must not use (I/O, stop, system RNGs)">unportableFortran</span></code></a>\
the Fortran statements compiled code must not use (I/O, `stop`, system RNGs)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L35"><code><span title="the objects (and C++ streams) compiled code must not use for the same reason">unportableObjects</span></code></a>\
the objects (and C++ streams) compiled code must not use for the same reason

### Examples

```r
f <- function(x) .Call("C_f", x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "compiled-code",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Compiled Code** (compiled-code): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"compiled-code":{"results":[],".meta":{"consideredFiles":0}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-compiled-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-compiled-code.test.ts).