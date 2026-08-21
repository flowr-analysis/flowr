_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-20, 22:53:36 UTC (v2.14.1), please do not edit directly._
<h2 id="Provenance Query">Provenance Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Calculate the provenance of a given variable, optionally restricted to its enveloping fdef\
_This query is requested with the type `provenance`._\
Run in the REPL: `:query @provenance (<criterion>)[f] <code | file://path>`


Given a [slicing criterion](https://github.com/flowr-analysis/flowr/wiki/Terminology#slicing-criterion), flowR will return the provenance
of the given program element (i.e., all related vertices in a non-interprocedural and non-context sensitive backward slice).

To exemplify the capabilities, consider the following code:

```r
x <- 1
y <- 2
z <- 3
x
```

If you are interested in the provenance of the `x` in the last line you can use:




```json
[
  {
    "type": "provenance",
    "criterion": "4@x"
  }
]
```


(This can be shortened to `@provenance (4@x) "x <- 1\ny <- 2\nz <- 3\nx"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **provenance** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ Provenance for 4@x\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ [Mermaid Url](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgKiM5MTtSTnVtYmVyIzkzOyogKioxKipcbiAgICAgICoxLjYqICgqKmlkOiAxKiopYFwifX1cbiAgICAwW1wiYCojOTE7UlN5bWJvbCM5MzsqICoqeCoqXG4gICAgICAqMS4xKiAoKippZDogMCoqLCB2OiAxKWBcIl1cbiAgICAyW1tcImAqIzkxO1JCaW5hcnlPcCM5MzsqIGJhc2UjNTg7IzU4OyoqIzYwOyM0NTsqKlxuICAgICAgKjEuMS02KiAoKippZDogMioqKVxuICAgIGFyZzogKDAsIDEpYFwiXV1cbiAgICBidWlsdC1pbjpfLVtcImBCdWlsdC1JbjpcbiM2MDsjNDU7YFwiXVxuICAgIHN0eWxlIGJ1aWx0LWluOl8tIHN0cm9rZTpncmF5LGZpbGw6Z3JheSxzdHJva2Utd2lkdGg6MnB4LG9wYWNpdHk6Ljg7XG4gICAgOShbXCJgKiM5MTtSU3ltYm9sIzkzOyogKip4KipcbiAgICAgICo0LjEqICgqKmlkOiA5KiopYFwiXSlcbiAgICAxIC0uLT58XCJmbG93XCJ8IDBcbiAgICBsaW5rU3R5bGUgMCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDAgLS0+fFwiZGVmaW5lZC1ieSwgZmxvd1wifCAyXG4gICAgMCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDFcbiAgICAyIC0tPnxcInJlYWRzLCBhcmdcInwgMVxuICAgIDIgLS0+fFwicmV0dXJucywgYXJnXCJ8IDBcbiAgICAyIC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46Xy1cbiAgICBsaW5rU3R5bGUgNSBzdHJva2U6Z3JheTtcbiAgICA5IC0tPnxcInJlYWRzXCJ8IDAiLCJtZXJtYWlkIjp7ImF1dG9TeW5jIjp0cnVlfX0=)\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.2 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "provenance": {
    ".meta": {
      "timing": 2
    },
    "results": {
      "4@x": [
        9,
        0,
        1,
        2,
        "built-in:<-"
      ]
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>





	


<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Provenance Query query is `executeProvenanceQuery` in [`./src/queries/catalog/provenance-query/provenance-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/provenance-query/provenance-query-executor.ts).

</details>