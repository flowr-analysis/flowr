_This document was generated from 'src/documentation/print-query-wiki.ts' on 2024-10-10, 18:08:38 UTC presenting an overview of flowR's query API (v2.1.1, using R v4.4.1)._

This page briefly summarizes flowR's query API, represented by the executeQueries function in [`./src/queries/query.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/query.ts).
Please see the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to access this API.

## The Query Format

Queries are JSON arrays of query objects, each of which uses a `type` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the [Call-Context Query](#call-context-query)). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the [Compound Query](#compound-query)). 

We separate these from a concept perspective. 
For now, we support the following **active** queries (which we will refer to simply as a `query`):

1. [Call-Context Query](#call-context-query) (`call-context`):\
    Finds all calls in a set of files that matches specified criteria.
1. [Dataflow Cluster Query](#dataflow-cluster-query) (`dataflow-cluster`):\
    Calculates and returns all the clusters present in the dataflow graph.
1. [Dataflow Query](#dataflow-query) (`dataflow`):\
    Returns the dataflow graph of the given code.
1. [Id-Map Query](#id-map-query) (`id-map`):\
    Returns the id-map of the normalized AST of the given code.
1. [Normalized AST Query](#normalized-ast-query) (`normalized-ast`):\
    Returns the normalized AST of the given code.

Similarly, we support the following **virtual** queries: 

1. [Compound Query](#compound-query) (`compound`):\
    Combines multiple queries of the same type into one, specifying common arguments.

<details>


<summary>Detailed Query Format (Automatically Generated)</summary>

Although it is probably better to consult the detailed explanations below, if you want to have a look at the scehma, here is its description:

- **.** array 
    _Queries&nbsp;to&nbsp;run&nbsp;on&nbsp;the&nbsp;file&nbsp;analysis&nbsp;information&nbsp;(in&nbsp;the&nbsp;form&nbsp;of&nbsp;an&nbsp;array)_
Valid item types:
    - **.** alternatives 
        _Any&nbsp;query_
        - **.** alternatives 
            _Supported&nbsp;queries_
            - **.** object 
                _Call&nbsp;context&nbsp;query&nbsp;used&nbsp;to&nbsp;find&nbsp;calls&nbsp;in&nbsp;the&nbsp;dataflow&nbsp;graph_
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'call-context'
                - **callName** string [required]
                    _Regex&nbsp;regarding&nbsp;the&nbsp;function&nbsp;name!_
                - **kind** string [optional]
                    _The&nbsp;kind&nbsp;of&nbsp;the&nbsp;call,&nbsp;this&nbsp;can&nbsp;be&nbsp;used&nbsp;to&nbsp;group&nbsp;calls&nbsp;together&nbsp;(e.g.,&nbsp;linking&nbsp;`plot`&nbsp;to&nbsp;`visualize`).&nbsp;Defaults&nbsp;to&nbsp;`.`_
                - **subkind** string [optional]
                    _The&nbsp;subkind&nbsp;of&nbsp;the&nbsp;call,&nbsp;this&nbsp;can&nbsp;be&nbsp;used&nbsp;to&nbsp;uniquely&nbsp;identify&nbsp;the&nbsp;respective&nbsp;call&nbsp;type&nbsp;when&nbsp;grouping&nbsp;the&nbsp;output&nbsp;(e.g.,&nbsp;the&nbsp;normalized&nbsp;name,&nbsp;linking&nbsp;`ggplot`&nbsp;to&nbsp;`plot`).&nbsp;Defaults&nbsp;to&nbsp;`.`_
                - **callTargets** string [optional]
                    _Call&nbsp;targets&nbsp;the&nbsp;function&nbsp;may&nbsp;have.&nbsp;This&nbsp;defaults&nbsp;to&nbsp;`any`.&nbsp;Request&nbsp;this&nbsp;specifically&nbsp;to&nbsp;gain&nbsp;all&nbsp;call&nbsp;targets&nbsp;we&nbsp;can&nbsp;resolve._
                    Allows only the values: 'global', 'must-include-global', 'local', 'must-include-local', 'any'
                - **includeAliases** boolean [optional]
                    _Consider&nbsp;a&nbsp;case&nbsp;like&nbsp;`f&nbsp;<-&nbsp;function_of_interest`,&nbsp;do&nbsp;you&nbsp;want&nbsp;uses&nbsp;of&nbsp;`f`&nbsp;to&nbsp;be&nbsp;included&nbsp;in&nbsp;the&nbsp;results?_
                - **linkTo** object [optional]
                    _Links&nbsp;the&nbsp;current&nbsp;call&nbsp;to&nbsp;the&nbsp;last&nbsp;call&nbsp;of&nbsp;the&nbsp;given&nbsp;kind.&nbsp;This&nbsp;way,&nbsp;you&nbsp;can&nbsp;link&nbsp;a&nbsp;call&nbsp;like&nbsp;`points`&nbsp;to&nbsp;the&nbsp;latest&nbsp;graphics&nbsp;plot&nbsp;etc._
                    - **type** string [required]
                        _The&nbsp;type&nbsp;of&nbsp;the&nbsp;linkTo&nbsp;sub-query._
                        Allows only the values: 'link-to-last-call'
                    - **callName** string [required]
                        _Regex&nbsp;regarding&nbsp;the&nbsp;function&nbsp;name&nbsp;of&nbsp;the&nbsp;last&nbsp;call.&nbsp;Similar&nbsp;to&nbsp;`callName`,&nbsp;strings&nbsp;are&nbsp;interpreted&nbsp;as&nbsp;a&nbsp;regular&nbsp;expression._
            - **.** object 
                _The&nbsp;dataflow&nbsp;query&nbsp;simply&nbsp;returns&nbsp;the&nbsp;dataflow&nbsp;graph,&nbsp;there&nbsp;is&nbsp;no&nbsp;need&nbsp;to&nbsp;pass&nbsp;it&nbsp;multiple&nbsp;times!_
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'dataflow'
            - **.** object 
                _The&nbsp;id&nbsp;map&nbsp;query&nbsp;retrieves&nbsp;the&nbsp;id&nbsp;map&nbsp;from&nbsp;the&nbsp;normalized&nbsp;AST._
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'id-map'
            - **.** object 
                _The&nbsp;normalized&nbsp;AST&nbsp;query&nbsp;simply&nbsp;returns&nbsp;the&nbsp;normalized&nbsp;AST,&nbsp;there&nbsp;is&nbsp;no&nbsp;need&nbsp;to&nbsp;pass&nbsp;it&nbsp;multiple&nbsp;times!_
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'normalized-ast'
            - **.** object 
                _The&nbsp;cluster&nbsp;query&nbsp;calculates&nbsp;and&nbsp;returns&nbsp;all&nbsp;clusters&nbsp;in&nbsp;the&nbsp;dataflow&nbsp;graph._
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'dataflow-cluster'
        - **.** alternatives 
            _Virtual&nbsp;queries&nbsp;(used&nbsp;for&nbsp;structure)_
            - **.** object 
                _Compound&nbsp;query&nbsp;used&nbsp;to&nbsp;combine&nbsp;queries&nbsp;of&nbsp;the&nbsp;same&nbsp;type_
                - **type** string [required]
                    _The&nbsp;type&nbsp;of&nbsp;the&nbsp;query._
                    Allows only the values: 'compound'
                - **query** string [required]
                    _The&nbsp;query&nbsp;to&nbsp;run&nbsp;on&nbsp;the&nbsp;file&nbsp;analysis&nbsp;information._
                - **commonArguments** object [required]
                    _Common&nbsp;arguments&nbsp;for&nbsp;all&nbsp;queries._
                - **arguments** array [required]
                    _Arguments&nbsp;for&nbsp;each&nbsp;query._
                Valid item types:
                    - **.** object 

</details>

### Why Queries?

First, consider that you have a file like the following (of course, this is just a simple and artificial example):

```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```

<details> <summary>Dataflow Graph of the Example</summary>




```mermaid
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 24----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 56----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 59----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 65----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 98----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```
	
(The analysis required _20.49 ms_ (including parsing and normalization) within the generation environment.)



</details>

&nbsp;

Additionally, consider that you are interested in all function calls which loads data with `read_csv`.
A simple `regex`-based query could look like this: `^read_csv$`.
However, this fails to incorporate
 
1. Syntax-based information (comments, strings, used as a variable, called as a higher-order function, ...)
2. Semantic information (e.g., `read_csv` is overwritten by a function with the same name)
3. Context information (e.g., calls like `points` may link to the current plot)

To solve this, flowR provides a query API which allows you to specify queries on the dataflow graph.
For the specific use-case stated, you could use the [Call-Context Query](#call-context-query) to find all calls to `read_csv` which refer functions that are not overwritten.

Just as an example, the following [Call-Context Query](#call-context-query) finds all calls to `read_csv` that are not overwritten:



```json
[
  {
    "type": "call-context",
    "callName": "^read_csv$",
    "callTargets": "global",
    "kind": "input",
    "subkind": "csv-file"
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**call-context**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**input**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**csv-file**:&nbsp;_`read_csv`_&nbsp;(L.6),&nbsp;_`read_csv`_&nbsp;(L.7)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;9ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _9.00 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 0
    },
    "kinds": {
      "input": {
        "subkinds": {
          "csv-file": [
            {
              "id": 16,
              "calls": []
            },
            {
              "id": 22,
              "calls": []
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>





	


### Call-Context Query


Call context queries may be used to identify calls to specific functions that match criteria of your interest.
For now, we support two criteria:

1. **Function Name** (`callName`): The function name is specified by a regular expression. This allows you to find all calls to functions that match a specific pattern.
2. **Call Targets**  (`callTargets`): This specifies to what the function call targets. For example, you may want to find all calls to a function that is not defined locally.

Besides this, we provide the following ways to automatically categorize and link identified invocations:

1. **Kind**         (`kind`): This is a general category that can be used to group calls together. For example, you may want to link all calls to `plot` to `visualize`.
2. **Subkind**      (`subkind`): This is used to uniquely identify the respective call type when grouping the output. For example, you may want to link all calls to `ggplot` to `plot`.
3. **Linked Calls** (`linkTo`): This links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc.
   For now, we _only_ offer support for linking to the last call, as the current flow dependency over-approximation is not stable.
4. **Aliases**      (`includeAliases`): Consider a case like `f <- function_of_interest`, do you want calls to `f` to be included in the results? There is probably no need to combine this with a global call target!

Re-using the example code from above, the following query attaches all calls to `mean` to the kind `visualize` and the subkind `text`,
all calls that start with `read_` to the kind `input` but only if they are not locally overwritten, and the subkind `csv-file`, and links all calls to `points` to the last call to `plot`:



```json
[
  {
    "type": "call-context",
    "callName": "^mean$",
    "kind": "visualize",
    "subkind": "text"
  },
  {
    "type": "call-context",
    "callName": "^read_",
    "kind": "input",
    "subkind": "csv-file",
    "callTargets": "global"
  },
  {
    "type": "call-context",
    "callName": "^points$",
    "kind": "visualize",
    "subkind": "plot",
    "linkTo": {
      "type": "link-to-last-call",
      "callName": "^plot$"
    }
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**call-context**&nbsp;(2ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**input**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**csv-file**:&nbsp;_`read_csv`_&nbsp;(L.6),&nbsp;_`read_csv`_&nbsp;(L.7)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**visualize**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**text**:&nbsp;_`mean`_&nbsp;(L.9),&nbsp;_`mean`_&nbsp;(L.19)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**plot**:&nbsp;_`points`_&nbsp;(L.17)&nbsp;with&nbsp;1&nbsp;link&nbsp;(_`plot`_&nbsp;(L.16))\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈2ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;17ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _17.50 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 2
    },
    "kinds": {
      "input": {
        "subkinds": {
          "csv-file": [
            {
              "id": 16,
              "calls": []
            },
            {
              "id": 22,
              "calls": []
            }
          ]
        }
      },
      "visualize": {
        "subkinds": {
          "text": [
            {
              "id": 31
            },
            {
              "id": 87
            }
          ],
          "plot": [
            {
              "id": 79,
              "linkedIds": [
                67
              ]
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>





	

As you can see, all kinds and subkinds with the same name are grouped together.
Yet, re-stating common arguments and kinds may be cumbersome (although you can already use clever regex patterns).
See the [Compound Query](#compound-query) for a way to structure your queries more compactly if you think it gets too verbose. 


<details><summary style="color:black">Alias Example</summary>

Consider the following code: 
```r
foo <- my_test_function
foo()
if(u) bar <- foo
bar()
my_test_function()
```

Now let's say we want to query _all_ uses of the `my_test_function`:

```json
[
  {
    "type": "call-context",
    "callName": "^my_test_function",
    "includeAliases": true
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**call-context**&nbsp;(1ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**.**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**.**:&nbsp;_`foo`_&nbsp;(L.2)&nbsp;with&nbsp;1&nbsp;alias&nbsp;root&nbsp;(_`my_test_function`_&nbsp;(L.1)),&nbsp;_`bar`_&nbsp;(L.4)&nbsp;with&nbsp;1&nbsp;alias&nbsp;root&nbsp;(_`my_test_function`_&nbsp;(L.1)),&nbsp;_`my_test_function`_&nbsp;(L.5)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;9ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _8.71 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 1
    },
    "kinds": {
      ".": {
        "subkinds": {
          ".": [
            {
              "id": 4,
              "aliasRoots": [
                1
              ]
            },
            {
              "id": 12,
              "aliasRoots": [
                1
              ]
            },
            {
              "id": 14
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>





	

</details>
    
		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Call-Context Query query is `executeCallContextQueries` in [`./src/queries/catalog/call-context-query/call-context-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/catalog/call-context-query/call-context-query-executor.ts).

</details>	





### Dataflow Query


Maybe you want to handle only the result of the query execution, or you just need the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki//Dataflow%20Graph) again.
This query type does exactly that!

Using the example code from above, the following query returns the dataflow graph of the code:


```json
[
  {
    "type": "dataflow"
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**dataflow**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;[Dataflow&nbsp;Graph](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIDdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoNylcbiAgICAgICoyLjEtMTQqXG4gICAgKDUpYFwiXV1cbiAgICBzdHlsZSA3IHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgOXt7XCJgIzkxO1JTeW1ib2wjOTM7IHJlYWRyXG4gICAgICAoOSlcbiAgICAgICozLjktMTMqYFwifX1cbiAgICAxMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgxMSlcbiAgICAgICozLjEtMTQqXG4gICAgKDkpYFwiXV1cbiAgICBzdHlsZSAxMSBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDE0e3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEuY3N2IzM5O1xuICAgICAgKDE0KVxuICAgICAgKjYuMTgtMjcqYFwifX1cbiAgICAxNltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMTYpXG4gICAgICAqNi45LTI4KlxuICAgICgxNClgXCJdXVxuICAgIDEyW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMTIpXG4gICAgICAqNi4xLTQqYFwiXVxuICAgIDE3W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDE3KVxuICAgICAgKjYuMS0yOCpcbiAgICAoMTIsIDE2KWBcIl1dXG4gICAgMjB7e1wiYCM5MTtSU3RyaW5nIzkzOyAjMzk7ZGF0YTIuY3N2IzM5O1xuICAgICAgKDIwKVxuICAgICAgKjcuMTktMjkqYFwifX1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiAyMiBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgMzY4LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogeyoqZGF0YSoqIChpZDogMTIsIHR5cGU6IFVua25vd24sIGRlZi4gQDE3KX1cbiAgICAyMltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMjIpXG4gICAgICAqNy4xMC0zMCpcbiAgICAoMjApYFwiXV1cbiAgICAxOFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICgxOClcbiAgICAgICo3LjEtNSpgXCJdXG4gICAgMjNbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMjMpXG4gICAgICAqNy4xLTMwKlxuICAgICgxOCwgMjIpYFwiXV1cbiAgICAyNihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgyNilcbiAgICAgICo5LjExLTE0KmBcIl0pXG4gICAgMjd7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoMjcpXG4gICAgICAqOS4xMS0xNipgXCJ9fVxuICAgIDI5W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDI5KVxuICAgICAgKjkuMTEtMTYqXG4gICAgKDI2LCAyNylgXCJdXVxuICAgIDMxW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDMxKVxuICAgICAgKjkuNi0xNypcbiAgICAoMjkpYFwiXV1cbiAgICAyNFtcImAjOTE7UlN5bWJvbCM5MzsgbVxuICAgICAgKDI0KVxuICAgICAgKjkuMSpgXCJdXG4gICAgMzJbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMzIpXG4gICAgICAqOS4xLTE3KlxuICAgICgyNCwgMzEpYFwiXV1cbiAgICAzNChbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgzNClcbiAgICAgICoxMC43KmBcIl0pXG4gICAgMzZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDM2KVxuICAgICAgKjEwLjEtOCpcbiAgICAoMzQpYFwiXV1cbiAgICAzOChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgzOClcbiAgICAgICoxMi4xLTQqYFwiXSlcbiAgICA0MyhbXCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg0MylcbiAgICAgICoxMy4yNCpgXCJdKVxuICAgIDQ0KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB4XG4gICAgICAoNDQpXG4gICAgICAqMTMuMjAqYFwiXSlcbiAgICA0NihbXCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg0NilcbiAgICAgICoxMy4zMSpgXCJdKVxuICAgIDQ3KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB5XG4gICAgICAoNDcpXG4gICAgICAqMTMuMjcqYFwiXSlcbiAgICAlJSBFbnZpcm9ubWVudCBvZiA0OCBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDAwLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA0OFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGFlc1xuICAgICAgKDQ4KVxuICAgICAgKjEzLjE2LTMyKlxuICAgICh4ICg0NCksIHkgKDQ3KSlgXCJdXVxuICAgICUlIEVudmlyb25tZW50IG9mIDUwIFtsZXZlbDogMF06XG4gICAgJSUgQnVpbHQtaW5cbiAgICAlJSA0MDMtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgJSUgICBkYXRhOiAgeyoqZGF0YSoqIChpZDogMTIsIHR5cGU6IFVua25vd24sIGRlZi4gQDE3KX1cbiAgICAlJSAgIGRhdGEyOiB7KipkYXRhMioqIChpZDogMTgsIHR5cGU6IFVua25vd24sIGRlZi4gQDIzKX1cbiAgICAlJSAgIG06ICAgICB7KiptKiogKGlkOiAyNCwgdHlwZTogVW5rbm93biwgZGVmLiBAMzIpfVxuICAgIDUwW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZ2dwbG90XG4gICAgICAoNTApXG4gICAgICAqMTMuOS0zMypcbiAgICAoMzgsIDQ4KWBcIl1dXG4gICAgNTJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBkYXRhICUjNjI7JVxuXHRnZ3Bsb3QoYWVzKHggPSB4LCB5ID0geSkpXG4gICAgICAoNTIpXG4gICAgICAqMTIuNi04KlxuICAgICgzOCwgNTApYFwiXV1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiA1NCBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDA5LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA1NFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdlb20jOTU7cG9pbnRcbiAgICAgICg1NClcbiAgICAgICoxNC45LTIwKmBcIl1dXG4gICAgNTVbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM0MztcbiAgICAgICg1NSlcbiAgICAgICoxMi4xLTE0LjIwKlxuICAgICg1MiwgNTQpYFwiXV1cbiAgICA1NyhbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNTcpXG4gICAgICAqMTYuNi0xMCpgXCJdKVxuICAgIDU4e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDU4KVxuICAgICAgKjE2LjYtMTIqYFwifX1cbiAgICA2MFtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2MClcbiAgICAgICoxNi42LTEyKlxuICAgICg1NywgNTgpYFwiXV1cbiAgICA2MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjIpXG4gICAgICAqMTYuMTUtMTkqYFwiXSlcbiAgICA2M3t7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg2MylcbiAgICAgICoxNi4xNS0yMSpgXCJ9fVxuICAgIDY1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDY1KVxuICAgICAgKjE2LjE1LTIxKlxuICAgICg2MiwgNjMpYFwiXV1cbiAgICA2N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBsb3RcbiAgICAgICg2NylcbiAgICAgICoxNi4xLTIyKlxuICAgICg2MCwgNjUpYFwiXV1cbiAgICA2OShbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjkpXG4gICAgICAqMTcuOC0xMipgXCJdKVxuICAgIDcwe3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDcwKVxuICAgICAgKjE3LjgtMTQqYFwifX1cbiAgICA3MltbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3MilcbiAgICAgICoxNy44LTE0KlxuICAgICg2OSwgNzApYFwiXV1cbiAgICA3NChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNzQpXG4gICAgICAqMTcuMTctMjEqYFwiXSlcbiAgICA3NXt7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg3NSlcbiAgICAgICoxNy4xNy0yMypgXCJ9fVxuICAgIDc3W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDc3KVxuICAgICAgKjE3LjE3LTIzKlxuICAgICg3NCwgNzUpYFwiXV1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiA3OSBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDQyLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA3OVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBvaW50c1xuICAgICAgKDc5KVxuICAgICAgKjE3LjEtMjQqXG4gICAgKDcyLCA3NylgXCJdXVxuICAgIDgyKFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg4MilcbiAgICAgICoxOS4xMi0xNipgXCJdKVxuICAgIDgze3tcImAjOTE7UlN5bWJvbCM5Mzsga1xuICAgICAgKDgzKVxuICAgICAgKjE5LjEyLTE4KmBcIn19XG4gICAgODVbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoODUpXG4gICAgICAqMTkuMTItMTgqXG4gICAgKDgyLCA4MylgXCJdXVxuICAgIDg3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDg3KVxuICAgICAgKjE5LjctMTkqXG4gICAgKDg1KWBcIl1dXG4gICAgODlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDg5KVxuICAgICAgKjE5LjEtMjAqXG4gICAgKDg3KWBcIl1dXG4gICAgMyAtLT58XCJhcmd1bWVudFwifCAxXG4gICAgNyAtLT58XCJhcmd1bWVudFwifCA1XG4gICAgMTEgLS0+fFwiYXJndW1lbnRcInwgOVxuICAgIDE2IC0tPnxcImFyZ3VtZW50XCJ8IDE0XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAxNlxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTdcbiAgICAxNyAtLT58XCJhcmd1bWVudFwifCAxNlxuICAgIDE3IC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDEyXG4gICAgMjIgLS0+fFwiYXJndW1lbnRcInwgMjBcbiAgICAxOCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDIyXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyM1xuICAgIDIzIC0tPnxcImFyZ3VtZW50XCJ8IDIyXG4gICAgMjMgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMThcbiAgICAyNiAtLT58XCJyZWFkc1wifCAxMlxuICAgIDI5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAyNlxuICAgIDI5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyN1xuICAgIDMxIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyOVxuICAgIDI0IC0tPnxcImRlZmluZWQtYnlcInwgMzFcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMyXG4gICAgMzIgLS0+fFwiYXJndW1lbnRcInwgMzFcbiAgICAzMiAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAyNFxuICAgIDM0IC0tPnxcInJlYWRzXCJ8IDI0XG4gICAgMzYgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDM0XG4gICAgMzggLS0+fFwicmVhZHNcInwgMTJcbiAgICA0NCAtLT58XCJyZWFkc1wifCA0M1xuICAgIDQ3IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwicmVhZHNcInwgNDNcbiAgICA0OCAtLT58XCJhcmd1bWVudFwifCA0NFxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDdcbiAgICA1MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNDhcbiAgICA1MCAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDM4XG4gICAgNTIgLS0+fFwiYXJndW1lbnRcInwgNTBcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTJcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTRcbiAgICA1NyAtLT58XCJyZWFkc1wifCAxOFxuICAgIDYwIC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA1N1xuICAgIDYwIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1OFxuICAgIDYyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNjUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDYyXG4gICAgNjUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYzXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYwXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDY1XG4gICAgNjkgLS0+fFwicmVhZHNcInwgMThcbiAgICA3MiAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNjlcbiAgICA3MiAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzBcbiAgICA3NCAtLT58XCJyZWFkc1wifCAxOFxuICAgIDc3IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA3NFxuICAgIDc3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3NVxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3MlxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3N1xuICAgIDgyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgODUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDgyXG4gICAgODUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDgzXG4gICAgODcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDg1XG4gICAgODkgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDg3IiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;7ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.29 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"dataflow":{".meta":{"timing":0},"graph":{"_idMap":{"size":119,"k2v":[[0,{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}}],[1,{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}}],[2,{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],[3,{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],[4,{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}}],[5,{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}}],[6,{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],[7,{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],[8,{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}}],[9,{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}}],[10,{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],[11,{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],[12,{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],[13,{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}}],[14,{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}}],[15,{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],[16,{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],[17,{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],[18,{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],[19,{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}}],[20,{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}}],[21,{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],[22,{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],[23,{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],[24,{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],[25,{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}}],[26,{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],[27,{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}}],[28,{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],[29,{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}}],[30,{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],[31,{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],[32,{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],[33,{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}}],[34,{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}}],[35,{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],[36,{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],[37,{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}}],[38,{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}}],[39,{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}}],[40,{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}}],[41,{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}}],[42,{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}}],[43,{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}}],[44,{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}}],[45,{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}}],[46,{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}}],[47,{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],[48,{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}}],[49,{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],[50,{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}}],[51,{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],[52,{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],[53,{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}}],[54,{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],[55,{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],[56,{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}}],[57,{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],[58,{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}}],[59,{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],[60,{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}}],[61,{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}}],[62,{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],[63,{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}}],[64,{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],[65,{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}}],[66,{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],[67,{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],[68,{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}}],[69,{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],[70,{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}}],[71,{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],[72,{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}}],[73,{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}}],[74,{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],[75,{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}}],[76,{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],[77,{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}}],[78,{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],[79,{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],[80,{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}}],[81,{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}}],[82,{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}],[83,{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}}],[84,{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],[85,{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}}],[86,{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],[87,{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}}],[88,{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],[89,{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],[90,{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"role":"root","index":0}}],["3-arg",{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],["7-arg",{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],["11-arg",{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],["17-arg",{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],["23-arg",{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],["32-arg",{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],["36-arg",{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],["55-arg",{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],["67-arg",{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],["79-arg",{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],["89-arg",{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],["1-arg",{"type":"RString","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0},"lexeme":"ggplot","location":[1,9,1,14],"content":{"quotes":"none","str":"ggplot"}}],["5-arg",{"type":"RString","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0},"lexeme":"dplyr","location":[2,9,2,13],"content":{"quotes":"none","str":"dplyr"}}],["9-arg",{"type":"RString","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0},"lexeme":"readr","location":[3,9,3,13],"content":{"quotes":"none","str":"readr"}}],["12-arg",{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],["16-arg",{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],["18-arg",{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],["22-arg",{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],["24-arg",{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],["31-arg",{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],["26-arg",{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],["52-arg",{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],["54-arg",{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],["57-arg",{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],["62-arg",{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],["69-arg",{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],["74-arg",{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],["82-arg",{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}]],"v2k":{}},"_unknownSideEffects":[3,7,11],"rootVertices":[1,3,5,7,9,11,14,16,12,17,20,22,18,23,26,27,29,31,24,32,34,36,38,43,44,46,47,48,50,52,54,55,57,58,60,62,63,65,67,69,70,72,74,75,77,79,82,83,85,87,89],"vertexInformation":[[1,{"tag":"value","id":1}],[3,{"tag":"function-call","id":3,"name":"library","onlyBuiltin":true,"args":[{"nodeId":1,"type":32}]}],[5,{"tag":"value","id":5}],[7,{"tag":"function-call","id":7,"name":"library","onlyBuiltin":true,"args":[{"nodeId":5,"type":32}]}],[9,{"tag":"value","id":9}],[11,{"tag":"function-call","id":11,"name":"library","onlyBuiltin":true,"args":[{"nodeId":9,"type":32}]}],[14,{"tag":"value","id":14}],[16,{"tag":"function-call","id":16,"environment":{"current":{"id":358,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":14,"type":32}]}],[12,{"tag":"variable-definition","id":12}],[17,{"tag":"function-call","id":17,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":12,"type":32},{"nodeId":16,"type":32}]}],[20,{"tag":"value","id":20}],[22,{"tag":"function-call","id":22,"environment":{"current":{"id":368,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]]]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":20,"type":32}]}],[18,{"tag":"variable-definition","id":18}],[23,{"tag":"function-call","id":23,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":18,"type":32},{"nodeId":22,"type":32}]}],[26,{"tag":"use","id":26}],[27,{"tag":"value","id":27}],[29,{"tag":"function-call","id":29,"name":"$","onlyBuiltin":true,"args":[{"nodeId":26,"type":32},{"nodeId":27,"type":32}]}],[31,{"tag":"function-call","id":31,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":29,"type":32}]}],[24,{"tag":"variable-definition","id":24}],[32,{"tag":"function-call","id":32,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":24,"type":32},{"nodeId":31,"type":32}]}],[34,{"tag":"use","id":34}],[36,{"tag":"function-call","id":36,"name":"print","onlyBuiltin":true,"args":[{"nodeId":34,"type":32}]}],[38,{"tag":"use","id":38}],[43,{"tag":"use","id":43}],[44,{"tag":"use","id":44}],[46,{"tag":"use","id":46}],[47,{"tag":"use","id":47}],[48,{"tag":"function-call","id":48,"environment":{"current":{"id":400,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"aes","onlyBuiltin":false,"args":[{"nodeId":44,"name":"x","type":32},{"nodeId":47,"name":"y","type":32}]}],[50,{"tag":"function-call","id":50,"environment":{"current":{"id":403,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"ggplot","onlyBuiltin":false,"args":[{"nodeId":38,"type":2},{"nodeId":48,"type":32}]}],[52,{"tag":"function-call","id":52,"name":"%>%","onlyBuiltin":true,"args":[{"nodeId":38,"type":32},{"nodeId":50,"type":32}]}],[54,{"tag":"function-call","id":54,"environment":{"current":{"id":409,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"geom_point","onlyBuiltin":false,"args":[]}],[55,{"tag":"function-call","id":55,"name":"+","onlyBuiltin":true,"args":[{"nodeId":52,"type":32},{"nodeId":54,"type":32}]}],[57,{"tag":"use","id":57}],[58,{"tag":"value","id":58}],[60,{"tag":"function-call","id":60,"name":"$","onlyBuiltin":true,"args":[{"nodeId":57,"type":32},{"nodeId":58,"type":32}]}],[62,{"tag":"use","id":62}],[63,{"tag":"value","id":63}],[65,{"tag":"function-call","id":65,"name":"$","onlyBuiltin":true,"args":[{"nodeId":62,"type":32},{"nodeId":63,"type":32}]}],[67,{"tag":"function-call","id":67,"name":"plot","onlyBuiltin":true,"args":[{"nodeId":60,"type":32},{"nodeId":65,"type":32}]}],[69,{"tag":"use","id":69}],[70,{"tag":"value","id":70}],[72,{"tag":"function-call","id":72,"name":"$","onlyBuiltin":true,"args":[{"nodeId":69,"type":32},{"nodeId":70,"type":32}]}],[74,{"tag":"use","id":74}],[75,{"tag":"value","id":75}],[77,{"tag":"function-call","id":77,"name":"$","onlyBuiltin":true,"args":[{"nodeId":74,"type":32},{"nodeId":75,"type":32}]}],[79,{"tag":"function-call","id":79,"environment":{"current":{"id":442,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"points","onlyBuiltin":false,"args":[{"nodeId":72,"type":32},{"nodeId":77,"type":32}]}],[82,{"tag":"use","id":82}],[83,{"tag":"value","id":83}],[85,{"tag":"function-call","id":85,"name":"$","onlyBuiltin":true,"args":[{"nodeId":82,"type":32},{"nodeId":83,"type":32}]}],[87,{"tag":"function-call","id":87,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":85,"type":32}]}],[89,{"tag":"function-call","id":89,"name":"print","onlyBuiltin":true,"args":[{"nodeId":87,"type":32}]}]],"edgeInformation":[[3,[[1,{"types":64}]]],[7,[[5,{"types":64}]]],[11,[[9,{"types":64}]]],[16,[[14,{"types":64}]]],[17,[[16,{"types":64}],[12,{"types":72}]]],[12,[[16,{"types":2}],[17,{"types":2}]]],[22,[[20,{"types":64}]]],[23,[[22,{"types":64}],[18,{"types":72}]]],[18,[[22,{"types":2}],[23,{"types":2}]]],[26,[[12,{"types":1}]]],[29,[[26,{"types":73}],[27,{"types":65}]]],[31,[[29,{"types":65}]]],[32,[[31,{"types":64}],[24,{"types":72}]]],[24,[[31,{"types":2}],[32,{"types":2}]]],[34,[[24,{"types":1}]]],[36,[[34,{"types":73}]]],[38,[[12,{"types":1}]]],[52,[[38,{"types":64}],[50,{"types":64}]]],[44,[[43,{"types":1}]]],[48,[[43,{"types":1}],[44,{"types":64}],[46,{"types":1}],[47,{"types":64}]]],[47,[[46,{"types":1}]]],[50,[[48,{"types":65}],[38,{"types":64}]]],[55,[[52,{"types":65}],[54,{"types":65}]]],[57,[[18,{"types":1}]]],[60,[[57,{"types":73}],[58,{"types":65}]]],[67,[[60,{"types":65}],[65,{"types":65}]]],[62,[[18,{"types":1}]]],[65,[[62,{"types":73}],[63,{"types":65}]]],[69,[[18,{"types":1}]]],[72,[[69,{"types":73}],[70,{"types":65}]]],[79,[[72,{"types":65}],[77,{"types":65}]]],[74,[[18,{"types":1}]]],[77,[[74,{"types":73}],[75,{"types":65}]]],[82,[[18,{"types":1}]]],[85,[[82,{"types":73}],[83,{"types":65}]]],[87,[[85,{"types":65}]]],[89,[[87,{"types":73}]]]]}},".meta":{"timing":1}}
```



</details>


<details> <summary style="color:gray">Original Code</summary>



```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```
<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _7.60 ms_ (including parsing and normalization) within the generation environment. 
We encountered unknown side effects (with ids: [3,7,11]) during the analysis.


```mermaid
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 476----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 508----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 511----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 517----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 550----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```
	

<details>

<summary style="color:gray">Mermaid Code </summary>

```
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 476----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 508----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 511----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 517----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 550----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```

</details>

</details>



</details>
	



	
		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Dataflow Query query is `executeDataflowQuery` in [`./src/queries/catalog/dataflow-query/dataflow-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/catalog/dataflow-query/dataflow-query-executor.ts).

</details>	





### Normalized AST Query


Maybe you want to handle only the result of the query execution, or you just need the [normalized AST](https://github.com/flowr-analysis/flowr/wiki//Normalized%20AST) again.
This query type does exactly that!

Using the example code from above, the following query returns the normalized AST of the code:


```json
[
  {
    "type": "normalized-ast"
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**normalized-ast**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;[Normalized&nbsp;AST](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgbjkwKFtcIlJFeHByZXNzaW9uTGlzdCAoOTApXG4gXCJdKVxuICAgIG4zKFtcIlJGdW5jdGlvbkNhbGwgKDMpXG5saWJyYXJ5XCJdKVxuICAgIG45MCAtLT58XCJleHByLWxpc3QtY2hpbGQtMFwifCBuM1xuICAgIG4wKFtcIlJTeW1ib2wgKDApXG5saWJyYXJ5XCJdKVxuICAgIG4zIC0tPnxcImNhbGwtbmFtZVwifCBuMFxuICAgIG4yKFtcIlJBcmd1bWVudCAoMilcbmdncGxvdFwiXSlcbiAgICBuMyAtLT58XCJjYWxsLWFyZ3VtZW50LTFcInwgbjJcbiAgICBuMShbXCJSU3ltYm9sICgxKVxuZ2dwbG90XCJdKVxuICAgIG4yIC0tPnxcImFyZy12YWx1ZVwifCBuMVxuICAgIG43KFtcIlJGdW5jdGlvbkNhbGwgKDcpXG5saWJyYXJ5XCJdKVxuICAgIG45MCAtLT58XCJleHByLWxpc3QtY2hpbGQtMVwifCBuN1xuICAgIG40KFtcIlJTeW1ib2wgKDQpXG5saWJyYXJ5XCJdKVxuICAgIG43IC0tPnxcImNhbGwtbmFtZVwifCBuNFxuICAgIG42KFtcIlJBcmd1bWVudCAoNilcbmRwbHlyXCJdKVxuICAgIG43IC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuNlxuICAgIG41KFtcIlJTeW1ib2wgKDUpXG5kcGx5clwiXSlcbiAgICBuNiAtLT58XCJhcmctdmFsdWVcInwgbjVcbiAgICBuMTEoW1wiUkZ1bmN0aW9uQ2FsbCAoMTEpXG5saWJyYXJ5XCJdKVxuICAgIG45MCAtLT58XCJleHByLWxpc3QtY2hpbGQtMlwifCBuMTFcbiAgICBuOChbXCJSU3ltYm9sICg4KVxubGlicmFyeVwiXSlcbiAgICBuMTEgLS0+fFwiY2FsbC1uYW1lXCJ8IG44XG4gICAgbjEwKFtcIlJBcmd1bWVudCAoMTApXG5yZWFkclwiXSlcbiAgICBuMTEgLS0+fFwiY2FsbC1hcmd1bWVudC0xXCJ8IG4xMFxuICAgIG45KFtcIlJTeW1ib2wgKDkpXG5yZWFkclwiXSlcbiAgICBuMTAgLS0+fFwiYXJnLXZhbHVlXCJ8IG45XG4gICAgbjE3KFtcIlJCaW5hcnlPcCAoMTcpXG4jNjA7IzQ1O1wiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLTNcInwgbjE3XG4gICAgbjEyKFtcIlJTeW1ib2wgKDEyKVxuZGF0YVwiXSlcbiAgICBuMTcgLS0+fFwiYmlub3AtbGhzXCJ8IG4xMlxuICAgIG4xNihbXCJSRnVuY3Rpb25DYWxsICgxNilcbnJlYWQjOTU7Y3N2XCJdKVxuICAgIG4xNyAtLT58XCJiaW5vcC1yaHNcInwgbjE2XG4gICAgbjEzKFtcIlJTeW1ib2wgKDEzKVxucmVhZCM5NTtjc3ZcIl0pXG4gICAgbjE2IC0tPnxcImNhbGwtbmFtZVwifCBuMTNcbiAgICBuMTUoW1wiUkFyZ3VtZW50ICgxNSlcbiMzOTtkYXRhLmNzdiMzOTtcIl0pXG4gICAgbjE2IC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuMTVcbiAgICBuMTQoW1wiUlN0cmluZyAoMTQpXG4jMzk7ZGF0YS5jc3YjMzk7XCJdKVxuICAgIG4xNSAtLT58XCJhcmctdmFsdWVcInwgbjE0XG4gICAgbjIzKFtcIlJCaW5hcnlPcCAoMjMpXG4jNjA7IzQ1O1wiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLTRcInwgbjIzXG4gICAgbjE4KFtcIlJTeW1ib2wgKDE4KVxuZGF0YTJcIl0pXG4gICAgbjIzIC0tPnxcImJpbm9wLWxoc1wifCBuMThcbiAgICBuMjIoW1wiUkZ1bmN0aW9uQ2FsbCAoMjIpXG5yZWFkIzk1O2NzdlwiXSlcbiAgICBuMjMgLS0+fFwiYmlub3AtcmhzXCJ8IG4yMlxuICAgIG4xOShbXCJSU3ltYm9sICgxOSlcbnJlYWQjOTU7Y3N2XCJdKVxuICAgIG4yMiAtLT58XCJjYWxsLW5hbWVcInwgbjE5XG4gICAgbjIxKFtcIlJBcmd1bWVudCAoMjEpXG4jMzk7ZGF0YTIuY3N2IzM5O1wiXSlcbiAgICBuMjIgLS0+fFwiY2FsbC1hcmd1bWVudC0xXCJ8IG4yMVxuICAgIG4yMChbXCJSU3RyaW5nICgyMClcbiMzOTtkYXRhMi5jc3YjMzk7XCJdKVxuICAgIG4yMSAtLT58XCJhcmctdmFsdWVcInwgbjIwXG4gICAgbjMyKFtcIlJCaW5hcnlPcCAoMzIpXG4jNjA7IzQ1O1wiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLTVcInwgbjMyXG4gICAgbjI0KFtcIlJTeW1ib2wgKDI0KVxubVwiXSlcbiAgICBuMzIgLS0+fFwiYmlub3AtbGhzXCJ8IG4yNFxuICAgIG4zMShbXCJSRnVuY3Rpb25DYWxsICgzMSlcbm1lYW5cIl0pXG4gICAgbjMyIC0tPnxcImJpbm9wLXJoc1wifCBuMzFcbiAgICBuMjUoW1wiUlN5bWJvbCAoMjUpXG5tZWFuXCJdKVxuICAgIG4zMSAtLT58XCJjYWxsLW5hbWVcInwgbjI1XG4gICAgbjMwKFtcIlJBcmd1bWVudCAoMzApXG5kYXRhJHhcIl0pXG4gICAgbjMxIC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuMzBcbiAgICBuMjkoW1wiUkFjY2VzcyAoMjkpXG4kXCJdKVxuICAgIG4zMCAtLT58XCJhcmctdmFsdWVcInwgbjI5XG4gICAgbjI2KFtcIlJTeW1ib2wgKDI2KVxuZGF0YVwiXSlcbiAgICBuMjkgLS0+fFwiYWNjZXNzZWRcInwgbjI2XG4gICAgbjM2KFtcIlJGdW5jdGlvbkNhbGwgKDM2KVxucHJpbnRcIl0pXG4gICAgbjkwIC0tPnxcImV4cHItbGlzdC1jaGlsZC02XCJ8IG4zNlxuICAgIG4zMyhbXCJSU3ltYm9sICgzMylcbnByaW50XCJdKVxuICAgIG4zNiAtLT58XCJjYWxsLW5hbWVcInwgbjMzXG4gICAgbjM1KFtcIlJBcmd1bWVudCAoMzUpXG5tXCJdKVxuICAgIG4zNiAtLT58XCJjYWxsLWFyZ3VtZW50LTFcInwgbjM1XG4gICAgbjM0KFtcIlJTeW1ib2wgKDM0KVxubVwiXSlcbiAgICBuMzUgLS0+fFwiYXJnLXZhbHVlXCJ8IG4zNFxuICAgIG41NShbXCJSQmluYXJ5T3AgKDU1KVxuIzQzO1wiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLTdcInwgbjU1XG4gICAgbjUyKFtcIlJGdW5jdGlvbkNhbGwgKDUyKVxuZGF0YSAlIzYyOyVcblx0Z2dwbG90KGFlcyh4ID0geCwgeSA9IHkpKVwiXSlcbiAgICBuNTUgLS0+fFwiYmlub3AtbGhzXCJ8IG41MlxuICAgIG4zNyhbXCJSU3ltYm9sICgzNylcbiUjNjI7JVwiXSlcbiAgICBuNTIgLS0+fFwiY2FsbC1uYW1lXCJ8IG4zN1xuICAgIG4zOShbXCJSQXJndW1lbnQgKDM5KVxuZGF0YVwiXSlcbiAgICBuNTIgLS0+fFwiY2FsbC1hcmd1bWVudC0xXCJ8IG4zOVxuICAgIG4zOChbXCJSU3ltYm9sICgzOClcbmRhdGFcIl0pXG4gICAgbjM5IC0tPnxcImFyZy12YWx1ZVwifCBuMzhcbiAgICBuNTEoW1wiUkFyZ3VtZW50ICg1MSlcbmdncGxvdFwiXSlcbiAgICBuNTIgLS0+fFwiY2FsbC1hcmd1bWVudC0yXCJ8IG41MVxuICAgIG41MChbXCJSRnVuY3Rpb25DYWxsICg1MClcbmdncGxvdFwiXSlcbiAgICBuNTEgLS0+fFwiYXJnLXZhbHVlXCJ8IG41MFxuICAgIG40MChbXCJSU3ltYm9sICg0MClcbmdncGxvdFwiXSlcbiAgICBuNTAgLS0+fFwiY2FsbC1uYW1lXCJ8IG40MFxuICAgIG40OShbXCJSQXJndW1lbnQgKDQ5KVxuYWVzKHggPSB4LCB5ID0geSlcIl0pXG4gICAgbjUwIC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuNDlcbiAgICBuNDgoW1wiUkZ1bmN0aW9uQ2FsbCAoNDgpXG5hZXNcIl0pXG4gICAgbjQ5IC0tPnxcImFyZy12YWx1ZVwifCBuNDhcbiAgICBuNDEoW1wiUlN5bWJvbCAoNDEpXG5hZXNcIl0pXG4gICAgbjQ4IC0tPnxcImNhbGwtbmFtZVwifCBuNDFcbiAgICBuNDQoW1wiUkFyZ3VtZW50ICg0NClcbnhcIl0pXG4gICAgbjQ4IC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuNDRcbiAgICBuNDIoW1wiUlN5bWJvbCAoNDIpXG54XCJdKVxuICAgIG40NCAtLT58XCJhcmctbmFtZVwifCBuNDJcbiAgICBuNDMoW1wiUlN5bWJvbCAoNDMpXG54XCJdKVxuICAgIG40NCAtLT58XCJhcmctdmFsdWVcInwgbjQzXG4gICAgbjQ3KFtcIlJBcmd1bWVudCAoNDcpXG55XCJdKVxuICAgIG40OCAtLT58XCJjYWxsLWFyZ3VtZW50LTJcInwgbjQ3XG4gICAgbjQ1KFtcIlJTeW1ib2wgKDQ1KVxueVwiXSlcbiAgICBuNDcgLS0+fFwiYXJnLW5hbWVcInwgbjQ1XG4gICAgbjQ2KFtcIlJTeW1ib2wgKDQ2KVxueVwiXSlcbiAgICBuNDcgLS0+fFwiYXJnLXZhbHVlXCJ8IG40NlxuICAgIG41NChbXCJSRnVuY3Rpb25DYWxsICg1NClcbmdlb20jOTU7cG9pbnRcIl0pXG4gICAgbjU1IC0tPnxcImJpbm9wLXJoc1wifCBuNTRcbiAgICBuNTMoW1wiUlN5bWJvbCAoNTMpXG5nZW9tIzk1O3BvaW50XCJdKVxuICAgIG41NCAtLT58XCJjYWxsLW5hbWVcInwgbjUzXG4gICAgbjY3KFtcIlJGdW5jdGlvbkNhbGwgKDY3KVxucGxvdFwiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLThcInwgbjY3XG4gICAgbjU2KFtcIlJTeW1ib2wgKDU2KVxucGxvdFwiXSlcbiAgICBuNjcgLS0+fFwiY2FsbC1uYW1lXCJ8IG41NlxuICAgIG42MShbXCJSQXJndW1lbnQgKDYxKVxuZGF0YTIkeFwiXSlcbiAgICBuNjcgLS0+fFwiY2FsbC1hcmd1bWVudC0xXCJ8IG42MVxuICAgIG42MChbXCJSQWNjZXNzICg2MClcbiRcIl0pXG4gICAgbjYxIC0tPnxcImFyZy12YWx1ZVwifCBuNjBcbiAgICBuNTcoW1wiUlN5bWJvbCAoNTcpXG5kYXRhMlwiXSlcbiAgICBuNjAgLS0+fFwiYWNjZXNzZWRcInwgbjU3XG4gICAgbjY2KFtcIlJBcmd1bWVudCAoNjYpXG5kYXRhMiR5XCJdKVxuICAgIG42NyAtLT58XCJjYWxsLWFyZ3VtZW50LTJcInwgbjY2XG4gICAgbjY1KFtcIlJBY2Nlc3MgKDY1KVxuJFwiXSlcbiAgICBuNjYgLS0+fFwiYXJnLXZhbHVlXCJ8IG42NVxuICAgIG42MihbXCJSU3ltYm9sICg2MilcbmRhdGEyXCJdKVxuICAgIG42NSAtLT58XCJhY2Nlc3NlZFwifCBuNjJcbiAgICBuNzkoW1wiUkZ1bmN0aW9uQ2FsbCAoNzkpXG5wb2ludHNcIl0pXG4gICAgbjkwIC0tPnxcImV4cHItbGlzdC1jaGlsZC05XCJ8IG43OVxuICAgIG42OChbXCJSU3ltYm9sICg2OClcbnBvaW50c1wiXSlcbiAgICBuNzkgLS0+fFwiY2FsbC1uYW1lXCJ8IG42OFxuICAgIG43MyhbXCJSQXJndW1lbnQgKDczKVxuZGF0YTIkeFwiXSlcbiAgICBuNzkgLS0+fFwiY2FsbC1hcmd1bWVudC0xXCJ8IG43M1xuICAgIG43MihbXCJSQWNjZXNzICg3MilcbiRcIl0pXG4gICAgbjczIC0tPnxcImFyZy12YWx1ZVwifCBuNzJcbiAgICBuNjkoW1wiUlN5bWJvbCAoNjkpXG5kYXRhMlwiXSlcbiAgICBuNzIgLS0+fFwiYWNjZXNzZWRcInwgbjY5XG4gICAgbjc4KFtcIlJBcmd1bWVudCAoNzgpXG5kYXRhMiR5XCJdKVxuICAgIG43OSAtLT58XCJjYWxsLWFyZ3VtZW50LTJcInwgbjc4XG4gICAgbjc3KFtcIlJBY2Nlc3MgKDc3KVxuJFwiXSlcbiAgICBuNzggLS0+fFwiYXJnLXZhbHVlXCJ8IG43N1xuICAgIG43NChbXCJSU3ltYm9sICg3NClcbmRhdGEyXCJdKVxuICAgIG43NyAtLT58XCJhY2Nlc3NlZFwifCBuNzRcbiAgICBuODkoW1wiUkZ1bmN0aW9uQ2FsbCAoODkpXG5wcmludFwiXSlcbiAgICBuOTAgLS0+fFwiZXhwci1saXN0LWNoaWxkLTEwXCJ8IG44OVxuICAgIG44MChbXCJSU3ltYm9sICg4MClcbnByaW50XCJdKVxuICAgIG44OSAtLT58XCJjYWxsLW5hbWVcInwgbjgwXG4gICAgbjg4KFtcIlJBcmd1bWVudCAoODgpXG5tZWFuKGRhdGEyJGspXCJdKVxuICAgIG44OSAtLT58XCJjYWxsLWFyZ3VtZW50LTFcInwgbjg4XG4gICAgbjg3KFtcIlJGdW5jdGlvbkNhbGwgKDg3KVxubWVhblwiXSlcbiAgICBuODggLS0+fFwiYXJnLXZhbHVlXCJ8IG44N1xuICAgIG44MShbXCJSU3ltYm9sICg4MSlcbm1lYW5cIl0pXG4gICAgbjg3IC0tPnxcImNhbGwtbmFtZVwifCBuODFcbiAgICBuODYoW1wiUkFyZ3VtZW50ICg4NilcbmRhdGEyJGtcIl0pXG4gICAgbjg3IC0tPnxcImNhbGwtYXJndW1lbnQtMVwifCBuODZcbiAgICBuODUoW1wiUkFjY2VzcyAoODUpXG4kXCJdKVxuICAgIG44NiAtLT58XCJhcmctdmFsdWVcInwgbjg1XG4gICAgbjgyKFtcIlJTeW1ib2wgKDgyKVxuZGF0YTJcIl0pXG4gICAgbjg1IC0tPnxcImFjY2Vzc2VkXCJ8IG44MlxuIiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;7ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.93 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"normalized-ast":{".meta":{"timing":0},"normalized":{"ast":{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"role":"root","index":0}},"idMap":{"size":119,"k2v":[[0,{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}}],[1,{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}}],[2,{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],[3,{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],[4,{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}}],[5,{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}}],[6,{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],[7,{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],[8,{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}}],[9,{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}}],[10,{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],[11,{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],[12,{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],[13,{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}}],[14,{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}}],[15,{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],[16,{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],[17,{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],[18,{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],[19,{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}}],[20,{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}}],[21,{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],[22,{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],[23,{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],[24,{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],[25,{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}}],[26,{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],[27,{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}}],[28,{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],[29,{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}}],[30,{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],[31,{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],[32,{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],[33,{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}}],[34,{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}}],[35,{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],[36,{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],[37,{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}}],[38,{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}}],[39,{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}}],[40,{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}}],[41,{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}}],[42,{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}}],[43,{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}}],[44,{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}}],[45,{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}}],[46,{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}}],[47,{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],[48,{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}}],[49,{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],[50,{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}}],[51,{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],[52,{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],[53,{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}}],[54,{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],[55,{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],[56,{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}}],[57,{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],[58,{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}}],[59,{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],[60,{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}}],[61,{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}}],[62,{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],[63,{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}}],[64,{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],[65,{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}}],[66,{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],[67,{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],[68,{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}}],[69,{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],[70,{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}}],[71,{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],[72,{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}}],[73,{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}}],[74,{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],[75,{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}}],[76,{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],[77,{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}}],[78,{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],[79,{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],[80,{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}}],[81,{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}}],[82,{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}],[83,{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}}],[84,{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],[85,{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}}],[86,{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],[87,{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}}],[88,{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],[89,{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],[90,{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"role":"root","index":0}}],["3-arg",{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],["7-arg",{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],["11-arg",{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],["17-arg",{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],["23-arg",{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],["32-arg",{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],["36-arg",{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],["55-arg",{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],["67-arg",{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],["79-arg",{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],["89-arg",{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],["1-arg",{"type":"RString","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0},"lexeme":"ggplot","location":[1,9,1,14],"content":{"quotes":"none","str":"ggplot"}}],["5-arg",{"type":"RString","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0},"lexeme":"dplyr","location":[2,9,2,13],"content":{"quotes":"none","str":"dplyr"}}],["9-arg",{"type":"RString","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0},"lexeme":"readr","location":[3,9,3,13],"content":{"quotes":"none","str":"readr"}}],["12-arg",{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],["16-arg",{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],["18-arg",{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],["22-arg",{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],["24-arg",{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],["31-arg",{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],["26-arg",{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],["52-arg",{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],["54-arg",{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],["57-arg",{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],["62-arg",{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],["69-arg",{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],["74-arg",{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],["82-arg",{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}]],"v2k":{}}}},".meta":{"timing":0}}
```



</details>


<details> <summary style="color:gray">Original Code</summary>



```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```
<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _7.03 ms_ (including parsing and normalization) within the generation environment. 
We encountered unknown side effects (with ids: [3,7,11]) during the analysis.


```mermaid
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 692----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 724----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 727----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 733----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 766----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```
	

<details>

<summary style="color:gray">Mermaid Code </summary>

```
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 692----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 724----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 727----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 733----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 766----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```

</details>

</details>



</details>
	



	
		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Normalized AST Query query is `executeNormalizedAstQuery` in [`./src/queries/catalog/normalized-ast-query/normalized-ast-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/catalog/normalized-ast-query/normalized-ast-query-executor.ts).

</details>	





### Dataflow Cluster Query


This query automatically calculates clusters in flowR's dataflow graph and returns a list of all clusters
found.

Using the example code from above, the following query returns all clusters:


```json
[
  {
    "type": "dataflow-cluster"
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**dataflow-cluster**&nbsp;(1ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;Found&nbsp;5&nbsp;clusters\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;&nbsp;{89,&nbsp;87,&nbsp;85,&nbsp;82,&nbsp;18,&nbsp;22,&nbsp;...&nbsp;(see&nbsp;JSON&nbsp;below)}&nbsp;([marked](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIDdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoNylcbiAgICAgICoyLjEtMTQqXG4gICAgKDUpYFwiXV1cbiAgICBzdHlsZSA3IHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgOXt7XCJgIzkxO1JTeW1ib2wjOTM7IHJlYWRyXG4gICAgICAoOSlcbiAgICAgICozLjktMTMqYFwifX1cbiAgICAxMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgxMSlcbiAgICAgICozLjEtMTQqXG4gICAgKDkpYFwiXV1cbiAgICBzdHlsZSAxMSBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDE0e3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEuY3N2IzM5O1xuICAgICAgKDE0KVxuICAgICAgKjYuMTgtMjcqYFwifX1cbiAgICAxNltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMTYpXG4gICAgICAqNi45LTI4KlxuICAgICgxNClgXCJdXVxuICAgIDEyW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMTIpXG4gICAgICAqNi4xLTQqYFwiXVxuICAgIDE3W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDE3KVxuICAgICAgKjYuMS0yOCpcbiAgICAoMTIsIDE2KWBcIl1dXG4gICAgMjB7e1wiYCM5MTtSU3RyaW5nIzkzOyAjMzk7ZGF0YTIuY3N2IzM5O1xuICAgICAgKDIwKVxuICAgICAgKjcuMTktMjkqYFwifX1cbiAgICBzdHlsZSAyMCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAyMltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMjIpXG4gICAgICAqNy4xMC0zMCpcbiAgICAoMjApYFwiXV1cbiAgICBzdHlsZSAyMiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAxOFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICgxOClcbiAgICAgICo3LjEtNSpgXCJdXG4gICAgc3R5bGUgMTggc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMjNbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMjMpXG4gICAgICAqNy4xLTMwKlxuICAgICgxOCwgMjIpYFwiXV1cbiAgICBzdHlsZSAyMyBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAyNihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgyNilcbiAgICAgICo5LjExLTE0KmBcIl0pXG4gICAgMjd7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoMjcpXG4gICAgICAqOS4xMS0xNipgXCJ9fVxuICAgIDI5W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDI5KVxuICAgICAgKjkuMTEtMTYqXG4gICAgKDI2LCAyNylgXCJdXVxuICAgIDMxW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDMxKVxuICAgICAgKjkuNi0xNypcbiAgICAoMjkpYFwiXV1cbiAgICAyNFtcImAjOTE7UlN5bWJvbCM5MzsgbVxuICAgICAgKDI0KVxuICAgICAgKjkuMSpgXCJdXG4gICAgMzJbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMzIpXG4gICAgICAqOS4xLTE3KlxuICAgICgyNCwgMzEpYFwiXV1cbiAgICAzNChbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgzNClcbiAgICAgICoxMC43KmBcIl0pXG4gICAgMzZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDM2KVxuICAgICAgKjEwLjEtOCpcbiAgICAoMzQpYFwiXV1cbiAgICAzOChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgzOClcbiAgICAgICoxMi4xLTQqYFwiXSlcbiAgICA0MyhbXCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg0MylcbiAgICAgICoxMy4yNCpgXCJdKVxuICAgIDQ0KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB4XG4gICAgICAoNDQpXG4gICAgICAqMTMuMjAqYFwiXSlcbiAgICA0NihbXCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg0NilcbiAgICAgICoxMy4zMSpgXCJdKVxuICAgIDQ3KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB5XG4gICAgICAoNDcpXG4gICAgICAqMTMuMjcqYFwiXSlcbiAgICA0OFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGFlc1xuICAgICAgKDQ4KVxuICAgICAgKjEzLjE2LTMyKlxuICAgICh4ICg0NCksIHkgKDQ3KSlgXCJdXVxuICAgIDUwW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZ2dwbG90XG4gICAgICAoNTApXG4gICAgICAqMTMuOS0zMypcbiAgICAoMzgsIDQ4KWBcIl1dXG4gICAgNTJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBkYXRhICUjNjI7JVxuXHRnZ3Bsb3QoYWVzKHggPSB4LCB5ID0geSkpXG4gICAgICAoNTIpXG4gICAgICAqMTIuNi04KlxuICAgICgzOCwgNTApYFwiXV1cbiAgICA1NFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdlb20jOTU7cG9pbnRcbiAgICAgICg1NClcbiAgICAgICoxNC45LTIwKmBcIl1dXG4gICAgNTVbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM0MztcbiAgICAgICg1NSlcbiAgICAgICoxMi4xLTE0LjIwKlxuICAgICg1MiwgNTQpYFwiXV1cbiAgICA1NyhbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNTcpXG4gICAgICAqMTYuNi0xMCpgXCJdKVxuICAgIHN0eWxlIDU3IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDU4e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDU4KVxuICAgICAgKjE2LjYtMTIqYFwifX1cbiAgICBzdHlsZSA1OCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA2MFtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2MClcbiAgICAgICoxNi42LTEyKlxuICAgICg1NywgNTgpYFwiXV1cbiAgICBzdHlsZSA2MCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA2MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjIpXG4gICAgICAqMTYuMTUtMTkqYFwiXSlcbiAgICBzdHlsZSA2MiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA2M3t7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg2MylcbiAgICAgICoxNi4xNS0yMSpgXCJ9fVxuICAgIHN0eWxlIDYzIHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDY1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDY1KVxuICAgICAgKjE2LjE1LTIxKlxuICAgICg2MiwgNjMpYFwiXV1cbiAgICBzdHlsZSA2NSBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA2N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBsb3RcbiAgICAgICg2NylcbiAgICAgICoxNi4xLTIyKlxuICAgICg2MCwgNjUpYFwiXV1cbiAgICBzdHlsZSA2NyBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA2OShbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjkpXG4gICAgICAqMTcuOC0xMipgXCJdKVxuICAgIHN0eWxlIDY5IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDcwe3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDcwKVxuICAgICAgKjE3LjgtMTQqYFwifX1cbiAgICBzdHlsZSA3MCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA3MltbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3MilcbiAgICAgICoxNy44LTE0KlxuICAgICg2OSwgNzApYFwiXV1cbiAgICBzdHlsZSA3MiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA3NChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNzQpXG4gICAgICAqMTcuMTctMjEqYFwiXSlcbiAgICBzdHlsZSA3NCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA3NXt7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg3NSlcbiAgICAgICoxNy4xNy0yMypgXCJ9fVxuICAgIHN0eWxlIDc1IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDc3W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDc3KVxuICAgICAgKjE3LjE3LTIzKlxuICAgICg3NCwgNzUpYFwiXV1cbiAgICBzdHlsZSA3NyBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA3OVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBvaW50c1xuICAgICAgKDc5KVxuICAgICAgKjE3LjEtMjQqXG4gICAgKDcyLCA3NylgXCJdXVxuICAgIHN0eWxlIDc5IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDgyKFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg4MilcbiAgICAgICoxOS4xMi0xNipgXCJdKVxuICAgIHN0eWxlIDgyIHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDgze3tcImAjOTE7UlN5bWJvbCM5Mzsga1xuICAgICAgKDgzKVxuICAgICAgKjE5LjEyLTE4KmBcIn19XG4gICAgc3R5bGUgODMgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgODVbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoODUpXG4gICAgICAqMTkuMTItMTgqXG4gICAgKDgyLCA4MylgXCJdXVxuICAgIHN0eWxlIDg1IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDg3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDg3KVxuICAgICAgKjE5LjctMTkqXG4gICAgKDg1KWBcIl1dXG4gICAgc3R5bGUgODcgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgODlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDg5KVxuICAgICAgKjE5LjEtMjAqXG4gICAgKDg3KWBcIl1dXG4gICAgc3R5bGUgODkgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMyAtLT58XCJhcmd1bWVudFwifCAxXG4gICAgNyAtLT58XCJhcmd1bWVudFwifCA1XG4gICAgMTEgLS0+fFwiYXJndW1lbnRcInwgOVxuICAgIDE2IC0tPnxcImFyZ3VtZW50XCJ8IDE0XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAxNlxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTdcbiAgICAxNyAtLT58XCJhcmd1bWVudFwifCAxNlxuICAgIDE3IC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDEyXG4gICAgMjIgLS0+fFwiYXJndW1lbnRcInwgMjBcbiAgICAxOCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDIyXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyM1xuICAgIDIzIC0tPnxcImFyZ3VtZW50XCJ8IDIyXG4gICAgMjMgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMThcbiAgICAyNiAtLT58XCJyZWFkc1wifCAxMlxuICAgIDI5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAyNlxuICAgIDI5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyN1xuICAgIDMxIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyOVxuICAgIDI0IC0tPnxcImRlZmluZWQtYnlcInwgMzFcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMyXG4gICAgMzIgLS0+fFwiYXJndW1lbnRcInwgMzFcbiAgICAzMiAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAyNFxuICAgIDM0IC0tPnxcInJlYWRzXCJ8IDI0XG4gICAgMzYgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDM0XG4gICAgMzggLS0+fFwicmVhZHNcInwgMTJcbiAgICA0NCAtLT58XCJyZWFkc1wifCA0M1xuICAgIDQ3IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwicmVhZHNcInwgNDNcbiAgICA0OCAtLT58XCJhcmd1bWVudFwifCA0NFxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDdcbiAgICA1MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNDhcbiAgICA1MCAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDM4XG4gICAgNTIgLS0+fFwiYXJndW1lbnRcInwgNTBcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTJcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTRcbiAgICA1NyAtLT58XCJyZWFkc1wifCAxOFxuICAgIDYwIC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA1N1xuICAgIDYwIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1OFxuICAgIDYyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNjUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDYyXG4gICAgNjUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYzXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYwXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDY1XG4gICAgNjkgLS0+fFwicmVhZHNcInwgMThcbiAgICA3MiAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNjlcbiAgICA3MiAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzBcbiAgICA3NCAtLT58XCJyZWFkc1wifCAxOFxuICAgIDc3IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA3NFxuICAgIDc3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3NVxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3MlxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3N1xuICAgIDgyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgODUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDgyXG4gICAgODUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDgzXG4gICAgODcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDg1XG4gICAgODkgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDg3IiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19))\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;&nbsp;{55,&nbsp;52,&nbsp;38,&nbsp;12,&nbsp;16,&nbsp;14,&nbsp;...&nbsp;(see&nbsp;JSON&nbsp;below)}&nbsp;([marked](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIDdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoNylcbiAgICAgICoyLjEtMTQqXG4gICAgKDUpYFwiXV1cbiAgICBzdHlsZSA3IHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgOXt7XCJgIzkxO1JTeW1ib2wjOTM7IHJlYWRyXG4gICAgICAoOSlcbiAgICAgICozLjktMTMqYFwifX1cbiAgICAxMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgxMSlcbiAgICAgICozLjEtMTQqXG4gICAgKDkpYFwiXV1cbiAgICBzdHlsZSAxMSBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDE0e3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEuY3N2IzM5O1xuICAgICAgKDE0KVxuICAgICAgKjYuMTgtMjcqYFwifX1cbiAgICBzdHlsZSAxNCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAxNltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMTYpXG4gICAgICAqNi45LTI4KlxuICAgICgxNClgXCJdXVxuICAgIHN0eWxlIDE2IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDEyW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMTIpXG4gICAgICAqNi4xLTQqYFwiXVxuICAgIHN0eWxlIDEyIHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDE3W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDE3KVxuICAgICAgKjYuMS0yOCpcbiAgICAoMTIsIDE2KWBcIl1dXG4gICAgc3R5bGUgMTcgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMjB7e1wiYCM5MTtSU3RyaW5nIzkzOyAjMzk7ZGF0YTIuY3N2IzM5O1xuICAgICAgKDIwKVxuICAgICAgKjcuMTktMjkqYFwifX1cbiAgICAyMltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMjIpXG4gICAgICAqNy4xMC0zMCpcbiAgICAoMjApYFwiXV1cbiAgICAxOFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICgxOClcbiAgICAgICo3LjEtNSpgXCJdXG4gICAgMjNbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMjMpXG4gICAgICAqNy4xLTMwKlxuICAgICgxOCwgMjIpYFwiXV1cbiAgICAyNihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgyNilcbiAgICAgICo5LjExLTE0KmBcIl0pXG4gICAgc3R5bGUgMjYgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMjd7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoMjcpXG4gICAgICAqOS4xMS0xNipgXCJ9fVxuICAgIHN0eWxlIDI3IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDI5W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDI5KVxuICAgICAgKjkuMTEtMTYqXG4gICAgKDI2LCAyNylgXCJdXVxuICAgIHN0eWxlIDI5IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDMxW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDMxKVxuICAgICAgKjkuNi0xNypcbiAgICAoMjkpYFwiXV1cbiAgICBzdHlsZSAzMSBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAyNFtcImAjOTE7UlN5bWJvbCM5MzsgbVxuICAgICAgKDI0KVxuICAgICAgKjkuMSpgXCJdXG4gICAgc3R5bGUgMjQgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMzJbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMzIpXG4gICAgICAqOS4xLTE3KlxuICAgICgyNCwgMzEpYFwiXV1cbiAgICBzdHlsZSAzMiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAzNChbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgzNClcbiAgICAgICoxMC43KmBcIl0pXG4gICAgc3R5bGUgMzQgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgMzZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDM2KVxuICAgICAgKjEwLjEtOCpcbiAgICAoMzQpYFwiXV1cbiAgICBzdHlsZSAzNiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAzOChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgzOClcbiAgICAgICoxMi4xLTQqYFwiXSlcbiAgICBzdHlsZSAzOCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA0MyhbXCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg0MylcbiAgICAgICoxMy4yNCpgXCJdKVxuICAgIHN0eWxlIDQzIHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDQ0KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB4XG4gICAgICAoNDQpXG4gICAgICAqMTMuMjAqYFwiXSlcbiAgICBzdHlsZSA0NCBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA0NihbXCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg0NilcbiAgICAgICoxMy4zMSpgXCJdKVxuICAgIHN0eWxlIDQ2IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDQ3KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB5XG4gICAgICAoNDcpXG4gICAgICAqMTMuMjcqYFwiXSlcbiAgICBzdHlsZSA0NyBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA0OFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGFlc1xuICAgICAgKDQ4KVxuICAgICAgKjEzLjE2LTMyKlxuICAgICh4ICg0NCksIHkgKDQ3KSlgXCJdXVxuICAgIHN0eWxlIDQ4IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDUwW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZ2dwbG90XG4gICAgICAoNTApXG4gICAgICAqMTMuOS0zMypcbiAgICAoMzgsIDQ4KWBcIl1dXG4gICAgc3R5bGUgNTAgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgNTJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBkYXRhICUjNjI7JVxuXHRnZ3Bsb3QoYWVzKHggPSB4LCB5ID0geSkpXG4gICAgICAoNTIpXG4gICAgICAqMTIuNi04KlxuICAgICgzOCwgNTApYFwiXV1cbiAgICBzdHlsZSA1MiBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA1NFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdlb20jOTU7cG9pbnRcbiAgICAgICg1NClcbiAgICAgICoxNC45LTIwKmBcIl1dXG4gICAgc3R5bGUgNTQgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgNTVbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM0MztcbiAgICAgICg1NSlcbiAgICAgICoxMi4xLTE0LjIwKlxuICAgICg1MiwgNTQpYFwiXV1cbiAgICBzdHlsZSA1NSBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICA1NyhbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNTcpXG4gICAgICAqMTYuNi0xMCpgXCJdKVxuICAgIDU4e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDU4KVxuICAgICAgKjE2LjYtMTIqYFwifX1cbiAgICA2MFtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2MClcbiAgICAgICoxNi42LTEyKlxuICAgICg1NywgNTgpYFwiXV1cbiAgICA2MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjIpXG4gICAgICAqMTYuMTUtMTkqYFwiXSlcbiAgICA2M3t7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg2MylcbiAgICAgICoxNi4xNS0yMSpgXCJ9fVxuICAgIDY1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDY1KVxuICAgICAgKjE2LjE1LTIxKlxuICAgICg2MiwgNjMpYFwiXV1cbiAgICA2N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBsb3RcbiAgICAgICg2NylcbiAgICAgICoxNi4xLTIyKlxuICAgICg2MCwgNjUpYFwiXV1cbiAgICA2OShbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjkpXG4gICAgICAqMTcuOC0xMipgXCJdKVxuICAgIDcwe3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDcwKVxuICAgICAgKjE3LjgtMTQqYFwifX1cbiAgICA3MltbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3MilcbiAgICAgICoxNy44LTE0KlxuICAgICg2OSwgNzApYFwiXV1cbiAgICA3NChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNzQpXG4gICAgICAqMTcuMTctMjEqYFwiXSlcbiAgICA3NXt7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg3NSlcbiAgICAgICoxNy4xNy0yMypgXCJ9fVxuICAgIDc3W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDc3KVxuICAgICAgKjE3LjE3LTIzKlxuICAgICg3NCwgNzUpYFwiXV1cbiAgICA3OVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBvaW50c1xuICAgICAgKDc5KVxuICAgICAgKjE3LjEtMjQqXG4gICAgKDcyLCA3NylgXCJdXVxuICAgIDgyKFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg4MilcbiAgICAgICoxOS4xMi0xNipgXCJdKVxuICAgIDgze3tcImAjOTE7UlN5bWJvbCM5Mzsga1xuICAgICAgKDgzKVxuICAgICAgKjE5LjEyLTE4KmBcIn19XG4gICAgODVbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoODUpXG4gICAgICAqMTkuMTItMTgqXG4gICAgKDgyLCA4MylgXCJdXVxuICAgIDg3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDg3KVxuICAgICAgKjE5LjctMTkqXG4gICAgKDg1KWBcIl1dXG4gICAgODlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDg5KVxuICAgICAgKjE5LjEtMjAqXG4gICAgKDg3KWBcIl1dXG4gICAgMyAtLT58XCJhcmd1bWVudFwifCAxXG4gICAgNyAtLT58XCJhcmd1bWVudFwifCA1XG4gICAgMTEgLS0+fFwiYXJndW1lbnRcInwgOVxuICAgIDE2IC0tPnxcImFyZ3VtZW50XCJ8IDE0XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAxNlxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTdcbiAgICAxNyAtLT58XCJhcmd1bWVudFwifCAxNlxuICAgIDE3IC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDEyXG4gICAgMjIgLS0+fFwiYXJndW1lbnRcInwgMjBcbiAgICAxOCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDIyXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyM1xuICAgIDIzIC0tPnxcImFyZ3VtZW50XCJ8IDIyXG4gICAgMjMgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMThcbiAgICAyNiAtLT58XCJyZWFkc1wifCAxMlxuICAgIDI5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAyNlxuICAgIDI5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyN1xuICAgIDMxIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyOVxuICAgIDI0IC0tPnxcImRlZmluZWQtYnlcInwgMzFcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMyXG4gICAgMzIgLS0+fFwiYXJndW1lbnRcInwgMzFcbiAgICAzMiAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAyNFxuICAgIDM0IC0tPnxcInJlYWRzXCJ8IDI0XG4gICAgMzYgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDM0XG4gICAgMzggLS0+fFwicmVhZHNcInwgMTJcbiAgICA0NCAtLT58XCJyZWFkc1wifCA0M1xuICAgIDQ3IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwicmVhZHNcInwgNDNcbiAgICA0OCAtLT58XCJhcmd1bWVudFwifCA0NFxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDdcbiAgICA1MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNDhcbiAgICA1MCAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDM4XG4gICAgNTIgLS0+fFwiYXJndW1lbnRcInwgNTBcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTJcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTRcbiAgICA1NyAtLT58XCJyZWFkc1wifCAxOFxuICAgIDYwIC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA1N1xuICAgIDYwIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1OFxuICAgIDYyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNjUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDYyXG4gICAgNjUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYzXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYwXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDY1XG4gICAgNjkgLS0+fFwicmVhZHNcInwgMThcbiAgICA3MiAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNjlcbiAgICA3MiAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzBcbiAgICA3NCAtLT58XCJyZWFkc1wifCAxOFxuICAgIDc3IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA3NFxuICAgIDc3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3NVxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3MlxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3N1xuICAgIDgyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgODUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDgyXG4gICAgODUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDgzXG4gICAgODcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDg1XG4gICAgODkgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDg3IiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19))\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;(has&nbsp;unknown&nbsp;side&nbsp;effect)&nbsp;{11,&nbsp;9}&nbsp;([marked](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIDdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoNylcbiAgICAgICoyLjEtMTQqXG4gICAgKDUpYFwiXV1cbiAgICBzdHlsZSA3IHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgOXt7XCJgIzkxO1JTeW1ib2wjOTM7IHJlYWRyXG4gICAgICAoOSlcbiAgICAgICozLjktMTMqYFwifX1cbiAgICBzdHlsZSA5IHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIDExW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbGlicmFyeVxuICAgICAgKDExKVxuICAgICAgKjMuMS0xNCpcbiAgICAoOSlgXCJdXVxuICAgIHN0eWxlIDExIHN0cm9rZTp0ZWFsLHN0cm9rZS13aWR0aDo3cHgsc3Ryb2tlLW9wYWNpdHk6Ljg7IFxuICAgIHN0eWxlIDExIHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgMTR7e1wiYCM5MTtSU3RyaW5nIzkzOyAjMzk7ZGF0YS5jc3YjMzk7XG4gICAgICAoMTQpXG4gICAgICAqNi4xOC0yNypgXCJ9fVxuICAgIDE2W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcmVhZCM5NTtjc3ZcbiAgICAgICgxNilcbiAgICAgICo2LjktMjgqXG4gICAgKDE0KWBcIl1dXG4gICAgMTJbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgxMilcbiAgICAgICo2LjEtNCpgXCJdXG4gICAgMTdbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMTcpXG4gICAgICAqNi4xLTI4KlxuICAgICgxMiwgMTYpYFwiXV1cbiAgICAyMHt7XCJgIzkxO1JTdHJpbmcjOTM7ICMzOTtkYXRhMi5jc3YjMzk7XG4gICAgICAoMjApXG4gICAgICAqNy4xOS0yOSpgXCJ9fVxuICAgIDIyW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcmVhZCM5NTtjc3ZcbiAgICAgICgyMilcbiAgICAgICo3LjEwLTMwKlxuICAgICgyMClgXCJdXVxuICAgIDE4W1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDE4KVxuICAgICAgKjcuMS01KmBcIl1cbiAgICAyM1tbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzYwOyM0NTtcbiAgICAgICgyMylcbiAgICAgICo3LjEtMzAqXG4gICAgKDE4LCAyMilgXCJdXVxuICAgIDI2KFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YVxuICAgICAgKDI2KVxuICAgICAgKjkuMTEtMTQqYFwiXSlcbiAgICAyN3t7XCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICgyNylcbiAgICAgICo5LjExLTE2KmBcIn19XG4gICAgMjlbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoMjkpXG4gICAgICAqOS4xMS0xNipcbiAgICAoMjYsIDI3KWBcIl1dXG4gICAgMzFbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBtZWFuXG4gICAgICAoMzEpXG4gICAgICAqOS42LTE3KlxuICAgICgyOSlgXCJdXVxuICAgIDI0W1wiYCM5MTtSU3ltYm9sIzkzOyBtXG4gICAgICAoMjQpXG4gICAgICAqOS4xKmBcIl1cbiAgICAzMltbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzYwOyM0NTtcbiAgICAgICgzMilcbiAgICAgICo5LjEtMTcqXG4gICAgKDI0LCAzMSlgXCJdXVxuICAgIDM0KFtcImAjOTE7UlN5bWJvbCM5MzsgbVxuICAgICAgKDM0KVxuICAgICAgKjEwLjcqYFwiXSlcbiAgICAzNltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHByaW50XG4gICAgICAoMzYpXG4gICAgICAqMTAuMS04KlxuICAgICgzNClgXCJdXVxuICAgIDM4KFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YVxuICAgICAgKDM4KVxuICAgICAgKjEyLjEtNCpgXCJdKVxuICAgIDQzKFtcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDQzKVxuICAgICAgKjEzLjI0KmBcIl0pXG4gICAgNDQoW1wiYCM5MTtSQXJndW1lbnQjOTM7IHhcbiAgICAgICg0NClcbiAgICAgICoxMy4yMCpgXCJdKVxuICAgIDQ2KFtcImAjOTE7UlN5bWJvbCM5MzsgeVxuICAgICAgKDQ2KVxuICAgICAgKjEzLjMxKmBcIl0pXG4gICAgNDcoW1wiYCM5MTtSQXJndW1lbnQjOTM7IHlcbiAgICAgICg0NylcbiAgICAgICoxMy4yNypgXCJdKVxuICAgIDQ4W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgYWVzXG4gICAgICAoNDgpXG4gICAgICAqMTMuMTYtMzIqXG4gICAgKHggKDQ0KSwgeSAoNDcpKWBcIl1dXG4gICAgNTBbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBnZ3Bsb3RcbiAgICAgICg1MClcbiAgICAgICoxMy45LTMzKlxuICAgICgzOCwgNDgpYFwiXV1cbiAgICA1MltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGRhdGEgJSM2MjslXG5cdGdncGxvdChhZXMoeCA9IHgsIHkgPSB5KSlcbiAgICAgICg1MilcbiAgICAgICoxMi42LTgqXG4gICAgKDM4LCA1MClgXCJdXVxuICAgIDU0W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZ2VvbSM5NTtwb2ludFxuICAgICAgKDU0KVxuICAgICAgKjE0LjktMjAqYFwiXV1cbiAgICA1NVtbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzQzO1xuICAgICAgKDU1KVxuICAgICAgKjEyLjEtMTQuMjAqXG4gICAgKDUyLCA1NClgXCJdXVxuICAgIDU3KFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg1NylcbiAgICAgICoxNi42LTEwKmBcIl0pXG4gICAgNTh7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoNTgpXG4gICAgICAqMTYuNi0xMipgXCJ9fVxuICAgIDYwW1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDYwKVxuICAgICAgKjE2LjYtMTIqXG4gICAgKDU3LCA1OClgXCJdXVxuICAgIDYyKFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg2MilcbiAgICAgICoxNi4xNS0xOSpgXCJdKVxuICAgIDYze3tcImAjOTE7UlN5bWJvbCM5MzsgeVxuICAgICAgKDYzKVxuICAgICAgKjE2LjE1LTIxKmBcIn19XG4gICAgNjVbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNjUpXG4gICAgICAqMTYuMTUtMjEqXG4gICAgKDYyLCA2MylgXCJdXVxuICAgIDY3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcGxvdFxuICAgICAgKDY3KVxuICAgICAgKjE2LjEtMjIqXG4gICAgKDYwLCA2NSlgXCJdXVxuICAgIDY5KFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg2OSlcbiAgICAgICoxNy44LTEyKmBcIl0pXG4gICAgNzB7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoNzApXG4gICAgICAqMTcuOC0xNCpgXCJ9fVxuICAgIDcyW1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDcyKVxuICAgICAgKjE3LjgtMTQqXG4gICAgKDY5LCA3MClgXCJdXVxuICAgIDc0KFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg3NClcbiAgICAgICoxNy4xNy0yMSpgXCJdKVxuICAgIDc1e3tcImAjOTE7UlN5bWJvbCM5MzsgeVxuICAgICAgKDc1KVxuICAgICAgKjE3LjE3LTIzKmBcIn19XG4gICAgNzdbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNzcpXG4gICAgICAqMTcuMTctMjMqXG4gICAgKDc0LCA3NSlgXCJdXVxuICAgIDc5W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcG9pbnRzXG4gICAgICAoNzkpXG4gICAgICAqMTcuMS0yNCpcbiAgICAoNzIsIDc3KWBcIl1dXG4gICAgODIoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDgyKVxuICAgICAgKjE5LjEyLTE2KmBcIl0pXG4gICAgODN7e1wiYCM5MTtSU3ltYm9sIzkzOyBrXG4gICAgICAoODMpXG4gICAgICAqMTkuMTItMTgqYFwifX1cbiAgICA4NVtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg4NSlcbiAgICAgICoxOS4xMi0xOCpcbiAgICAoODIsIDgzKWBcIl1dXG4gICAgODdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBtZWFuXG4gICAgICAoODcpXG4gICAgICAqMTkuNy0xOSpcbiAgICAoODUpYFwiXV1cbiAgICA4OVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHByaW50XG4gICAgICAoODkpXG4gICAgICAqMTkuMS0yMCpcbiAgICAoODcpYFwiXV1cbiAgICAzIC0tPnxcImFyZ3VtZW50XCJ8IDFcbiAgICA3IC0tPnxcImFyZ3VtZW50XCJ8IDVcbiAgICAxMSAtLT58XCJhcmd1bWVudFwifCA5XG4gICAgMTYgLS0+fFwiYXJndW1lbnRcInwgMTRcbiAgICAxMiAtLT58XCJkZWZpbmVkLWJ5XCJ8IDE2XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAxN1xuICAgIDE3IC0tPnxcImFyZ3VtZW50XCJ8IDE2XG4gICAgMTcgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMTJcbiAgICAyMiAtLT58XCJhcmd1bWVudFwifCAyMFxuICAgIDE4IC0tPnxcImRlZmluZWQtYnlcInwgMjJcbiAgICAxOCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDIzXG4gICAgMjMgLS0+fFwiYXJndW1lbnRcInwgMjJcbiAgICAyMyAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAxOFxuICAgIDI2IC0tPnxcInJlYWRzXCJ8IDEyXG4gICAgMjkgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDI2XG4gICAgMjkgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDI3XG4gICAgMzEgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDI5XG4gICAgMjQgLS0+fFwiZGVmaW5lZC1ieVwifCAzMVxuICAgIDI0IC0tPnxcImRlZmluZWQtYnlcInwgMzJcbiAgICAzMiAtLT58XCJhcmd1bWVudFwifCAzMVxuICAgIDMyIC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDI0XG4gICAgMzQgLS0+fFwicmVhZHNcInwgMjRcbiAgICAzNiAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgMzRcbiAgICAzOCAtLT58XCJyZWFkc1wifCAxMlxuICAgIDQ0IC0tPnxcInJlYWRzXCJ8IDQzXG4gICAgNDcgLS0+fFwicmVhZHNcInwgNDZcbiAgICA0OCAtLT58XCJyZWFkc1wifCA0M1xuICAgIDQ4IC0tPnxcImFyZ3VtZW50XCJ8IDQ0XG4gICAgNDggLS0+fFwicmVhZHNcInwgNDZcbiAgICA0OCAtLT58XCJhcmd1bWVudFwifCA0N1xuICAgIDUwIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA0OFxuICAgIDUwIC0tPnxcImFyZ3VtZW50XCJ8IDM4XG4gICAgNTIgLS0+fFwiYXJndW1lbnRcInwgMzhcbiAgICA1MiAtLT58XCJhcmd1bWVudFwifCA1MFxuICAgIDU1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1MlxuICAgIDU1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1NFxuICAgIDU3IC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNjAgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDU3XG4gICAgNjAgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDU4XG4gICAgNjIgLS0+fFwicmVhZHNcInwgMThcbiAgICA2NSAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNjJcbiAgICA2NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNjNcbiAgICA2NyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNjBcbiAgICA2NyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNjVcbiAgICA2OSAtLT58XCJyZWFkc1wifCAxOFxuICAgIDcyIC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA2OVxuICAgIDcyIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3MFxuICAgIDc0IC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNzcgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDc0XG4gICAgNzcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDc1XG4gICAgNzkgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDcyXG4gICAgNzkgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDc3XG4gICAgODIgLS0+fFwicmVhZHNcInwgMThcbiAgICA4NSAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgODJcbiAgICA4NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgODNcbiAgICA4NyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgODVcbiAgICA4OSAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgODciLCJtZXJtYWlkIjp7ImF1dG9TeW5jIjp0cnVlfX0=))\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;(has&nbsp;unknown&nbsp;side&nbsp;effect)&nbsp;{7,&nbsp;5}&nbsp;([marked](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIHN0eWxlIDUgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgN1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICg3KVxuICAgICAgKjIuMS0xNCpcbiAgICAoNSlgXCJdXVxuICAgIHN0eWxlIDcgc3Ryb2tlOnRlYWwsc3Ryb2tlLXdpZHRoOjdweCxzdHJva2Utb3BhY2l0eTouODsgXG4gICAgc3R5bGUgNyBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDl7e1wiYCM5MTtSU3ltYm9sIzkzOyByZWFkclxuICAgICAgKDkpXG4gICAgICAqMy45LTEzKmBcIn19XG4gICAgMTFbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoMTEpXG4gICAgICAqMy4xLTE0KlxuICAgICg5KWBcIl1dXG4gICAgc3R5bGUgMTEgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICAxNHt7XCJgIzkxO1JTdHJpbmcjOTM7ICMzOTtkYXRhLmNzdiMzOTtcbiAgICAgICgxNClcbiAgICAgICo2LjE4LTI3KmBcIn19XG4gICAgMTZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyByZWFkIzk1O2NzdlxuICAgICAgKDE2KVxuICAgICAgKjYuOS0yOCpcbiAgICAoMTQpYFwiXV1cbiAgICAxMltcImAjOTE7UlN5bWJvbCM5MzsgZGF0YVxuICAgICAgKDEyKVxuICAgICAgKjYuMS00KmBcIl1cbiAgICAxN1tbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzYwOyM0NTtcbiAgICAgICgxNylcbiAgICAgICo2LjEtMjgqXG4gICAgKDEyLCAxNilgXCJdXVxuICAgIDIwe3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEyLmNzdiMzOTtcbiAgICAgICgyMClcbiAgICAgICo3LjE5LTI5KmBcIn19XG4gICAgMjJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyByZWFkIzk1O2NzdlxuICAgICAgKDIyKVxuICAgICAgKjcuMTAtMzAqXG4gICAgKDIwKWBcIl1dXG4gICAgMThbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoMTgpXG4gICAgICAqNy4xLTUqYFwiXVxuICAgIDIzW1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDIzKVxuICAgICAgKjcuMS0zMCpcbiAgICAoMTgsIDIyKWBcIl1dXG4gICAgMjYoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMjYpXG4gICAgICAqOS4xMS0xNCpgXCJdKVxuICAgIDI3e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDI3KVxuICAgICAgKjkuMTEtMTYqYFwifX1cbiAgICAyOVtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICgyOSlcbiAgICAgICo5LjExLTE2KlxuICAgICgyNiwgMjcpYFwiXV1cbiAgICAzMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IG1lYW5cbiAgICAgICgzMSlcbiAgICAgICo5LjYtMTcqXG4gICAgKDI5KWBcIl1dXG4gICAgMjRbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgyNClcbiAgICAgICo5LjEqYFwiXVxuICAgIDMyW1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDMyKVxuICAgICAgKjkuMS0xNypcbiAgICAoMjQsIDMxKWBcIl1dXG4gICAgMzQoW1wiYCM5MTtSU3ltYm9sIzkzOyBtXG4gICAgICAoMzQpXG4gICAgICAqMTAuNypgXCJdKVxuICAgIDM2W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcHJpbnRcbiAgICAgICgzNilcbiAgICAgICoxMC4xLTgqXG4gICAgKDM0KWBcIl1dXG4gICAgMzgoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMzgpXG4gICAgICAqMTIuMS00KmBcIl0pXG4gICAgNDMoW1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoNDMpXG4gICAgICAqMTMuMjQqYFwiXSlcbiAgICA0NChbXCJgIzkxO1JBcmd1bWVudCM5MzsgeFxuICAgICAgKDQ0KVxuICAgICAgKjEzLjIwKmBcIl0pXG4gICAgNDYoW1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNDYpXG4gICAgICAqMTMuMzEqYFwiXSlcbiAgICA0NyhbXCJgIzkxO1JBcmd1bWVudCM5MzsgeVxuICAgICAgKDQ3KVxuICAgICAgKjEzLjI3KmBcIl0pXG4gICAgNDhbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBhZXNcbiAgICAgICg0OClcbiAgICAgICoxMy4xNi0zMipcbiAgICAoeCAoNDQpLCB5ICg0NykpYFwiXV1cbiAgICA1MFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdncGxvdFxuICAgICAgKDUwKVxuICAgICAgKjEzLjktMzMqXG4gICAgKDM4LCA0OClgXCJdXVxuICAgIDUyW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZGF0YSAlIzYyOyVcblx0Z2dwbG90KGFlcyh4ID0geCwgeSA9IHkpKVxuICAgICAgKDUyKVxuICAgICAgKjEyLjYtOCpcbiAgICAoMzgsIDUwKWBcIl1dXG4gICAgNTRbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBnZW9tIzk1O3BvaW50XG4gICAgICAoNTQpXG4gICAgICAqMTQuOS0yMCpgXCJdXVxuICAgIDU1W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNDM7XG4gICAgICAoNTUpXG4gICAgICAqMTIuMS0xNC4yMCpcbiAgICAoNTIsIDU0KWBcIl1dXG4gICAgNTcoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDU3KVxuICAgICAgKjE2LjYtMTAqYFwiXSlcbiAgICA1OHt7XCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg1OClcbiAgICAgICoxNi42LTEyKmBcIn19XG4gICAgNjBbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNjApXG4gICAgICAqMTYuNi0xMipcbiAgICAoNTcsIDU4KWBcIl1dXG4gICAgNjIoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDYyKVxuICAgICAgKjE2LjE1LTE5KmBcIl0pXG4gICAgNjN7e1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNjMpXG4gICAgICAqMTYuMTUtMjEqYFwifX1cbiAgICA2NVtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2NSlcbiAgICAgICoxNi4xNS0yMSpcbiAgICAoNjIsIDYzKWBcIl1dXG4gICAgNjdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwbG90XG4gICAgICAoNjcpXG4gICAgICAqMTYuMS0yMipcbiAgICAoNjAsIDY1KWBcIl1dXG4gICAgNjkoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDY5KVxuICAgICAgKjE3LjgtMTIqYFwiXSlcbiAgICA3MHt7XCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg3MClcbiAgICAgICoxNy44LTE0KmBcIn19XG4gICAgNzJbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNzIpXG4gICAgICAqMTcuOC0xNCpcbiAgICAoNjksIDcwKWBcIl1dXG4gICAgNzQoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDc0KVxuICAgICAgKjE3LjE3LTIxKmBcIl0pXG4gICAgNzV7e1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNzUpXG4gICAgICAqMTcuMTctMjMqYFwifX1cbiAgICA3N1tbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3NylcbiAgICAgICoxNy4xNy0yMypcbiAgICAoNzQsIDc1KWBcIl1dXG4gICAgNzlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwb2ludHNcbiAgICAgICg3OSlcbiAgICAgICoxNy4xLTI0KlxuICAgICg3MiwgNzcpYFwiXV1cbiAgICA4MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoODIpXG4gICAgICAqMTkuMTItMTYqYFwiXSlcbiAgICA4M3t7XCJgIzkxO1JTeW1ib2wjOTM7IGtcbiAgICAgICg4MylcbiAgICAgICoxOS4xMi0xOCpgXCJ9fVxuICAgIDg1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDg1KVxuICAgICAgKjE5LjEyLTE4KlxuICAgICg4MiwgODMpYFwiXV1cbiAgICA4N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IG1lYW5cbiAgICAgICg4NylcbiAgICAgICoxOS43LTE5KlxuICAgICg4NSlgXCJdXVxuICAgIDg5W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcHJpbnRcbiAgICAgICg4OSlcbiAgICAgICoxOS4xLTIwKlxuICAgICg4NylgXCJdXVxuICAgIDMgLS0+fFwiYXJndW1lbnRcInwgMVxuICAgIDcgLS0+fFwiYXJndW1lbnRcInwgNVxuICAgIDExIC0tPnxcImFyZ3VtZW50XCJ8IDlcbiAgICAxNiAtLT58XCJhcmd1bWVudFwifCAxNFxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTZcbiAgICAxMiAtLT58XCJkZWZpbmVkLWJ5XCJ8IDE3XG4gICAgMTcgLS0+fFwiYXJndW1lbnRcInwgMTZcbiAgICAxNyAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAxMlxuICAgIDIyIC0tPnxcImFyZ3VtZW50XCJ8IDIwXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyMlxuICAgIDE4IC0tPnxcImRlZmluZWQtYnlcInwgMjNcbiAgICAyMyAtLT58XCJhcmd1bWVudFwifCAyMlxuICAgIDIzIC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDE4XG4gICAgMjYgLS0+fFwicmVhZHNcInwgMTJcbiAgICAyOSAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgMjZcbiAgICAyOSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMjdcbiAgICAzMSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMjlcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMxXG4gICAgMjQgLS0+fFwiZGVmaW5lZC1ieVwifCAzMlxuICAgIDMyIC0tPnxcImFyZ3VtZW50XCJ8IDMxXG4gICAgMzIgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMjRcbiAgICAzNCAtLT58XCJyZWFkc1wifCAyNFxuICAgIDM2IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAzNFxuICAgIDM4IC0tPnxcInJlYWRzXCJ8IDEyXG4gICAgNDQgLS0+fFwicmVhZHNcInwgNDNcbiAgICA0NyAtLT58XCJyZWFkc1wifCA0NlxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQzXG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDRcbiAgICA0OCAtLT58XCJyZWFkc1wifCA0NlxuICAgIDQ4IC0tPnxcImFyZ3VtZW50XCJ8IDQ3XG4gICAgNTAgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDQ4XG4gICAgNTAgLS0+fFwiYXJndW1lbnRcInwgMzhcbiAgICA1MiAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDUwXG4gICAgNTUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDUyXG4gICAgNTUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDU0XG4gICAgNTcgLS0+fFwicmVhZHNcInwgMThcbiAgICA2MCAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNTdcbiAgICA2MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNThcbiAgICA2MiAtLT58XCJyZWFkc1wifCAxOFxuICAgIDY1IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA2MlxuICAgIDY1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2M1xuICAgIDY3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2MFxuICAgIDY3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2NVxuICAgIDY5IC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNzIgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDY5XG4gICAgNzIgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDcwXG4gICAgNzQgLS0+fFwicmVhZHNcInwgMThcbiAgICA3NyAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNzRcbiAgICA3NyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzVcbiAgICA3OSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzJcbiAgICA3OSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzdcbiAgICA4MiAtLT58XCJyZWFkc1wifCAxOFxuICAgIDg1IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA4MlxuICAgIDg1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA4M1xuICAgIDg3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA4NVxuICAgIDg5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA4NyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==))\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;(has&nbsp;unknown&nbsp;side&nbsp;effect)&nbsp;{3,&nbsp;1}&nbsp;([marked](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgc3R5bGUgMSBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICAzW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbGlicmFyeVxuICAgICAgKDMpXG4gICAgICAqMS4xLTE1KlxuICAgICgxKWBcIl1dXG4gICAgc3R5bGUgMyBzdHJva2U6dGVhbCxzdHJva2Utd2lkdGg6N3B4LHN0cm9rZS1vcGFjaXR5Oi44OyBcbiAgICBzdHlsZSAzIHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgNXt7XCJgIzkxO1JTeW1ib2wjOTM7IGRwbHlyXG4gICAgICAoNSlcbiAgICAgICoyLjktMTMqYFwifX1cbiAgICA3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbGlicmFyeVxuICAgICAgKDcpXG4gICAgICAqMi4xLTE0KlxuICAgICg1KWBcIl1dXG4gICAgc3R5bGUgNyBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDl7e1wiYCM5MTtSU3ltYm9sIzkzOyByZWFkclxuICAgICAgKDkpXG4gICAgICAqMy45LTEzKmBcIn19XG4gICAgMTFbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoMTEpXG4gICAgICAqMy4xLTE0KlxuICAgICg5KWBcIl1dXG4gICAgc3R5bGUgMTEgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICAxNHt7XCJgIzkxO1JTdHJpbmcjOTM7ICMzOTtkYXRhLmNzdiMzOTtcbiAgICAgICgxNClcbiAgICAgICo2LjE4LTI3KmBcIn19XG4gICAgMTZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyByZWFkIzk1O2NzdlxuICAgICAgKDE2KVxuICAgICAgKjYuOS0yOCpcbiAgICAoMTQpYFwiXV1cbiAgICAxMltcImAjOTE7UlN5bWJvbCM5MzsgZGF0YVxuICAgICAgKDEyKVxuICAgICAgKjYuMS00KmBcIl1cbiAgICAxN1tbXCJgIzkxO1JCaW5hcnlPcCM5MzsgIzYwOyM0NTtcbiAgICAgICgxNylcbiAgICAgICo2LjEtMjgqXG4gICAgKDEyLCAxNilgXCJdXVxuICAgIDIwe3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEyLmNzdiMzOTtcbiAgICAgICgyMClcbiAgICAgICo3LjE5LTI5KmBcIn19XG4gICAgMjJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyByZWFkIzk1O2NzdlxuICAgICAgKDIyKVxuICAgICAgKjcuMTAtMzAqXG4gICAgKDIwKWBcIl1dXG4gICAgMThbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoMTgpXG4gICAgICAqNy4xLTUqYFwiXVxuICAgIDIzW1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDIzKVxuICAgICAgKjcuMS0zMCpcbiAgICAoMTgsIDIyKWBcIl1dXG4gICAgMjYoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMjYpXG4gICAgICAqOS4xMS0xNCpgXCJdKVxuICAgIDI3e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDI3KVxuICAgICAgKjkuMTEtMTYqYFwifX1cbiAgICAyOVtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICgyOSlcbiAgICAgICo5LjExLTE2KlxuICAgICgyNiwgMjcpYFwiXV1cbiAgICAzMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IG1lYW5cbiAgICAgICgzMSlcbiAgICAgICo5LjYtMTcqXG4gICAgKDI5KWBcIl1dXG4gICAgMjRbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgyNClcbiAgICAgICo5LjEqYFwiXVxuICAgIDMyW1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDMyKVxuICAgICAgKjkuMS0xNypcbiAgICAoMjQsIDMxKWBcIl1dXG4gICAgMzQoW1wiYCM5MTtSU3ltYm9sIzkzOyBtXG4gICAgICAoMzQpXG4gICAgICAqMTAuNypgXCJdKVxuICAgIDM2W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcHJpbnRcbiAgICAgICgzNilcbiAgICAgICoxMC4xLTgqXG4gICAgKDM0KWBcIl1dXG4gICAgMzgoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMzgpXG4gICAgICAqMTIuMS00KmBcIl0pXG4gICAgNDMoW1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoNDMpXG4gICAgICAqMTMuMjQqYFwiXSlcbiAgICA0NChbXCJgIzkxO1JBcmd1bWVudCM5MzsgeFxuICAgICAgKDQ0KVxuICAgICAgKjEzLjIwKmBcIl0pXG4gICAgNDYoW1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNDYpXG4gICAgICAqMTMuMzEqYFwiXSlcbiAgICA0NyhbXCJgIzkxO1JBcmd1bWVudCM5MzsgeVxuICAgICAgKDQ3KVxuICAgICAgKjEzLjI3KmBcIl0pXG4gICAgNDhbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBhZXNcbiAgICAgICg0OClcbiAgICAgICoxMy4xNi0zMipcbiAgICAoeCAoNDQpLCB5ICg0NykpYFwiXV1cbiAgICA1MFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdncGxvdFxuICAgICAgKDUwKVxuICAgICAgKjEzLjktMzMqXG4gICAgKDM4LCA0OClgXCJdXVxuICAgIDUyW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZGF0YSAlIzYyOyVcblx0Z2dwbG90KGFlcyh4ID0geCwgeSA9IHkpKVxuICAgICAgKDUyKVxuICAgICAgKjEyLjYtOCpcbiAgICAoMzgsIDUwKWBcIl1dXG4gICAgNTRbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBnZW9tIzk1O3BvaW50XG4gICAgICAoNTQpXG4gICAgICAqMTQuOS0yMCpgXCJdXVxuICAgIDU1W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNDM7XG4gICAgICAoNTUpXG4gICAgICAqMTIuMS0xNC4yMCpcbiAgICAoNTIsIDU0KWBcIl1dXG4gICAgNTcoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDU3KVxuICAgICAgKjE2LjYtMTAqYFwiXSlcbiAgICA1OHt7XCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg1OClcbiAgICAgICoxNi42LTEyKmBcIn19XG4gICAgNjBbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNjApXG4gICAgICAqMTYuNi0xMipcbiAgICAoNTcsIDU4KWBcIl1dXG4gICAgNjIoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDYyKVxuICAgICAgKjE2LjE1LTE5KmBcIl0pXG4gICAgNjN7e1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNjMpXG4gICAgICAqMTYuMTUtMjEqYFwifX1cbiAgICA2NVtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2NSlcbiAgICAgICoxNi4xNS0yMSpcbiAgICAoNjIsIDYzKWBcIl1dXG4gICAgNjdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwbG90XG4gICAgICAoNjcpXG4gICAgICAqMTYuMS0yMipcbiAgICAoNjAsIDY1KWBcIl1dXG4gICAgNjkoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDY5KVxuICAgICAgKjE3LjgtMTIqYFwiXSlcbiAgICA3MHt7XCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg3MClcbiAgICAgICoxNy44LTE0KmBcIn19XG4gICAgNzJbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoNzIpXG4gICAgICAqMTcuOC0xNCpcbiAgICAoNjksIDcwKWBcIl1dXG4gICAgNzQoW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhMlxuICAgICAgKDc0KVxuICAgICAgKjE3LjE3LTIxKmBcIl0pXG4gICAgNzV7e1wiYCM5MTtSU3ltYm9sIzkzOyB5XG4gICAgICAoNzUpXG4gICAgICAqMTcuMTctMjMqYFwifX1cbiAgICA3N1tbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3NylcbiAgICAgICoxNy4xNy0yMypcbiAgICAoNzQsIDc1KWBcIl1dXG4gICAgNzlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwb2ludHNcbiAgICAgICg3OSlcbiAgICAgICoxNy4xLTI0KlxuICAgICg3MiwgNzcpYFwiXV1cbiAgICA4MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoODIpXG4gICAgICAqMTkuMTItMTYqYFwiXSlcbiAgICA4M3t7XCJgIzkxO1JTeW1ib2wjOTM7IGtcbiAgICAgICg4MylcbiAgICAgICoxOS4xMi0xOCpgXCJ9fVxuICAgIDg1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDg1KVxuICAgICAgKjE5LjEyLTE4KlxuICAgICg4MiwgODMpYFwiXV1cbiAgICA4N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IG1lYW5cbiAgICAgICg4NylcbiAgICAgICoxOS43LTE5KlxuICAgICg4NSlgXCJdXVxuICAgIDg5W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgcHJpbnRcbiAgICAgICg4OSlcbiAgICAgICoxOS4xLTIwKlxuICAgICg4NylgXCJdXVxuICAgIDMgLS0+fFwiYXJndW1lbnRcInwgMVxuICAgIDcgLS0+fFwiYXJndW1lbnRcInwgNVxuICAgIDExIC0tPnxcImFyZ3VtZW50XCJ8IDlcbiAgICAxNiAtLT58XCJhcmd1bWVudFwifCAxNFxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTZcbiAgICAxMiAtLT58XCJkZWZpbmVkLWJ5XCJ8IDE3XG4gICAgMTcgLS0+fFwiYXJndW1lbnRcInwgMTZcbiAgICAxNyAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAxMlxuICAgIDIyIC0tPnxcImFyZ3VtZW50XCJ8IDIwXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyMlxuICAgIDE4IC0tPnxcImRlZmluZWQtYnlcInwgMjNcbiAgICAyMyAtLT58XCJhcmd1bWVudFwifCAyMlxuICAgIDIzIC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDE4XG4gICAgMjYgLS0+fFwicmVhZHNcInwgMTJcbiAgICAyOSAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgMjZcbiAgICAyOSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMjdcbiAgICAzMSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMjlcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMxXG4gICAgMjQgLS0+fFwiZGVmaW5lZC1ieVwifCAzMlxuICAgIDMyIC0tPnxcImFyZ3VtZW50XCJ8IDMxXG4gICAgMzIgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMjRcbiAgICAzNCAtLT58XCJyZWFkc1wifCAyNFxuICAgIDM2IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAzNFxuICAgIDM4IC0tPnxcInJlYWRzXCJ8IDEyXG4gICAgNDQgLS0+fFwicmVhZHNcInwgNDNcbiAgICA0NyAtLT58XCJyZWFkc1wifCA0NlxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQzXG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDRcbiAgICA0OCAtLT58XCJyZWFkc1wifCA0NlxuICAgIDQ4IC0tPnxcImFyZ3VtZW50XCJ8IDQ3XG4gICAgNTAgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDQ4XG4gICAgNTAgLS0+fFwiYXJndW1lbnRcInwgMzhcbiAgICA1MiAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDUwXG4gICAgNTUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDUyXG4gICAgNTUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDU0XG4gICAgNTcgLS0+fFwicmVhZHNcInwgMThcbiAgICA2MCAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNTdcbiAgICA2MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNThcbiAgICA2MiAtLT58XCJyZWFkc1wifCAxOFxuICAgIDY1IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA2MlxuICAgIDY1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2M1xuICAgIDY3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2MFxuICAgIDY3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA2NVxuICAgIDY5IC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNzIgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDY5XG4gICAgNzIgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDcwXG4gICAgNzQgLS0+fFwicmVhZHNcInwgMThcbiAgICA3NyAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNzRcbiAgICA3NyAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzVcbiAgICA3OSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzJcbiAgICA3OSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzdcbiAgICA4MiAtLT58XCJyZWFkc1wifCAxOFxuICAgIDg1IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA4MlxuICAgIDg1IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA4M1xuICAgIDg3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA4NVxuICAgIDg5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA4NyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==))\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;7ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.49 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




```json
{
  "dataflow-cluster": {
    ".meta": {
      "timing": 1
    },
    "clusters": [
      {
        "startNode": 89,
        "members": [
          89,
          87,
          85,
          82,
          18,
          22,
          20,
          23,
          57,
          60,
          58,
          67,
          65,
          62,
          63,
          69,
          72,
          70,
          79,
          77,
          74,
          75,
          83
        ],
        "hasUnknownSideEffects": false
      },
      {
        "startNode": 55,
        "members": [
          55,
          52,
          38,
          12,
          16,
          14,
          17,
          26,
          29,
          27,
          31,
          32,
          24,
          34,
          36,
          50,
          48,
          43,
          44,
          46,
          47,
          54
        ],
        "hasUnknownSideEffects": false
      },
      {
        "startNode": 11,
        "members": [
          11,
          9
        ],
        "hasUnknownSideEffects": true
      },
      {
        "startNode": 7,
        "members": [
          7,
          5
        ],
        "hasUnknownSideEffects": true
      },
      {
        "startNode": 3,
        "members": [
          3,
          1
        ],
        "hasUnknownSideEffects": true
      }
    ]
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>


<details> <summary style="color:gray">Original Code</summary>



```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```
<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _10.78 ms_ (including parsing and normalization) within the generation environment. 
We encountered unknown side effects (with ids: [3,7,11]) during the analysis.


```mermaid
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 908----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 940----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 943----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 949----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 982----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```
	

<details>

<summary style="color:gray">Mermaid Code </summary>

```
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 908----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 940----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 943----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 949----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 982----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```

</details>

</details>



</details>
	



	
		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Dataflow Cluster Query query is `executeDataflowClusterQuery` in [`./src/queries/catalog/cluster-query/cluster-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/catalog/cluster-query/cluster-query-executor.ts).

</details>	





### Id-Map Query


This query provides access to all nodes in the [normalized AST](https://github.com/flowr-analysis/flowr/wiki//Normalized%20AST) as a mapping from their id to the node itself. 

Using the example code from above, the following query returns all nodes from the code:


```json
[
  {
    "type": "id-map"
  }
]
```



_Results (prettified and summarized):_

Query:&nbsp;**id-map**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;Id&nbsp;List:&nbsp;{0,&nbsp;1,&nbsp;2,&nbsp;3,&nbsp;4,&nbsp;5,&nbsp;6,&nbsp;...&nbsp;(see&nbsp;JSON&nbsp;below)}\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;6ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.12 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"id-map":{".meta":{"timing":0},"idMap":{"size":119,"k2v":[[0,{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}}],[1,{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}}],[2,{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],[3,{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],[4,{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}}],[5,{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}}],[6,{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],[7,{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],[8,{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}}],[9,{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}}],[10,{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],[11,{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],[12,{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],[13,{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}}],[14,{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}}],[15,{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],[16,{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],[17,{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],[18,{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],[19,{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}}],[20,{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}}],[21,{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],[22,{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],[23,{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],[24,{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],[25,{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}}],[26,{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],[27,{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}}],[28,{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],[29,{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}}],[30,{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],[31,{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],[32,{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],[33,{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}}],[34,{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}}],[35,{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],[36,{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],[37,{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}}],[38,{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}}],[39,{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}}],[40,{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}}],[41,{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}}],[42,{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}}],[43,{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}}],[44,{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}}],[45,{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}}],[46,{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}}],[47,{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],[48,{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}}],[49,{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],[50,{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}}],[51,{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],[52,{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],[53,{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}}],[54,{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],[55,{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],[56,{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}}],[57,{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],[58,{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}}],[59,{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],[60,{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}}],[61,{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}}],[62,{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],[63,{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}}],[64,{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],[65,{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}}],[66,{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],[67,{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],[68,{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}}],[69,{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],[70,{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}}],[71,{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],[72,{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}}],[73,{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}}],[74,{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],[75,{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}}],[76,{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],[77,{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}}],[78,{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],[79,{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],[80,{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}}],[81,{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}}],[82,{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}],[83,{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}}],[84,{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],[85,{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}}],[86,{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],[87,{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}}],[88,{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],[89,{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],[90,{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"role":"root","index":0}}],["3-arg",{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],["7-arg",{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],["11-arg",{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],["17-arg",{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],["23-arg",{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],["32-arg",{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],["36-arg",{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],["55-arg",{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],["67-arg",{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],["79-arg",{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],["89-arg",{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],["1-arg",{"type":"RString","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0},"lexeme":"ggplot","location":[1,9,1,14],"content":{"quotes":"none","str":"ggplot"}}],["5-arg",{"type":"RString","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0},"lexeme":"dplyr","location":[2,9,2,13],"content":{"quotes":"none","str":"dplyr"}}],["9-arg",{"type":"RString","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0},"lexeme":"readr","location":[3,9,3,13],"content":{"quotes":"none","str":"readr"}}],["12-arg",{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],["16-arg",{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],["18-arg",{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],["22-arg",{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],["24-arg",{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],["31-arg",{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],["26-arg",{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],["52-arg",{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],["54-arg",{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],["57-arg",{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],["62-arg",{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],["69-arg",{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],["74-arg",{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],["82-arg",{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}]],"v2k":{}}},".meta":{"timing":0}}
```



</details>


<details> <summary style="color:gray">Original Code</summary>



```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```
<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _6.75 ms_ (including parsing and normalization) within the generation environment. 
We encountered unknown side effects (with ids: [3,7,11]) during the analysis.


```mermaid
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 1124----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 1156----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 1159----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 1165----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 1198----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```
	

<details>

<summary style="color:gray">Mermaid Code </summary>

```
flowchart LR
    1{{"`#91;RSymbol#93; ggplot
      (1)
      *1.9-14*`"}}
    3[["`#91;RFunctionCall#93; library
      (3)
      *1.1-15*
    (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    5{{"`#91;RSymbol#93; dplyr
      (5)
      *2.9-13*`"}}
    7[["`#91;RFunctionCall#93; library
      (7)
      *2.1-14*
    (5)`"]]
    style 7 stroke:red,stroke-width:5px; 
    9{{"`#91;RSymbol#93; readr
      (9)
      *3.9-13*`"}}
    11[["`#91;RFunctionCall#93; library
      (11)
      *3.1-14*
    (9)`"]]
    style 11 stroke:red,stroke-width:5px; 
    14{{"`#91;RString#93; #39;data.csv#39;
      (14)
      *6.18-27*`"}}
    16[["`#91;RFunctionCall#93; read#95;csv
      (16)
      *6.9-28*
    (14)`"]]
    12["`#91;RSymbol#93; data
      (12)
      *6.1-4*`"]
    17[["`#91;RBinaryOp#93; #60;#45;
      (17)
      *6.1-28*
    (12, 16)`"]]
    20{{"`#91;RString#93; #39;data2.csv#39;
      (20)
      *7.19-29*`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 1124----------------------------------------
    %%   data: {**data** (id: 12, type: Unknown, def. @17)}
    22[["`#91;RFunctionCall#93; read#95;csv
      (22)
      *7.10-30*
    (20)`"]]
    18["`#91;RSymbol#93; data2
      (18)
      *7.1-5*`"]
    23[["`#91;RBinaryOp#93; #60;#45;
      (23)
      *7.1-30*
    (18, 22)`"]]
    26(["`#91;RSymbol#93; data
      (26)
      *9.11-14*`"])
    27{{"`#91;RSymbol#93; x
      (27)
      *9.11-16*`"}}
    29[["`#91;RAccess#93; $
      (29)
      *9.11-16*
    (26, 27)`"]]
    31[["`#91;RFunctionCall#93; mean
      (31)
      *9.6-17*
    (29)`"]]
    24["`#91;RSymbol#93; m
      (24)
      *9.1*`"]
    32[["`#91;RBinaryOp#93; #60;#45;
      (32)
      *9.1-17*
    (24, 31)`"]]
    34(["`#91;RSymbol#93; m
      (34)
      *10.7*`"])
    36[["`#91;RFunctionCall#93; print
      (36)
      *10.1-8*
    (34)`"]]
    38(["`#91;RSymbol#93; data
      (38)
      *12.1-4*`"])
    43(["`#91;RSymbol#93; x
      (43)
      *13.24*`"])
    44(["`#91;RArgument#93; x
      (44)
      *13.20*`"])
    46(["`#91;RSymbol#93; y
      (46)
      *13.31*`"])
    47(["`#91;RArgument#93; y
      (47)
      *13.27*`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 1156----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    48[["`#91;RFunctionCall#93; aes
      (48)
      *13.16-32*
    (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 1159----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    50[["`#91;RFunctionCall#93; ggplot
      (50)
      *13.9-33*
    (38, 48)`"]]
    52[["`#91;RFunctionCall#93; data %#62;%
	ggplot(aes(x = x, y = y))
      (52)
      *12.6-8*
    (38, 50)`"]]
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 1165----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    54[["`#91;RFunctionCall#93; geom#95;point
      (54)
      *14.9-20*`"]]
    55[["`#91;RBinaryOp#93; #43;
      (55)
      *12.1-14.20*
    (52, 54)`"]]
    57(["`#91;RSymbol#93; data2
      (57)
      *16.6-10*`"])
    58{{"`#91;RSymbol#93; x
      (58)
      *16.6-12*`"}}
    60[["`#91;RAccess#93; $
      (60)
      *16.6-12*
    (57, 58)`"]]
    62(["`#91;RSymbol#93; data2
      (62)
      *16.15-19*`"])
    63{{"`#91;RSymbol#93; y
      (63)
      *16.15-21*`"}}
    65[["`#91;RAccess#93; $
      (65)
      *16.15-21*
    (62, 63)`"]]
    67[["`#91;RFunctionCall#93; plot
      (67)
      *16.1-22*
    (60, 65)`"]]
    69(["`#91;RSymbol#93; data2
      (69)
      *17.8-12*`"])
    70{{"`#91;RSymbol#93; x
      (70)
      *17.8-14*`"}}
    72[["`#91;RAccess#93; $
      (72)
      *17.8-14*
    (69, 70)`"]]
    74(["`#91;RSymbol#93; data2
      (74)
      *17.17-21*`"])
    75{{"`#91;RSymbol#93; y
      (75)
      *17.17-23*`"}}
    77[["`#91;RAccess#93; $
      (77)
      *17.17-23*
    (74, 75)`"]]
    %% Environment of 79 [level: 0]:
    %% Built-in
    %% 1198----------------------------------------
    %%   data:  {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2: {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:     {**m** (id: 24, type: Unknown, def. @32)}
    79[["`#91;RFunctionCall#93; points
      (79)
      *17.1-24*
    (72, 77)`"]]
    82(["`#91;RSymbol#93; data2
      (82)
      *19.12-16*`"])
    83{{"`#91;RSymbol#93; k
      (83)
      *19.12-18*`"}}
    85[["`#91;RAccess#93; $
      (85)
      *19.12-18*
    (82, 83)`"]]
    87[["`#91;RFunctionCall#93; mean
      (87)
      *19.7-19*
    (85)`"]]
    89[["`#91;RFunctionCall#93; print
      (89)
      *19.1-20*
    (87)`"]]
    3 -->|"argument"| 1
    7 -->|"argument"| 5
    11 -->|"argument"| 9
    16 -->|"argument"| 14
    12 -->|"defined-by"| 16
    12 -->|"defined-by"| 17
    17 -->|"argument"| 16
    17 -->|"returns, argument"| 12
    22 -->|"argument"| 20
    18 -->|"defined-by"| 22
    18 -->|"defined-by"| 23
    23 -->|"argument"| 22
    23 -->|"returns, argument"| 18
    26 -->|"reads"| 12
    29 -->|"reads, returns, argument"| 26
    29 -->|"reads, argument"| 27
    31 -->|"reads, argument"| 29
    24 -->|"defined-by"| 31
    24 -->|"defined-by"| 32
    32 -->|"argument"| 31
    32 -->|"returns, argument"| 24
    34 -->|"reads"| 24
    36 -->|"reads, returns, argument"| 34
    38 -->|"reads"| 12
    44 -->|"reads"| 43
    47 -->|"reads"| 46
    48 -->|"reads"| 43
    48 -->|"argument"| 44
    48 -->|"reads"| 46
    48 -->|"argument"| 47
    50 -->|"reads, argument"| 48
    50 -->|"argument"| 38
    52 -->|"argument"| 38
    52 -->|"argument"| 50
    55 -->|"reads, argument"| 52
    55 -->|"reads, argument"| 54
    57 -->|"reads"| 18
    60 -->|"reads, returns, argument"| 57
    60 -->|"reads, argument"| 58
    62 -->|"reads"| 18
    65 -->|"reads, returns, argument"| 62
    65 -->|"reads, argument"| 63
    67 -->|"reads, argument"| 60
    67 -->|"reads, argument"| 65
    69 -->|"reads"| 18
    72 -->|"reads, returns, argument"| 69
    72 -->|"reads, argument"| 70
    74 -->|"reads"| 18
    77 -->|"reads, returns, argument"| 74
    77 -->|"reads, argument"| 75
    79 -->|"reads, argument"| 72
    79 -->|"reads, argument"| 77
    82 -->|"reads"| 18
    85 -->|"reads, returns, argument"| 82
    85 -->|"reads, argument"| 83
    87 -->|"reads, argument"| 85
    89 -->|"reads, returns, argument"| 87
```

</details>

</details>



</details>
	



	
		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Id-Map Query query is `executeIdMapQuery` in [`./src/queries/catalog/id-map-query/id-map-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/catalog/id-map-query/id-map-query-executor.ts).

</details>	




### Compound Query


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

Query:&nbsp;**call-context**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**visualize**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**text**:&nbsp;_`mean`_&nbsp;(L.9),&nbsp;_`print`_&nbsp;(L.10),&nbsp;_`mean`_&nbsp;(L.19),&nbsp;_`print`_&nbsp;(L.19)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;8ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _8.08 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




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
              "id": 31
            },
            {
              "id": 36
            },
            {
              "id": 87
            },
            {
              "id": 89
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 0
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

Query:&nbsp;**call-context**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**visualize**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**text**:&nbsp;_`mean`_&nbsp;(L.9),&nbsp;_`print`_&nbsp;(L.10),&nbsp;_`mean`_&nbsp;(L.19),&nbsp;_`print`_&nbsp;(L.19)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;9ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _9.23 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




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
              "id": 31
            },
            {
              "id": 36
            },
            {
              "id": 87
            },
            {
              "id": 89
            }
          ]
        }
      }
    }
  },
  ".meta": {
    "timing": 0
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

Query:&nbsp;**call-context**&nbsp;(0ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**visualize**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**text**:&nbsp;_`mean`_&nbsp;(L.9)&nbsp;with&nbsp;1&nbsp;call&nbsp;(_built-in_),&nbsp;_`mean`_&nbsp;(L.19)&nbsp;with&nbsp;1&nbsp;call&nbsp;(_built-in_)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;7ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.85 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




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
              "calls": [
                "built-in"
              ]
            },
            {
              "id": 87,
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
    "timing": 0
  }
}
```



</details>





	

Now, the results no longer contain calls to `plot` that are not defined locally.

		

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Compound Query query is `executeCompoundQueries` in [`./src/queries/virtual-query/compound-query.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/virtual-query/compound-query.ts).

</details>	




