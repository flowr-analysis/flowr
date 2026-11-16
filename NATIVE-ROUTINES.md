# Native routines in flowR and the signature database

Status: design and MVP (branch `feat/native-routines` in flowR and in sigdb-tracker). This file explains
how R reaches compiled code, which tools can tell us what that code does and how far to trust them, the
schema that carries the answers, how flowR links a `.Call` site to a routine, and what comes next.

Ground rule, kept everywhere below: **every fact comes from the package's code, read by a tool**. A
missing fact means *not found*. It means *does not happen* only where the analysis can show that it saw
everything the routine runs (the `closed` flag), and never for errors.

## 1. How R reaches native code

| Route | R side | C side | Notes |
|---|---|---|---|
| `.Call(sym, ...)` | `SEXP` in, `SEXP` out | `SEXP f(SEXP, ...)` | the usual modern interface. Arguments are **not copied**, so a routine can modify its arguments in place (`REAL(x)[0] = 1`, `SET_VECTOR_ELT`). |
| `.External(sym, ...)`, `.External2` | one pairlist | `SEXP f(SEXP args)` (`External2`: plus call, op, env) | variadic, the arity is not fixed |
| `.C(sym, ...)` | vectors are copied to C arrays, results returned as a list | `void f(double *, int *, ...)` | writes to arguments are the **outputs**. They reach R as the returned list, the caller's objects stay unchanged. |
| `.Fortran(sym, ...)` | like `.C` | `subroutine f(a, b, ...)` with linker symbol `f_` | arguments by reference, `INTENT` is often missing in F77 |
| registration | `useDynLib(pkg, .registration = TRUE, .fixes = "C_")` binds R variables `C_<name>` to `NativeSymbolInfo` objects | `R_init_<pkg>(DllInfo*)` calls `R_registerRoutines(dll, CEntries, CallEntries, FortEntries, ExtEntries)` with `{"name", (DL_FUNC) &fn, nargs}` tables; `R_useDynamicSymbols(dll, FALSE)` turns `dlsym` off | Rcpp's and cpp11's `RcppExports.cpp`/`cpp11.cpp` emit exactly these tables, plus `_pkg_fn` wrappers |
| explicit symbols | `useDynLib(pkg, foo, bar = baz)` binds `foo` to routine `foo` and `bar` to `baz` | any visible symbol | |
| by string | `.Call("foo", ..., PACKAGE = "pkg")` | a registered name first, then `dlsym` (unless dynamic symbols are off) | `R CMD check` warns without `PACKAGE` |
| cross-package | `R_RegisterCCallable` / `R_GetCCallable` | function pointers between packages' C code | invisible to R, so the call is *open* |
| R's own API | `Rf_eval`, `R_tryEval`, `Rf_findFun` | calls back into R | arbitrary R code runs, so we record `r:eval` |

flowR today: `.Call`, `.C`, `.External`, `.External2`, `.Fortran`, `.Call.graphics`, `.External.graphics` are
built-ins with `CallProp.Ffi`, `hasUnknownSideEffects` and the `.NAME` argument treated as a function name
(`base-functions.ts`). The `foreign-function-calls` linter (R CMD check port) resolves the routine and
`PACKAGE`. The `compiled-code` side only knows that `src/` exists. Nothing knows what a routine does.

## 2. Tools

What each one can *soundly* say about a routine, what it costs, and how it fails. "Sound" means: when it
says yes, the code really does it, and when the routine is closed, a no is a real no. All numbers are from
this machine (8 GB / 3-core cap).

