_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="compiled-code">Compiled Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 20, 65–78](https://img.shields.io/badge/cmd--check-20%2C%2065%E2%80%9378-blueviolet) </a>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [20](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-20) | [line endings in shell scripts](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3414) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [65](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-65) | [compilation flags in Makevars](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3501) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [66](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-66) | [use of PKG_*FLAGS in Makefiles](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3611) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [67](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-67) | [use of SHLIB_OPENMP_*FLAGS in Makefiles](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3643) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩⭐ | ⭐ also runs without setting an environment variable |
| [68](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-68) | [for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3559) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [69](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-69) | [for GNU extensions in Makefiles](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3514) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [70](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-70) | [include directives in Makefiles](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3848) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [71](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-71) | [line endings in Makefiles](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3479) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [72](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-72) | [line endings in C/C++/Fortran sources/headers](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3436) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [73](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-73) | [pragmas in C/C++ headers and code](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3882) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩⭐ | ⭐ also runs without setting an environment variable |
| [74](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-74) | [usage of KIND in Fortran files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L656) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩⭐ | ⭐ also byte count declarations like real*8 |
| [75](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-75) | [C++ specification](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6642) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🟩 |  |
| [76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76) | [compiled code](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4010) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🔷 | the calls the shared object would import, read off the sources |
| [77](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-77) | [whether package can be installed](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5961) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷⭐ | ⭐ also compiled code never loaded for lack of useDynLib<br>useDynLib and src/ in agreement, headers from LinkingTo, undefined exports |
| [78](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-78) | [compilation flags used](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3934) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🔷 | the flags the Makevars state, not the ones the toolchain was called with |

This rule is a <code>best-effort</code> rule.
 
Finds problems in `src/` and the build files: non-portable Makevars flags, BLAS/LAPACK and OpenMP flag use, GNU make extensions, pragmas, line endings, Fortran KIND, the C++ standard, calls to non-API or non-portable entry points, and `useDynLib` against `src/`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L353">src/linter/rules/cmd-check/compiled-code.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `compiled-code` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L26"><code><span title="flags (with the dash) that are fine even though they match nonPortableFlags">allowedFlags</span></code></a>\
flags (with the dash) that are fine even though they match
<code>nonPortableFlags</code>\
_R CMD check [#65](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-65 "checking compilation flags in Makevars"), [#78](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-78 "checking compilation flags used")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L38"><code><span title="also look for calls of the non-API entry points of R (default true)">checkNonApi</span></code></a>\
also look for calls of the non-API entry points of R (default `true`)\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L42"><code><span title="also look for the missing registration of native routines (default true)">checkRegistration</span></code></a>\
also look for the missing registration of native routines (default `true`)\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L40"><code><span title="further non-API entry points to flag besides the ones R lists">extraNonApiEntryPoints</span></code></a>\
further non-API entry points to flag besides the ones `R` lists\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L46"><code><span title="also flag Fortran type declarations like real*8, which are no standard Fortran (default true)">flagStarKinds</span></code></a>\
also flag Fortran type declarations like `real*8`, which are no standard Fortran (default `true`)\
_R CMD check [#74](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-74 "checking usage of KIND in Fortran files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L44"><code><span title="the header (a file name, or a directory prefix ending in /) to the package that has to be in LinkingTo for it">headerPackages</span></code></a>\
the header (a file name, or a directory prefix ending in `/`) to the package that has to be in `LinkingTo` for it\
_R CMD check [#77](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-77 "checking whether package can be installed")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L28"><code><span title="the C++ standards R still honors; others requested through CXX_STD are unknown">knownCxxStandards</span></code></a>\
the C++ standards `R` still honors; others requested through `CXX_STD` are unknown\
_R CMD check [#75](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-75 "checking C++ specification")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L24"><code><span title="regular expressions (anchored by flowR, without the leading dash) for the compiler flags R CMD check calls non-portable">nonPortableFlags</span></code></a>\
regular expressions (anchored by flowR, without the leading dash) for the compiler flags `R CMD check` calls non-portable\
_R CMD check [#65](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-65 "checking compilation flags in Makevars"), [#78](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-78 "checking compilation flags used")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L30"><code><span title="the C++ standards R ignores as obsolete">obsoleteCxxStandards</span></code></a>\
the C++ standards `R` ignores as obsolete\
_R CMD check [#75](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-75 "checking C++ specification")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L22"><code><span title="checks (by their R CMD check title) to skip">skip</span></code></a>\
checks (by their `R CMD check` title) to skip
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L32"><code><span title="the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or [v]sprintf">unportableCalls</span></code></a>\
the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or `[v]sprintf`\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L36"><code><span title="the Fortran statements compiled code must not use (I/O, stop, system RNGs)">unportableFortran</span></code></a>\
the Fortran statements compiled code must not use (I/O, `stop`, system RNGs)\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/compiled-code.ts#L34"><code><span title="the objects (and C++ streams) compiled code must not use for the same reason">unportableObjects</span></code></a>\
the objects (and C++ streams) compiled code must not use for the same reason\
_R CMD check [#76](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-76 "checking compiled code")_

### Examples

A project with the code `R/code.R`:

```r
f <- function(x) .Call("C_f", x)
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

`NAMESPACE`:

```text
useDynLib(pkg)
export(f)
```

`src/Makevars`:

```text
PKG_CXXFLAGS = -O3 -Wall -fPIC
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "compiled-code",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Compiled Code** (compiled-code):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Non-portable flags in variable 'PKG_CXXFLAGS': -O3 -Wall -fPIC at /pkg/src/Makevars:1.1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ PKG_CXXFLAGS set in 'src/Makevars' without any corresponding files at /pkg/src/Makevars:1.1

More examples are the test cases in [test/functionality/linter/cmd-check/lint-compiled-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-compiled-code.test.ts).