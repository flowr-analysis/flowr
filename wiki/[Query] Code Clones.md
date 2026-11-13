_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Code Clones Query">Code Clones Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Finds code clones in all analyzed files with a configurable selection of AST, token, and fingerprint based algorithms.\
_This query is requested with the type `code-clones`._\
Run in the REPL: `:query @code-clones [baxter|gst|winnowing ...] [<code>]`

This query reports pairs of code fragments that are clones of each other, that is, code that was copied and possibly
adapted. It runs over all files of the analysis, for example a whole folder or package, with three published algorithms:

| algorithm | compares | after |
|-----------|----------|-------|
| `baxter` | all AST subtrees above a mass threshold, hashed by structure (ignoring identifiers and constants) and compared with `2S / (2S + L + R)` | Baxter et al., [Clone Detection Using Abstract Syntax Trees](https://doi.org/10.1109/ICSM.1998.738528), ICSM 1998 |
| `gst` | the token strings of functions or files with Greedy String Tiling | as in [JPlag](https://github.com/jplag/JPlag), see Prechelt et al., [Finding Plagiarisms among a Set of Programs with JPlag](https://doi.org/10.3217/jucs-008-11-1016), 2002 |
| `winnowing` | k-gram fingerprints selected by robust winnowing, reported with the matched passages | Schleimer et al., [Winnowing: Local Algorithms for Document Fingerprinting](https://doi.org/10.1145/872757.872770), SIGMOD 2003, the algorithm behind MOSS |

Before the detection, the query presents the code in one of three `perspective`s:

- `syntax` shows the code as written.
- `canonical` (the default) rewrites syntactic sugar and newer R features into one core form. Pipes become calls, `\(x)` becomes `function(x)`, right and equal assignments become `<-`, `(e)` and `{e}` become `e`, `x[["a"]]` becomes `x$a`, `T` and `F` become `TRUE` and `FALSE`, and a tail `return(e)` becomes `e`. Every rewritten node keeps the id of the node it stems from, so all findings point to the original source.
- `dataflow` additionally inlines temporaries that are used exactly once along the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph), so `t <- f(x)` followed by `g(t)` looks like `g(f(x))`. It only inlines where this cannot change what the code computes, and it is the only perspective that needs the dataflow analysis.

With `exportIndex`, the query also returns the clone index of the analyzed files (their normalized ASTs).
A later query can pass such indices as `against` to search new code in a corpus of pre-analyzed projects without analyzing them again.
Use `config` to tune the thresholds of each algorithm, and `maxPairs` to limit the number of reported pairs, as `n` copies of the same function already form `n(n-1)/2` pairs.

```json
[ { "type": "code-clones",   "algorithms": [ "gst",    "winnowing" ] } ]
```

 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **code-clones** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ 2 clone pairs in 1 file\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ [gst 1.00] **normalize** _<input 0>:1.14-4.1_ ~ **scale_it** _<input 0>:5.13-8.1_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ [winnowing 1.00] **normalize** _<input 0>:1.14-4.1_ ~ **scale_it** _<input 0>:5.13-8.1_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"code-clones":{".meta":{},"pairs":[{"algorithm":"gst","similarity":1,"containment":[1,1],"a":{"file":"<input 0>","id":23,"loc":[1,14,4,1,"<input 0>"],"name":"normalize"},"b":{"file":"<input 0>","id":48,"loc":[5,13,8,1,"<input 0>"],"name":"scale_it"},"matches":[{"a":[1,14,3,16],"b":[5,13,7,27]}]},{"algorithm":"winnowing","similarity":1,"containment":[1,1],"a":{"file":"<input 0>","id":23,"loc":[1,14,4,1,"<input 0>"],"name":"normalize"},"b":{"file":"<input 0>","id":48,"loc":[5,13,8,1,"<input 0>"],"name":"scale_it"},"matches":[{"a":[2,3,3,16],"b":[6,3,7,20]}]}],"stats":{"files":1,"units":{"gst":2,"winnowing":2},"comparisons":{"gst":1,"winnowing":1}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
normalize <- function(v) {
  m <- mean(v)
  (v - m) / sd(v)
}
scale_it <- function(values) {
  mu <- mean(values)
  (values - mu) / sd(values)
}
```

</details>
	
</details>

In code, passing the query on its own to <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L394"><code>FlowrAnalyzer::<b>query</b></code></a> returns its result directly:

```typescript
const { pairs } = await analyzer.query({ type: 'code-clones', algorithms: ['gst', 'winnowing'] });
for(const { algorithm, similarity, a, b } of pairs) {
	console.log(`${algorithm} (${similarity.toFixed(2)}): ${a.name ?? a.file} ~ ${b.name ?? b.file}`);
}
```

> [!NOTE]
> The [linter](https://github.com/flowr-analysis/flowr/wiki/Linter) offers the same detection as its `code-clones` rule, which is not active by default. In the REPL, `:query @code-clones gst winnowing <code>` runs the query with the given algorithms.

<details>

<summary style="color:gray">Implementation Details</summary>

The Code Clones Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/code-clones-query/code-clones-query-format.ts#L23"><code><span title="Builds the clone index of the analyzed files and runs the requested clone detectors on it.">executeCodeClonesQuery</span></code></a>.

</details>