| Tool | What it gives us | Soundness | Cost | Failure modes | Status here |
|---|---|---|---|---|---|
| **libclang** (clang 23, Python bindings) | full C/C++ AST with resolved callees (USRs), registration tables, OpenMP directive nodes (`-fopenmp`), `asm`, `throw`, global variable references, the token stream (preprocessor conditionals) | the front end the compiler uses, so the *syntax* is exact. Call resolution is exact for direct calls. Calls through function pointers, virtual calls and unresolved templates are flagged as open. | 0.3-17 s per package (data.table, 47 TUs, two passes: 17 s). Headers are reparsed per TU. A precompiled preamble would cut this. | needs the include paths (R, `inst/include`, `LinkingTo`, `Makevars` `-I`/`-D`). A missing header gives a parse error, recorded and makes the TU open. `configure`-generated headers are missing. | **used** |
| **gfortran** `-fdump-fortran-original` | procedures, formal arguments with `INTENT`, `COMMON`, `SAVE`, assignments, `CALL`s with argument positions, I/O statements, `!$OMP` | the compiler's own parse tree. `INTENT(IN)` is enforced by the compiler, so `written: false` is sound for it. | < 0.5 s for quadprog, a few s for deSolve | the dump format is not a stable interface (gfortran 16 here). Preprocessed `.F` files need `-cpp` (not yet passed). | **used** |
| clang `-dM -E --target=T` | the predefined macros per target, so we know which `#if` names are platform macros, without a hand-made list | exact for the targets asked | 9 × 20 ms | none | **used** |
| **clang static analyzer** (`scan-build`, `clang --analyze`) | path-sensitive bugs: null dereference, leaks, use-after-free, unchecked `malloc`. `unix.*`, `security.*` checkers (insecure API, `system`), `alpha.unix.cstring`. | unsound by design (bounded, may miss), with few false positives. A finding is evidence, its absence is nothing. | 10-100× a parse | needs the same flags. Long runs on big TUs. | available, not wired (phase 2: `danger:*` facts) |
| **clang-tidy** | `cert-*` (`cert-err33-c` unchecked returns, `cert-env33-c` `system`), `bugprone-*`, `concurrency-mt-unsafe` (uses of non-reentrant libc in threaded code) | lint-grade: syntactic checks on the AST, no proof | about the cost of a parse per check group | flags and `compile_commands.json` needed for good results | available, not wired (phase 2) |
| **cppcheck** | bounds, uninitialised memory, leaks, without the exact headers | heuristic. It works without the include paths, but then it guesses at macros. | fast | many false positives on R macros (`PROTECT`) | **not installed** (no sudo; building from source would take a long time) |
| **Goblint** (OCaml, abstract interpretation over CIL) | the one *sound* analyzer here: data races, which arguments may be written, side effects on globals, thread-modular, interprocedural | sound under its assumptions (whole program, no inline asm). `-fopenmp` support is partial. | minutes to hours on a large package. Needs the preprocessed sources (`-E` with R's headers). | C only (no C++). Big packages time out. The opam install is heavy. | **not installed** (opam is missing and the OCaml toolchain is too heavy for the time budget) |
| ctags / universal-ctags | the list of definitions | syntactic and heuristic (macros) | trivial | `F77_SUB(x)` and macro-built names are missed | not installed, and libclang does better |
| `nm` on the built `.so` | the exported symbols that really exist after `configure` and the build | exact for the build at hand | needs `R CMD INSTALL` (minutes, system libraries) | the build fails without system libraries | phase 3, for packages whose `src/` is generated |
| `R CMD INSTALL` + `getDLLRegisteredRoutines()` | the real registration table, including routines registered by loops or macros | exact | the install | as above | phase 3, for validation |

The MVP uses only libclang, gfortran and clang `-dM`. They are on the machine, they read the code as the
compiler does, and every fact they give carries a file, a line and the call chain.

## 3. What the analyzer records (MVP)

`sigdb-tracker/native/native_facts.py` (run with `python3 -I`, one JSON object on stdout). For each
package it:

1. parses every `src/**/*.{c,cc,cpp,cxx,f,f90,...}` with the include paths `src`, `inst/include`,
   R's headers, the `Makevars` `-I`/`-D` flags and the `LinkingTo` packages' `inst/include`;
2. collects every function **definition in the package** (by USR, so `static` functions in different
   files stay apart). Fortran procedures are keyed by their linker symbol `name_`, so C's
   `F77_CALL(name)` and Fortran's `CALL name` meet;
3. reads the **registration tables**: every initializer of a `R_CallMethodDef`/`R_CMethodDef`/
   `R_FortranMethodDef`/`R_ExternalMethodDef` array gives name, target function and arity;
4. takes as entry points the registered routines plus every name the R code passes to an FFI call, as flowR
   finds them (`NativeRoutines.callSites`);
5. per function, records **direct facts** (below) and the callees, then **propagates** facts, openness and
   parameter writes through the package's call graph to a fixpoint. Each fact keeps its first evidence as
   `file:line` plus the call chain (`workbook_close > lxw_create_package > fclose`).

Facts (positive evidence only):

| family | facts | from |
|---|---|---|
| parallelism | `parallel:openmp` (any `OMP_*` AST node, `omp_*` call, `!$OMP`), `parallel:pthreads`, `parallel:std-thread`, `parallel:tbb`, `parallel:rcpp-parallel` | AST node kinds, resolved callees and constructor classes |
| RNG | `rng:r` (`GetRNGstate`, `unif_rand`, `R::runif`, `RNGScope`): reproducible under `set.seed`, reads and writes `.Random.seed`. `rng:other` (`rand`, `random_device`, `mt19937`, Fortran `random_number`): **not** controlled by `set.seed`. | callee / constructed class |
| time | `time:clock` | callee |
| I/O | `io:console` (`Rprintf`, `REprintf`, `std::cout`, Fortran `PRINT`/`WRITE(*`), `io:file` (stdio, POSIX fds, `std::ofstream`, `gz*`, R connections, Fortran `OPEN`/`READ`/`WRITE`), `io:network`, `io:env` | callee, Fortran statement |
| process | `process:system`, `process:fork`, `process:exit` (`exit`, Fortran `STOP`), `process:abort` (`abort`, `assert`), `process:signal` | callee, Fortran statement |
| errors | `error:r` (`Rf_error`, `Rcpp::stop`, `R_CheckUserInterrupt`, ... a longjmp through the caller), `error:longjmp`, `error:throw`, `warning:r` | callee, `throw` node |
| memory | `memory:malloc` (`malloc`/`free`/`new`): memory R's unwinding does not free, so it leaks on `error:r` | callee, `new` node |
| R state | `r:eval` (calls back into R), `r:env-read`, `r:env-write` (`Rf_defineVar`, ...), `r:preserve` (`R_PreserveObject`), `r:finalizer`, `r:options` | callee |
| global state | `global:read`, `global:write` (file-scope or `static` non-const variables of the package, Fortran `COMMON`), `global:static-local`, `global:write-external` | the variable declaration a reference resolves to, and the assignment / `++` / `&` / setter around it |
| hardware | `hw:asm` (`asm` statements), `hw:simd` (callee declared in `*intrin*.h`/`arm_neon.h`, `__builtin_ia32_*`), `hw:query` (`sysconf`, `hardware_concurrency`, `__builtin_cpu_supports`, `cpuid`) | AST node, callee and the header it is declared in |
| platform | `platform:<MACRO>` for every `#if`/`#ifdef`/`#elif` in the routine's range that names a macro whose definition differs between R's targets (clang `-dM -E` over 9 targets) | token stream |

Per parameter: `read` (any reference, exact), `written: true` (an assignment through `*p`, `p[i]`, `p->f`,
through `REAL(p)`/`INTEGER(p)`/`DATAPTR(p)`, through a part of `p` (`VECTOR_ELT(p, i)`, `ATTRIB(p)`,
`Rf_getAttrib(p, s)`), through a local alias of any of these, through a setter like `SET_VECTOR_ELT(p, ...)` /
`Rf_setAttrib(p, ...)` / `memcpy(p, ...)`, or through a package callee that writes the parameter it is
passed; Fortran: an `ASSIGN` to the dummy), `written: false` (none of that, and the value reaches no callee
the analysis cannot see into, or Fortran `INTENT(IN)`), `escapes` (passed to such a callee, stored in a
container, or its address taken). Otherwise `written` stays absent.

`closed`: no call through a pointer, no callee outside the package that is in neither API table (effect
table or no-effect table: R's API as WRE documents it, ISO C, POSIX, the BLAS/LAPACK/LINPACK entry points
**read off R's own headers by libclang**), no parse error in its translation unit, all of this down the
call graph. `pure`: closed, no fact but `error:*`/`warning:*`, no global written, every parameter
`written: false`.

The API tables are the one place where we, not the tool, decide something: which documented API function
means which fact. They are a finite, reviewable list in the script, each entry is a documented property
of the function (WRE, POSIX, ISO C/C++), and an entry missing from them only makes routines *open*. It
never gives them a wrong fact.

### Rust

Rust in `src/rust/` (extendr, savvy, roxido, plain `extern "C"`) is read by `native/rust_facts.py` in the
tracker: a scanner over the source text, no compiler and no `syn`. It finds the symbols R calls
(`wrap__f`, `savvy_f__ffi`, `#[no_mangle]` functions) and the same fact families as for C, plus:

| fact | from |
|---|---|
| `error:panic` | `panic!`, `unwrap`, `expect`, indexing; the frameworks turn a panic into an R error |
| `parallel:rayon`, `parallel:std-thread`, `parallel:async` | rayon iterators, `std::thread`, async runtimes |
| `rust:unsafe` | an `unsafe` block or function |
| `platform:target_os=windows`, ... | `cfg(...)` attributes, in Rust's `key=value` form |

A Rust routine is never closed: the scanner cannot tell which crate or trait a method call goes to, so
its facts are a lower bound. Vendored crates are counted, not read.

## 4. Schema (flowR `src/project/sigdb/schema.ts`)

Per package version, next to `functions` and `classes`:

```ts
interface SigVersionInfo { ...; natives?: readonly SigNativeRoutineInfo[] }

interface SigNativeRoutineInfo {
  name:       string            // registered name, or the symbol the R code names
  iface?:     '.Call' | '.C' | '.Fortran' | '.External'   // registered interface
  symbol?:    string            // linker symbol when different (`forder`, `qpgen2_`)
  lang?:      'c' | 'c++' | 'fortran' | 'rust'
  file?, line?                   // definition
  arity?:     number            // registered nargs (absent: not registered or -1 = any)
  rNames?:    string[]          // R variables binding it (useDynLib .fixes / explicit symbols)
  params?:    { name, type?, read?, written?: boolean, escapes? }[]
  facts?:     string[]          // vocabulary of section 3
  closed?:    boolean
  pure?:      boolean
  undefined?: boolean           // registered, no definition found
}
```

On disk (schema 5, additive, so older readers stop before it): `PkgBlob.natives: SigNative[]` (pooled
across versions like classes) and `PkgBlob.nativesByVersion: Record<version, delta-encoded indices>`, tuple
positions 13 and 14 after `contractOf`. One record:

```
[nameIdx, flags, symbolIdx, fileIdx, line, arity, rNames[], params[[nameIdx, props, typeIdx?]], facts[]]
flags = lang (bits 0-2) | iface << 3 (bits 3-5) | Closed 1<<6 | Pure 1<<7 | Undefined 1<<8
props = Read 1 | Written 2 | NotWritten 4 | Escapes 8          (Written/NotWritten both unset = unknown)
```

All strings go through the global dictionary (facts like `error:r` repeat in every package and compress to
1-2 byte indices). The dictionary frequency remap rewrites them (`mapStringRefs`). The feature toggle is
`SigDbFeatures.natives`. Readers: `PackageSignatureSource.nativeRoutines?(pkg, version)`, implemented by
`SigDatabase`, `SigDatabaseSet`, the sharded set. It is optional, so in-memory sources need not carry it.

The tracker keeps the full analyzer report (evidence chains, unresolved callee names) in its artifact. The
bundle keeps only the facts.

## 5. Linking an R call site to a routine

`NativeRoutines` (`src/project/sigdb/native-routines.ts`):

- `callSites(analyzer)`: every FFI call flowR knows as such (`CallProp.Ffi`, so a shadowed `.Call` is not
  one), with `.NAME` as a string or a symbol and `PACKAGE` if it is a string.
- `resolve(routines, ref, dynLibs?)` follows R's lookup:
  - a symbol `C_foo` is the routine whose `rNames` holds it. Otherwise flowR uses the package's
    `useDynLib` directives, now parsed by flowR's NAMESPACE reader into `NamespaceInfo.dynLibs`
    (`{library, registration, prefix, suffix, symbols}`): a prefix match under `.registration = TRUE`, or
    an explicit `bar = baz`, else the routine named `C_foo`;
  - a string `"foo"` is a registered name of the call's interface, then any registered name, then a C
    symbol, then the Fortran symbol `foo_`.
- `has(routine, fact)` gives `true` (found), `false` (closed and not an error/warning fact), or `undefined`.
  It also takes a family (`has(r, 'parallel')`).

Which database package to ask is the package whose R code holds the call (the tracker knows it, and a flowR
analysis of a package project knows it from `DESCRIPTION`). A call from user code to `pkg::f` reaches the
routine through `f`'s body, so this needs the routine facts folded into `f`'s function record (phase 2).

## 6. Feeding flowR's R-level facts

The native facts map onto what flowR already models. Phase 2 does the folding in the tracker, where
both the routine facts and flowR's per-function analysis are at hand:

| native fact | R-level target |
|---|---|
| `rng:r` | the ambient state `#rng` (`AmbientStateName.rng`): the function reads and writes it, like `runif`. The tracker's global-state table entry `rng`. |
| `rng:other`, `time:clock` | `FnProp.NonDeterministic` (and *not* `#rng`: `set.seed` does not help) |
| `io:file`, `io:network`, `process:*` | a call-level side effect. `hasUnknownSideEffects` can then be narrowed to "this effect" instead of "anything". |
| `io:console` | flowR's sink output pseudo-variables (`AmbientStateName.sinkOutput`), what `cat` writes |
| `io:env` (with a `setenv`) | `#env:*` (only `env:*` with an unknown key, since the name is a C string) |
| `r:options` | `#option:*` read |
| `r:env-write`, `global:write` | global state written (`global:*`) |
| `error:r`, `error:throw`, `process:abort`, `process:exit` | `FnProp.CanThrow`. A contract (`guards`) is out of reach: the condition sits in C. |
| `written: true` on a `.Call` parameter | the R argument is **modified in place**, which breaks the dataflow assumption that a call does not change its arguments. flowR should then add a def edge to the argument variable (as for `x[1] <- 0`). This is the most useful fact for slicing. |
| `written: true` on a `.C`/`.Fortran` parameter | that argument position is an *output* of the returned list. The caller's object is not changed. |
| `pure` + every parameter `written: false` | the call can drop `hasUnknownSideEffects` |
| `parallel:*`, `hw:*`, `platform:*` | new call props for reproducibility queries (`results may differ across platforms or thread counts`). No R-level counterpart yet. |
| `r:eval` | stays unknown: R code runs, possibly the caller's closures. The routine is a higher-order point. |

Contracts (`guards`): a routine's own argument checks (`if(!isReal(x)) error(...)`) are a later phase.
The condition would have to be lifted from C to R types (`TYPEOF(x) != REALSXP` to `is.double(x)`), which
libclang gives us syntactically. It is sound only for checks on the entry path before any other effect.

## 7. Results (MVP, measured)

The packages come from the unpacked CRAN mirror. Each run was capped at 8 GB / 300% CPU. Raw outputs
and the driver script are in `sigdb-tracker/native/results/`. End to end means: tracker extraction
with `natives: true`, then a sigdb bundle written and reopened, then flowR's `NativeRoutines.callSites`
over the package project, resolved against `db.nativeRoutines(pkg)`.

| package | lang | src files | fns seen | routines | closed | pure | params written / not / unknown | native analysis | R `.Call` sites linked |
|---|---|---|---|---|---|---|---|---|---|
| writexl 1.5.4 | C (+ vendored libxlsxwriter, minizip) | 27 | 1240 | 3 | 2 | 1 | 0 / 1 / 5 | 7 s | 3 / 3 |
| quadprog 1.5-8 | Fortran 77 | 5 | 6 | 3 | 3 | 0 | 25 / 11 / 4 | 0.3 s | 3 / 3 (`.QP_` fixes) |
| cli 3.6.5 | C | 26 | 379 | 50 | 24 | 6 | 0 / 30 / 36 | 7 s | 57 / 57 |
| dplyr 1.2.1 | C++ | 12 | 92 | 24 | 8 | 5 | 1 / 14 / 38 | 3 s | 21 / 21 |
| deSolve 1.42 | C + Fortran | 39 | 293 | 28 | 10 | 0 | 11 / 26 / 212 | 7 s | (native only, see below) |
| data.table 1.18.2.1 | C + OpenMP | 47 | 384 | 111 | 109 | 21 | 40 / 226 / 101 | 17 s (two passes) | (native only) |

- Whole tracker extraction (flowR's R analysis plus the native analysis): writexl 17 s, quadprog 0.9 s,
  cli 47-57 s, dplyr 98-125 s, deSolve 418 s. data.table's R analysis did not finish in 30 min at
  5.2 GB, so it was stopped. That is the R side (the perf branch's subject), not the native analysis.
- Bundle: writexl + quadprog give 13.8 KB. Their routine records add almost nothing over the R functions.
- data.table facts: `parallel:openmp` 35 routines, `error:r` 92, `memory:malloc` 34, `io:console` 31,
  `r:finalizer` 25, `r:options` 24, `global:write` 24, `r:eval` 16, `time:clock` 9. It writes its
  arguments in place in 40 parameters, among them `Cassign(dt, ...)`, `Csetattrib(x)`,
  `Csetlistelt(l)`, `CmemcpyDT(dest)`, `Cforder(by)`. That is data.table's `:=` semantics, found from the
  code alone.
- writexl: `C_write_data_frame_list` is open (it reaches vendored code calling libc beyond the tables).
  It has `io:file`, `io:env`, `rng:other` (tmpfile names), `memory:malloc`, `platform:_WIN32`.
  `C_set_tempdir` writes the global `TEMPDIR` (through `strcpy`). `C_lxw_version` is pure.
- quadprog: all three Fortran routines are closed. BLAS/LINPACK come from R's headers. The output
  arguments (`sol`, `lagr`, `crval`, `iact`, ...) are found as written. `INTENT`-less inputs that are
  only passed on to BLAS stay unknown.
- An example of what flowR answers at a call site: `write_xlsx.R:45 .Call(C_write_data_frame_list)` gives
  `c src/write_xlsx.c:68`, `has(io) = true`, `has(parallel) = undefined` (open).
  `quadprog.R:50 .Fortran(.QP_qpgen1)` gives `fortran src/solve.QP.compact.f:90`, closed,
  `has(rng) = false`, written `dmat, dvec, sol, ...`.

Problems found and fixed while measuring (kept here because they are traps for the next tool):
libclang does not expose the body of an OpenMP region (the CapturedStmt shows only the captured
variables). A first version therefore claimed `written: false` for an argument written inside `#pragma
omp parallel for`, which is why every file is now parsed twice. Writes into a *part* of an argument
(`memcpy_sexp(VECTOR_ELT(dest, i), ...)`) were missed until part accessors counted as aliases. Clang's
resource directory has no `omp.h` without libomp, so gcc's is searched after it.

## 8. What is unsound or unknown

- Analysis is per package, not per build: `configure` scripts, generated headers, `Makevars.win`, and
  `#ifdef`s decided at build time are seen with *this* machine's predefined macros (Linux x86_64). Facts in
  branches not taken here are missed in the AST. They are still caught as `platform:*` tokens, which is
  why that fact exists.
- Parameter writes are intraprocedural plus call-graph propagation, with one level of local aliasing
  (`double *p = REAL(x)`). Aliasing through structs, globals or containers escapes, which makes the result
  unknown, not wrong. A write through an alias the analysis does not track (pointer arithmetic beyond
  `p + k`, `memcpy` into a struct field of a parameter) would be a **missed** write, so `written: false`
  is "no write found among the tracked forms". Goblint would make it sound for C.
- C++: member calls of types from headers (`std::vector::push_back`, `Rcpp::NumericVector::operator[]`)
  are not in the tables, so most C++ routines are open. Rcpp vectors share memory with their `SEXP`. A
  write through `operator[]` is therefore a write in place, which the MVP reports as `escapes`.
- Callbacks: a `.Call` routine that calls an R closure (`r:eval`) can do anything the closure does.
- `R_GetCCallable` (cross-package C calls) is open by construction.
- `Rf_error` inside an OpenMP region, and `PROTECT` imbalance: real bugs, not modelled (static-analyzer
  territory).
- `error:*` is never claimed absent: R's allocators raise on memory exhaustion.

## 9. Plan

- **Phase 1 (this MVP)**: discovery (registered + called routines, language, file/line, arity, R names),
  first facts, the schema, decoding, `NativeRoutines`, the NAMESPACE `useDynLib` reader. Tracker flag
  `--natives` (off by default) and `--linking-root`.
- **Phase 2**: fold routine facts into the R functions calling them (tracker: callee `.Call(C_x)` gives
  the function the routine's facts: `CanThrow`, `NonDeterministic`, global state `rng`), and teach flowR's
  dataflow to add the in-place def for `written` `.Call` arguments. Wire clang-tidy `cert-*`/
  `concurrency-mt-unsafe` and `clang --analyze` findings as `danger:*` facts with evidence. Table the
  C++ standard containers and Rcpp's vector API (with in-place writes).
- **Phase 3**: Goblint for C packages within a time budget (sound `written`, races in OpenMP code);
  `R CMD INSTALL` + `getDLLRegisteredRoutines` and `nm` for validation and for `configure`-generated
  sources; precompiled preambles to parse Rcpp packages faster; native contracts.

Open questions:

1. Should the facts live in the bundle (as now) or in a side table like `global-state.json`? In the
   bundle they are pooled and deduplicated, and flowR can read them without the tracker. A side table
   would keep the schema stable while the vocabulary is still moving.
2. Are positive facts with no evidence in the bundle enough, or should flowR be able to show *where*
   (`file:line` of the first evidence)? One more dictionary index per fact.
3. Which of the per-platform facts matter to users: `platform:*` names many macros in vendored code
   (cli's xxhash). A routine-level `platform-dependent` flag may be all a query needs.
4. Do we want `.C` routines' outputs (`written` parameters) surfaced as "returned list components"?
