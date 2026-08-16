_<span title="an overview of flowR's query API">Generated</span> from '[src/documentation/wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts)' on 2026-08-16, 06:15:28 UTC (v2.13.16), so please do not edit it directly._
<h2 id="Compound Query">Compound Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Combines multiple queries of the same type into one, specifying common arguments.\
_This query is requested with the type `compound`._


A compound query comes in use, whenever we want to state multiple queries of the same type with a set of common arguments.
It offers the following properties of interest:

1. **Query** (`query`): the type of the query that is to be combined.
2. **Common Arguments** (`commonArguments`): The arguments that are to be used as defaults for all queries (i.e., any argument the query may have).
3. **Arguments** (`arguments`): The other arguments for the individual queries that are to be combined.

For example, consider the following compound query that combines two call-context queries for `mean` and `print`, both of which are to be
assigned to the kind `visualize` and the subkind `text` (using the example code from above):




```json
[
  {
    "type": "compound",
    "query": "call-context",
    "commonArguments": {
      "kind": "visualize",
      "subkind": "text"
    },
    "arguments": [
      {
        "callName": "^mean$"
      },
      {
        "callName": "^print$"
      }
    ]
  }
]
```






_Results (prettified and summarized):_

Query: **call-context** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **visualize** (4 hits):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ **text** (4 hits): _`mean(data$x)`_ (L.9), _`print(m)`_ (L.10), _`mean(data2$k)`_ (L.19), _`print(mean(data2$k))`_ (L.19)\
_All queries together required ≈6 ms (1ms accuracy, total 6 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.3 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 0
    },
    "kinds": {
      "visualize": {
        "subkinds": {
          "text": [
            {
              "id": 31,
              "name": "mean"
            },
            {
              "id": 36,
              "name": "print"
            },
            {
              "id": 87,
              "name": "mean"
            },
            {
              "id": 89,
              "name": "print"
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>





	

Of course, in this specific scenario, the following query would be equivalent:




```json
[
  {
    "type": "call-context",
    "callName": "^(mean|print)$",
    "kind": "visualize",
    "subkind": "text"
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **call-context** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **visualize** (4 hits):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ **text** (4 hits): _`mean(data$x)`_ (L.9), _`print(m)`_ (L.10), _`mean(data2$k)`_ (L.19), _`print(mean(data2$k))`_ (L.19)\
_All queries together required ≈6 ms (1ms accuracy, total 6 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.1 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 1
    },
    "kinds": {
      "visualize": {
        "subkinds": {
          "text": [
            {
              "id": 31,
              "name": "mean"
            },
            {
              "id": 36,
              "name": "print"
            },
            {
              "id": 87,
              "name": "mean"
            },
            {
              "id": 89,
              "name": "print"
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>



</details>

	

However, compound queries become more useful whenever common arguments can not be expressed as a union in one of their properties.
Additionally, you can still overwrite default arguments.
In the following, we (by default) want all calls to not resolve to a local definition, except for those to `print` for which we explicitly
want to resolve to a local definition:




```json
[
  {
    "type": "compound",
    "query": "call-context",
    "commonArguments": {
      "kind": "visualize",
      "subkind": "text",
      "callTargets": "global"
    },
    "arguments": [
      {
        "callName": "^mean$"
      },
      {
        "callName": "^print$",
        "callTargets": "local"
      }
    ]
  }
]
```






_Results (prettified and summarized):_

Query: **call-context** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **visualize** (2 hits):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ **text** (2 hits): _`mean(data$x)`_ (L.9) with 1 call (UNKNOWN: built-in (info: undefined)), _`mean(data2$k)`_ (L.19) with 1 call (UNKNOWN: built-in (info: undefined))\
_All queries together required ≈5 ms (1ms accuracy, total 5 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _5.3 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 0
    },
    "kinds": {
      "visualize": {
        "subkinds": {
          "text": [
            {
              "id": 31,
              "name": "mean",
              "calls": [
                "built-in"
              ]
            },
            {
              "id": 87,
              "name": "mean",
              "calls": [
                "built-in"
              ]
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 5
  }
}
```



</details>





	

Now, the results no longer contain calls to `plot` that are not defined locally.

		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Compound Query query is `executeCompoundQueries` in [`./src/queries/virtual-query/compound-query.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/virtual-query/compound-query.ts).

</details>