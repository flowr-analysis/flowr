_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="compiled-code">Compiled Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

This rule is a `best-effort` rule.
 
Port of the static checks `R CMD check` makes on `src/` and the build files: `checking compilation flags in Makevars`, `use of PKG_*FLAGS in Makefiles`, `use of SHLIB_OPENMP_*FLAGS in Makefiles`, `for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)`, `for GNU extensions in Makefiles`, `include directives in Makefiles`, `line endings in Makefiles`, `line endings in C/C++/Fortran sources/headers`, `line endings in shell scripts`, `pragmas in C/C++ headers and code`, `usage of KIND in Fortran files`, `C++ specification`, and the install-time `useDynLib`/`LinkingTo` consistency. R evaluates the Makevars with `make`, flowR expands the variables of the file itself. The binary check `compiled code` (entry points that terminate R, write to stdout, use system RNGs, non-API calls, unregistered routines) is approximated on the sources, so such findings are uncertain. Beyond R it also flags `real*8`-style declarations. The `Rust compilation` check only inspects the install log and is not ported.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L704">src/linter/rules/cmd-check/compiled-code.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `compiled-code` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L32"><code><span title="flags (with the dash) that are fine even though they match nonPortableFlags">allowedFlags</span></code></a>\
flags (with the dash) that are fine even though they match
<code>nonPortableFlags</code>
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L44"><code><span title="also look for calls of the non-API entry points of R (default true)">checkNonApi</span></code></a>\
also look for calls of the non-API entry points of R (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L48"><code><span title="also look for the missing registration of native routines (default true)">checkRegistration</span></code></a>\
also look for the missing registration of native routines (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L46"><code><span title="further non-API entry points to flag besides the ones R lists">extraNonApiEntryPoints</span></code></a>\
further non-API entry points to flag besides the ones `R` lists
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L52"><code><span title="also flag Fortran type declarations like real*8, which are no standard Fortran (default true)">flagStarKinds</span></code></a>\
also flag Fortran type declarations like `real*8`, which are no standard Fortran (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L50"><code><span title="the header (a file name, or a directory prefix ending in /) to the package that has to be in LinkingTo for it">headerPackages</span></code></a>\
the header (a file name, or a directory prefix ending in `/`) to the package that has to be in `LinkingTo` for it
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L34"><code><span title="the C++ standards R still honors; others requested through CXX_STD are unknown">knownCxxStandards</span></code></a>\
the C++ standards `R` still honors; others requested through `CXX_STD` are unknown
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L30"><code><span title="regular expressions (anchored by flowR, without the leading dash) for the compiler flags R CMD check calls non-portable">nonPortableFlags</span></code></a>\
regular expressions (anchored by flowR, without the leading dash) for the compiler flags `R CMD check` calls non-portable
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L36"><code><span title="the C++ standards R ignores as obsolete">obsoleteCxxStandards</span></code></a>\
the C++ standards `R` ignores as obsolete
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L28"><code><span title="checks (by their R CMD check title) to skip">skip</span></code></a>\
checks (by their `R CMD check` title) to skip
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L38"><code><span title="the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or [v]sprintf">unportableCalls</span></code></a>\
the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or `[v]sprintf`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L42"><code><span title="the Fortran statements compiled code must not use (I/O, stop, system RNGs)">unportableFortran</span></code></a>\
the Fortran statements compiled code must not use (I/O, `stop`, system RNGs)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L40"><code><span title="the objects (and C++ streams) compiled code must not use for the same reason">unportableObjects</span></code></a>\
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

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Compiled Code** (compiled-code): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"compiled-code":{"results":[],".meta":{"consideredFiles":0}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-compiled-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-compiled-code.test.ts)

<h4 id="Test_32_Case:_32_name">Test Case: name</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

```ts
expected
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-compiled-code.test.ts#L23) for the test-case implementation.