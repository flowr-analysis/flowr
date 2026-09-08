_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-09-08, 07:02:48 UTC (v2.15.8), do not edit directly._
<h2 id="Function Info Query">Function Info Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Reports where a function name comes from: which packages export it, their signature, and whether flowR itself has a built-in definition for it.\
_This query is requested with the type `function-info`._\
Run in the REPL: `:query @function-info <name> [<package>...]`


This query answers "where does this function come from?" for a bare name, combining two sources flowR otherwise
consults separately: the [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) (which packages export
the name, and their signature/definition site) and flowR's own built-in configuration (whether flowR models the
name itself, and how).

Given a base-R name such as `sd`:




```json
[
  {
    "type": "function-info",
    "name": "sd"
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **function-info** (29 ms)\
&nbsp;&nbsp;&nbsp;╰ **stats** _(x, na.rm)_ _(R/sd.R:19)_\
&nbsp;&nbsp;&nbsp;╰ **posterior** _(x, ...)_ _(R/rvar-summaries-over-draws.R:192)_\
&nbsp;&nbsp;&nbsp;╰ **h2o** _(x, na.rm)_ _(R/frame.R:2998)_\
&nbsp;&nbsp;&nbsp;╰ **mosaic**\
&nbsp;&nbsp;&nbsp;╰ **elliptic** _(u, m, ...)_ _(R/elliptic.R:1447)_\
&nbsp;&nbsp;&nbsp;╰ **sn** _(R/sn-funct.R:5070)_\
&nbsp;&nbsp;&nbsp;╰ **actuar** _(x, ...)_ _(R/var-methods.R:12)_\
&nbsp;&nbsp;&nbsp;╰ **rapportools** _(R/univar.R:189)_\
&nbsp;&nbsp;&nbsp;╰ **circular** _(x, ...)_ _(R/sd.circular.R:2)_\
&nbsp;&nbsp;&nbsp;╰ **CVXR** _(x, ...)_ _(R/263_zzz_R_specific_masking.R:56)_\
&nbsp;&nbsp;&nbsp;╰ **fdth** _(x, ...)_ _(R/sd.R:2)_\
&nbsp;&nbsp;&nbsp;╰ **ftsa** _(R/sd.R:1)_\
&nbsp;&nbsp;&nbsp;╰ **Bolstad** _(x, ...)_ _(R/sd.R:6)_\
&nbsp;&nbsp;&nbsp;╰ **crunch** _(x, na.rm)_ _(R/univariate.R:65)_\
&nbsp;&nbsp;&nbsp;╰ **spant** _(x, na.rm)_ _(R/mrs_data_proc.R:3140)_\
&nbsp;&nbsp;&nbsp;╰ **DynTxRegime** _(x, na.rm)_ _(R/E_class_IQLearnFS_C.R:169)_\
&nbsp;&nbsp;&nbsp;╰ **RSDA** _(x, ...)_ _(R/symbolic_objects.R:405)_\
&nbsp;&nbsp;&nbsp;╰ **cmvnorm** _(x, na.rm)_ _(R/cmvnorm.R:276)_\
&nbsp;&nbsp;&nbsp;╰ **BayesTools** _(x, ...)_ _(R/priors.R:2213)_\
&nbsp;&nbsp;&nbsp;╰ **spectrolab** _(x, na.rm)_ _(R/stats_function_overloads.R:121)_\
&nbsp;&nbsp;&nbsp;╰ **tf** _(x, na.rm)_ _(R/summarize.R:113)_\
&nbsp;&nbsp;&nbsp;╰ **fChange** _(object, ...)_ _(R/generic_functions.R:263)_\
&nbsp;&nbsp;&nbsp;╰ **HistDat** _(R/histogram.R:175)_\
&nbsp;&nbsp;&nbsp;╰ **estimators** _(R/02_Weib.R:137)_\
&nbsp;&nbsp;&nbsp;╰ **ReMFPCA** _(x, ...)_ _(R/mfdMethods.R:92)_\
&nbsp;&nbsp;&nbsp;╰ **rvec** _(x, na.rm)_ _(R/sd.R:32)_\
&nbsp;&nbsp;&nbsp;╰ **joker** _(R/02_Weib.R:239)_\
&nbsp;&nbsp;&nbsp;╰ **ibdsegments** _(x, ...)_ _(R/distribution_methods.R:55)_\
&nbsp;&nbsp;&nbsp;╰ **descsuppR** _(x, ...)_ _(R/tod.r:201)_\
&nbsp;&nbsp;&nbsp;╰ **tidyna** _(x, na.rm, all_na, ...)_ _(R/aaa-utils.R:25)_\
&nbsp;&nbsp;&nbsp;╰ _flowR built-in_ **stats::sd** [function] _processor builtin:d-ra, primitive_\
_All queries together required ≈29 ms (1ms accuracy, total 30 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _30.0 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON, hiding built-in):_

```text
{"function-info":{".meta":{"timing":29},"name":"sd","packages":[{"package":"stats","exported":true,"parameters":["x","na.rm"],"file":"R/sd.R","line":19},{"package":"posterior","exported":true,"parameters":["x","..."],"file":"R/rvar-summaries-over-draws.R","line":192},{"package":"h2o","exported":true,"parameters":["x","na.rm"],"file":"R/frame.R","line":2998},{"package":"mosaic","exported":true,"parameters":[],"line":-1},{"package":"elliptic","exported":true,"parameters":["u","m","..."],"file":"R/elliptic.R","line":1447},{"package":"sn","exported":true,"parameters":[],"file":"R/sn-funct.R","line":5070},{"package":"actuar","exported":true,"parameters":["x","..."],"file":"R/var-methods.R","line":12},{"package":"rapportools","exported":true,"parameters":[],"file":"R/univar.R","line":189},{"package":"circular","exported":true,"parameters":["x","..."],"file":"R/sd.circular.R","line":2},{"package":"CVXR","exported":true,"parameters":["x","..."],"file":"R/263_zzz_R_specific_masking.R","line":56},{"package":"fdth","exported":true,"parameters":["x","..."],"file":"R/sd.R","line":2},{"package":"ftsa","exported":true,"parameters":[],"file":"R/sd.R","line":1},{"package":"Bolstad","exported":true,"parameters":["x","..."],"file":"R/sd.R","line":6},{"package":"crunch","exported":true,"parameters":["x","na.rm"],"file":"R/univariate.R","line":65},{"package":"spant","exported":true,"parameters":["x","na.rm"],"file":"R/mrs_data_proc.R","line":3140},{"package":"DynTxRegime","exported":true,"parameters":["x","na.rm"],"file":"R/E_class_IQLearnFS_C.R","line":169},{"package":"RSDA","exported":true,"parameters":["x","..."],"file":"R/symbolic_objects.R","line":405},{"package":"cmvnorm","exported":true,"parameters":["x","na.rm"],"file":"R/cmvnorm.R","line":276},{"package":"BayesTools","exported":true,"parameters":["x","..."],"file":"R/priors.R","line":2213},{"package":"spectrolab","exported":true,"parameters":["x","na.rm"],"file":"R/stats_function_overloads.R","line":121},{"package":"tf","exported":true,"parameters":["x","na.rm"],"file":"R/summarize.R","line":113},{"package":"fChange","exported":true,"parameters":["object","..."],"file":"R/generic_functions.R","line":263},{"package":"HistDat","exported":true,"parameters":[],"file":"R/histogram.R","line":175},{"package":"estimators","exported":true,"parameters":[],"file":"R/02_Weib.R","line":137},{"package":"ReMFPCA","exported":true,"parameters":["x","..."],"file":"R/mfdMethods.R","line":92},{"package":"rvec","exported":true,"parameters":["x","na.rm"],"file":"R/sd.R","line":32},{"package":"joker","exported":true,"parameters":[],"file":"R/02_Weib.R","line":239},{"package":"ibdsegments","exported":true,"parameters":["x","..."],"file":"R/distribution_methods.R","line":55},{"package":"descsuppR","exported":true,"parameters":["x","..."],"file":"R/tod.r","line":201},{"package":"tidyna","exported":true,"parameters":["x","na.rm","all_na","..."],"file":"R/aaa-utils.R","line":25}],"builtin":[{"kind":"function","namespace":"stats","processor":"builtin:d-ra","assumePrimitive":true,"tags":[],"configKeys":["props","sig"]}]},".meta":{"timing":29}}
```



</details>



</details>

	

The `packages` property restricts which packages are considered (every exporting package is checked by default),
which is useful once a name is exported by more than one package on CRAN. A name flowR models itself, like `get`,
also reports the built-in's processor, its evaluation handler (if it folds to a constant), and the semantic tags
flowR states for it:




```json
[
  {
    "type": "function-info",
    "name": "get"
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **function-info** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **base** _(x, pos, envir, mode, inherits)_ _(R/get.R:26)_\
&nbsp;&nbsp;&nbsp;╰ **config** _(value, config, file, use_parent)_ _(R/get.R:43)_\
&nbsp;&nbsp;&nbsp;╰ **crmPack**\
&nbsp;&nbsp;&nbsp;╰ **ale** _(obj, ...)_ _(R/000-startup.R:52)_\
&nbsp;&nbsp;&nbsp;╰ _flowR built-in_ **base::get** [function] _processor builtin:get, eval eval:get, eval_\
_All queries together required ≈6 ms (1ms accuracy, total 7 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.5 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.



```json
{
  "function-info": {
    ".meta": {
      "timing": 6
    },
    "name": "get",
    "packages": [
      {
        "package": "base",
        "exported": true,
        "parameters": [
          "x",
          "pos",
          "envir",
          "mode",
          "inherits"
        ],
        "file": "R/get.R",
        "line": 26
      },
      {
        "package": "config",
        "exported": true,
        "parameters": [
          "value",
          "config",
          "file",
          "use_parent"
        ],
        "file": "R/get.R",
        "line": 43
      },
      {
        "package": "crmPack",
        "exported": true,
        "parameters": [],
        "line": -1
      },
      {
        "package": "ale",
        "exported": true,
        "parameters": [
          "obj",
          "..."
        ],
        "file": "R/000-startup.R",
        "line": 52
      }
    ],
    "builtin": [
      {
        "kind": "function",
        "namespace": "base",
        "processor": "builtin:get",
        "assumePrimitive": false,
        "evalHandler": "eval:get",
        "tags": [
          "eval"
        ],
        "configKeys": [
          "props",
          "tags",
          "sig"
        ]
      }
    ]
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>



</details>

	


> [!NOTE]
> To find out what a script _uses_, reach for the [Dependencies Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dependencies); to inspect a specific
> package/version in the database directly, reach for the [Signature Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Signature). In the REPL, `:signature info <name>` is a shorthand for this query.

		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Function Info Query query is `executeFunctionInfoQuery` in [`./src/queries/catalog/function-info-query/function-info-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/function-info-query/function-info-query-executor.ts).

</details>