_This document was generated from 'src/documentation/print-query-wiki.ts' on 2024-10-05, 19:13:37 UTC presenting an overview of flowR's query API (v2.1.1, using R v4.4.1)._

This page briefly summarizes flowR's query API, represented by the executeQueries function in [`./src/queries/query.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/queries/query.ts).
Please see the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to access this API.

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
	
(The analysis required _18.55 ms_ (including parsing and normalization) within the generation environment.)



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
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;8ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _8.46 ms_ (including parsing and normalization and the query) within the generation environment.	

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
    "timing": 0
  }
}
```



</details>





	

## The Query Format

Queries are JSON arrays of query objects, each of which uses a `type` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the [Call-Context Query](#call-context-query)). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the [Compound Query](#compound-query)). 

We separate these from a concept perspective. 
For now, we support the following **active** queries (which we will refer to simply as a `query`):

1. [Call-Context Query](#call-context-query) (`call-context`):\
    Finds all calls in a set of files that matches specified criteria.
1. [Dataflow Query](#dataflow-query) (`dataflow`):\
    Returns the dataflow graph of the given code.

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


### Call-Context Query


Call context queries may be used to identify calls to specific functions that match criteria of your interest.
For now, we support two criteria:

1. **Function Name** (`callName`): The function name is specified by a regular expression. This allows you to find all calls to functions that match a specific pattern.
2. **Call Targets**  (`callTargets`): This specifies to what the function call targets. For example, you may want to find all calls to a function that is not defined locally.

Besides this we provide the following ways to automatically categorize and link identified invocations:

1. **Kind**         (`kind`): This is a general category that can be used to group calls together. For example, you may want to link all calls to `plot` to `visualize`.
2. **Subkind**      (`subkind`): This is used to uniquely identify the respective call type when grouping the output. For example, you may want to link all calls to `ggplot` to `plot`.
3. **Linked Calls** (`linkTo`): This links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc.
   For now, we _only_offer support for linking to the last call_ as the current flow dependency over-approximation is not stable.
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

Query:&nbsp;**call-context**&nbsp;(3ms)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**input**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**csv-file**:&nbsp;_`read_csv`_&nbsp;(L.6),&nbsp;_`read_csv`_&nbsp;(L.7)\
&nbsp;&nbsp;&nbsp;╰&nbsp;**visualize**\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**text**:&nbsp;_`mean`_&nbsp;(L.9),&nbsp;_`mean`_&nbsp;(L.19)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰&nbsp;**plot**:&nbsp;_`points`_&nbsp;(L.17)&nbsp;with&nbsp;1&nbsp;link&nbsp;(_`plot`_&nbsp;(L.16))\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈3ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;14ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _14.46 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.




```json
{
  "call-context": {
    ".meta": {
      "timing": 3
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
    "timing": 3
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
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;4ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _4.22 ms_ (including parsing and normalization and the query) within the generation environment.	

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
╰&nbsp;[Dataflow&nbsp;Graph](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgIzkxO1JTeW1ib2wjOTM7IGdncGxvdFxuICAgICAgKDEpXG4gICAgICAqMS45LTE0KmBcIn19XG4gICAgM1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgzKVxuICAgICAgKjEuMS0xNSpcbiAgICAoMSlgXCJdXVxuICAgIHN0eWxlIDMgc3Ryb2tlOnJlZCxzdHJva2Utd2lkdGg6NXB4OyBcbiAgICA1e3tcImAjOTE7UlN5bWJvbCM5MzsgZHBseXJcbiAgICAgICg1KVxuICAgICAgKjIuOS0xMypgXCJ9fVxuICAgIDdbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBsaWJyYXJ5XG4gICAgICAoNylcbiAgICAgICoyLjEtMTQqXG4gICAgKDUpYFwiXV1cbiAgICBzdHlsZSA3IHN0cm9rZTpyZWQsc3Ryb2tlLXdpZHRoOjVweDsgXG4gICAgOXt7XCJgIzkxO1JTeW1ib2wjOTM7IHJlYWRyXG4gICAgICAoOSlcbiAgICAgICozLjktMTMqYFwifX1cbiAgICAxMVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGxpYnJhcnlcbiAgICAgICgxMSlcbiAgICAgICozLjEtMTQqXG4gICAgKDkpYFwiXV1cbiAgICBzdHlsZSAxMSBzdHJva2U6cmVkLHN0cm9rZS13aWR0aDo1cHg7IFxuICAgIDE0e3tcImAjOTE7UlN0cmluZyM5MzsgIzM5O2RhdGEuY3N2IzM5O1xuICAgICAgKDE0KVxuICAgICAgKjYuMTgtMjcqYFwifX1cbiAgICAxNltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMTYpXG4gICAgICAqNi45LTI4KlxuICAgICgxNClgXCJdXVxuICAgIDEyW1wiYCM5MTtSU3ltYm9sIzkzOyBkYXRhXG4gICAgICAoMTIpXG4gICAgICAqNi4xLTQqYFwiXVxuICAgIDE3W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAjNjA7IzQ1O1xuICAgICAgKDE3KVxuICAgICAgKjYuMS0yOCpcbiAgICAoMTIsIDE2KWBcIl1dXG4gICAgMjB7e1wiYCM5MTtSU3RyaW5nIzkzOyAjMzk7ZGF0YTIuY3N2IzM5O1xuICAgICAgKDIwKVxuICAgICAgKjcuMTktMjkqYFwifX1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiAyMiBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgMzY4LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogeyoqZGF0YSoqIChpZDogMTIsIHR5cGU6IFVua25vd24sIGRlZi4gQDE3KX1cbiAgICAyMltbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHJlYWQjOTU7Y3N2XG4gICAgICAoMjIpXG4gICAgICAqNy4xMC0zMCpcbiAgICAoMjApYFwiXV1cbiAgICAxOFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICgxOClcbiAgICAgICo3LjEtNSpgXCJdXG4gICAgMjNbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMjMpXG4gICAgICAqNy4xLTMwKlxuICAgICgxOCwgMjIpYFwiXV1cbiAgICAyNihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgyNilcbiAgICAgICo5LjExLTE0KmBcIl0pXG4gICAgMjd7e1wiYCM5MTtSU3ltYm9sIzkzOyB4XG4gICAgICAoMjcpXG4gICAgICAqOS4xMS0xNipgXCJ9fVxuICAgIDI5W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDI5KVxuICAgICAgKjkuMTEtMTYqXG4gICAgKDI2LCAyNylgXCJdXVxuICAgIDMxW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDMxKVxuICAgICAgKjkuNi0xNypcbiAgICAoMjkpYFwiXV1cbiAgICAyNFtcImAjOTE7UlN5bWJvbCM5MzsgbVxuICAgICAgKDI0KVxuICAgICAgKjkuMSpgXCJdXG4gICAgMzJbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM2MDsjNDU7XG4gICAgICAoMzIpXG4gICAgICAqOS4xLTE3KlxuICAgICgyNCwgMzEpYFwiXV1cbiAgICAzNChbXCJgIzkxO1JTeW1ib2wjOTM7IG1cbiAgICAgICgzNClcbiAgICAgICoxMC43KmBcIl0pXG4gICAgMzZbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDM2KVxuICAgICAgKjEwLjEtOCpcbiAgICAoMzQpYFwiXV1cbiAgICAzOChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGFcbiAgICAgICgzOClcbiAgICAgICoxMi4xLTQqYFwiXSlcbiAgICA0MyhbXCJgIzkxO1JTeW1ib2wjOTM7IHhcbiAgICAgICg0MylcbiAgICAgICoxMy4yNCpgXCJdKVxuICAgIDQ0KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB4XG4gICAgICAoNDQpXG4gICAgICAqMTMuMjAqYFwiXSlcbiAgICA0NihbXCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg0NilcbiAgICAgICoxMy4zMSpgXCJdKVxuICAgIDQ3KFtcImAjOTE7UkFyZ3VtZW50IzkzOyB5XG4gICAgICAoNDcpXG4gICAgICAqMTMuMjcqYFwiXSlcbiAgICAlJSBFbnZpcm9ubWVudCBvZiA0OCBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDAwLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA0OFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGFlc1xuICAgICAgKDQ4KVxuICAgICAgKjEzLjE2LTMyKlxuICAgICh4ICg0NCksIHkgKDQ3KSlgXCJdXVxuICAgICUlIEVudmlyb25tZW50IG9mIDUwIFtsZXZlbDogMF06XG4gICAgJSUgQnVpbHQtaW5cbiAgICAlJSA0MDMtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgJSUgICBkYXRhOiAgeyoqZGF0YSoqIChpZDogMTIsIHR5cGU6IFVua25vd24sIGRlZi4gQDE3KX1cbiAgICAlJSAgIGRhdGEyOiB7KipkYXRhMioqIChpZDogMTgsIHR5cGU6IFVua25vd24sIGRlZi4gQDIzKX1cbiAgICAlJSAgIG06ICAgICB7KiptKiogKGlkOiAyNCwgdHlwZTogVW5rbm93biwgZGVmLiBAMzIpfVxuICAgIDUwW1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgZ2dwbG90XG4gICAgICAoNTApXG4gICAgICAqMTMuOS0zMypcbiAgICAoMzgsIDQ4KWBcIl1dXG4gICAgNTJbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBkYXRhICUjNjI7JVxuXHRnZ3Bsb3QoYWVzKHggPSB4LCB5ID0geSkpXG4gICAgICAoNTIpXG4gICAgICAqMTIuNi04KlxuICAgICgzOCwgNTApYFwiXV1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiA1NCBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDA5LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA1NFtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IGdlb20jOTU7cG9pbnRcbiAgICAgICg1NClcbiAgICAgICoxNC45LTIwKmBcIl1dXG4gICAgNTVbW1wiYCM5MTtSQmluYXJ5T3AjOTM7ICM0MztcbiAgICAgICg1NSlcbiAgICAgICoxMi4xLTE0LjIwKlxuICAgICg1MiwgNTQpYFwiXV1cbiAgICA1NyhbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNTcpXG4gICAgICAqMTYuNi0xMCpgXCJdKVxuICAgIDU4e3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDU4KVxuICAgICAgKjE2LjYtMTIqYFwifX1cbiAgICA2MFtbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg2MClcbiAgICAgICoxNi42LTEyKlxuICAgICg1NywgNTgpYFwiXV1cbiAgICA2MihbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjIpXG4gICAgICAqMTYuMTUtMTkqYFwiXSlcbiAgICA2M3t7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg2MylcbiAgICAgICoxNi4xNS0yMSpgXCJ9fVxuICAgIDY1W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDY1KVxuICAgICAgKjE2LjE1LTIxKlxuICAgICg2MiwgNjMpYFwiXV1cbiAgICA2N1tbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBsb3RcbiAgICAgICg2NylcbiAgICAgICoxNi4xLTIyKlxuICAgICg2MCwgNjUpYFwiXV1cbiAgICA2OShbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNjkpXG4gICAgICAqMTcuOC0xMipgXCJdKVxuICAgIDcwe3tcImAjOTE7UlN5bWJvbCM5MzsgeFxuICAgICAgKDcwKVxuICAgICAgKjE3LjgtMTQqYFwifX1cbiAgICA3MltbXCJgIzkxO1JBY2Nlc3MjOTM7ICRcbiAgICAgICg3MilcbiAgICAgICoxNy44LTE0KlxuICAgICg2OSwgNzApYFwiXV1cbiAgICA3NChbXCJgIzkxO1JTeW1ib2wjOTM7IGRhdGEyXG4gICAgICAoNzQpXG4gICAgICAqMTcuMTctMjEqYFwiXSlcbiAgICA3NXt7XCJgIzkxO1JTeW1ib2wjOTM7IHlcbiAgICAgICg3NSlcbiAgICAgICoxNy4xNy0yMypgXCJ9fVxuICAgIDc3W1tcImAjOTE7UkFjY2VzcyM5MzsgJFxuICAgICAgKDc3KVxuICAgICAgKjE3LjE3LTIzKlxuICAgICg3NCwgNzUpYFwiXV1cbiAgICAlJSBFbnZpcm9ubWVudCBvZiA3OSBbbGV2ZWw6IDBdOlxuICAgICUlIEJ1aWx0LWluXG4gICAgJSUgNDQyLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICUlICAgZGF0YTogIHsqKmRhdGEqKiAoaWQ6IDEyLCB0eXBlOiBVbmtub3duLCBkZWYuIEAxNyl9XG4gICAgJSUgICBkYXRhMjogeyoqZGF0YTIqKiAoaWQ6IDE4LCB0eXBlOiBVbmtub3duLCBkZWYuIEAyMyl9XG4gICAgJSUgICBtOiAgICAgeyoqbSoqIChpZDogMjQsIHR5cGU6IFVua25vd24sIGRlZi4gQDMyKX1cbiAgICA3OVtbXCJgIzkxO1JGdW5jdGlvbkNhbGwjOTM7IHBvaW50c1xuICAgICAgKDc5KVxuICAgICAgKjE3LjEtMjQqXG4gICAgKDcyLCA3NylgXCJdXVxuICAgIDgyKFtcImAjOTE7UlN5bWJvbCM5MzsgZGF0YTJcbiAgICAgICg4MilcbiAgICAgICoxOS4xMi0xNipgXCJdKVxuICAgIDgze3tcImAjOTE7UlN5bWJvbCM5Mzsga1xuICAgICAgKDgzKVxuICAgICAgKjE5LjEyLTE4KmBcIn19XG4gICAgODVbW1wiYCM5MTtSQWNjZXNzIzkzOyAkXG4gICAgICAoODUpXG4gICAgICAqMTkuMTItMTgqXG4gICAgKDgyLCA4MylgXCJdXVxuICAgIDg3W1tcImAjOTE7UkZ1bmN0aW9uQ2FsbCM5MzsgbWVhblxuICAgICAgKDg3KVxuICAgICAgKjE5LjctMTkqXG4gICAgKDg1KWBcIl1dXG4gICAgODlbW1wiYCM5MTtSRnVuY3Rpb25DYWxsIzkzOyBwcmludFxuICAgICAgKDg5KVxuICAgICAgKjE5LjEtMjAqXG4gICAgKDg3KWBcIl1dXG4gICAgMyAtLT58XCJhcmd1bWVudFwifCAxXG4gICAgNyAtLT58XCJhcmd1bWVudFwifCA1XG4gICAgMTEgLS0+fFwiYXJndW1lbnRcInwgOVxuICAgIDE2IC0tPnxcImFyZ3VtZW50XCJ8IDE0XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAxNlxuICAgIDEyIC0tPnxcImRlZmluZWQtYnlcInwgMTdcbiAgICAxNyAtLT58XCJhcmd1bWVudFwifCAxNlxuICAgIDE3IC0tPnxcInJldHVybnMsIGFyZ3VtZW50XCJ8IDEyXG4gICAgMjIgLS0+fFwiYXJndW1lbnRcInwgMjBcbiAgICAxOCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDIyXG4gICAgMTggLS0+fFwiZGVmaW5lZC1ieVwifCAyM1xuICAgIDIzIC0tPnxcImFyZ3VtZW50XCJ8IDIyXG4gICAgMjMgLS0+fFwicmV0dXJucywgYXJndW1lbnRcInwgMThcbiAgICAyNiAtLT58XCJyZWFkc1wifCAxMlxuICAgIDI5IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCAyNlxuICAgIDI5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyN1xuICAgIDMxIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAyOVxuICAgIDI0IC0tPnxcImRlZmluZWQtYnlcInwgMzFcbiAgICAyNCAtLT58XCJkZWZpbmVkLWJ5XCJ8IDMyXG4gICAgMzIgLS0+fFwiYXJndW1lbnRcInwgMzFcbiAgICAzMiAtLT58XCJyZXR1cm5zLCBhcmd1bWVudFwifCAyNFxuICAgIDM0IC0tPnxcInJlYWRzXCJ8IDI0XG4gICAgMzYgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDM0XG4gICAgMzggLS0+fFwicmVhZHNcInwgMTJcbiAgICA0NCAtLT58XCJyZWFkc1wifCA0M1xuICAgIDQ3IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwicmVhZHNcInwgNDNcbiAgICA0OCAtLT58XCJhcmd1bWVudFwifCA0NFxuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDQ2XG4gICAgNDggLS0+fFwiYXJndW1lbnRcInwgNDdcbiAgICA1MCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNDhcbiAgICA1MCAtLT58XCJhcmd1bWVudFwifCAzOFxuICAgIDUyIC0tPnxcImFyZ3VtZW50XCJ8IDM4XG4gICAgNTIgLS0+fFwiYXJndW1lbnRcInwgNTBcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTJcbiAgICA1NSAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNTRcbiAgICA1NyAtLT58XCJyZWFkc1wifCAxOFxuICAgIDYwIC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA1N1xuICAgIDYwIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA1OFxuICAgIDYyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgNjUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDYyXG4gICAgNjUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYzXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDYwXG4gICAgNjcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDY1XG4gICAgNjkgLS0+fFwicmVhZHNcInwgMThcbiAgICA3MiAtLT58XCJyZWFkcywgcmV0dXJucywgYXJndW1lbnRcInwgNjlcbiAgICA3MiAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgNzBcbiAgICA3NCAtLT58XCJyZWFkc1wifCAxOFxuICAgIDc3IC0tPnxcInJlYWRzLCByZXR1cm5zLCBhcmd1bWVudFwifCA3NFxuICAgIDc3IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3NVxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3MlxuICAgIDc5IC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCA3N1xuICAgIDgyIC0tPnxcInJlYWRzXCJ8IDE4XG4gICAgODUgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDgyXG4gICAgODUgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDgzXG4gICAgODcgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDg1XG4gICAgODkgLS0+fFwicmVhZHMsIHJldHVybnMsIGFyZ3VtZW50XCJ8IDg3IiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19)\
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;7ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.94 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki//Interface) wiki page for more information on how to get those.


_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_

```text
{"dataflow":{".meta":{"timing":0},"graph":{"_idMap":{"size":119,"k2v":[[0,{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}}],[1,{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}}],[2,{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],[3,{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],[4,{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}}],[5,{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}}],[6,{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],[7,{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],[8,{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}}],[9,{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}}],[10,{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],[11,{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],[12,{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],[13,{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}}],[14,{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}}],[15,{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],[16,{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],[17,{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],[18,{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],[19,{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}}],[20,{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}}],[21,{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],[22,{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],[23,{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],[24,{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],[25,{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}}],[26,{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],[27,{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}}],[28,{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],[29,{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}}],[30,{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],[31,{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],[32,{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],[33,{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}}],[34,{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}}],[35,{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],[36,{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],[37,{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}}],[38,{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}}],[39,{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}}],[40,{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}}],[41,{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}}],[42,{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}}],[43,{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}}],[44,{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}}],[45,{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}}],[46,{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}}],[47,{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],[48,{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}}],[49,{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],[50,{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}}],[51,{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],[52,{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],[53,{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}}],[54,{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],[55,{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],[56,{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}}],[57,{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],[58,{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}}],[59,{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],[60,{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}}],[61,{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}}],[62,{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],[63,{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}}],[64,{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],[65,{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}}],[66,{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],[67,{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],[68,{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}}],[69,{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],[70,{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}}],[71,{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],[72,{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}}],[73,{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}}],[74,{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],[75,{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}}],[76,{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],[77,{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}}],[78,{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],[79,{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],[80,{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}}],[81,{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}}],[82,{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}],[83,{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}}],[84,{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],[85,{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}}],[86,{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],[87,{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}}],[88,{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],[89,{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],[90,{"type":"RExpressionList","children":[{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}},{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}},{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],"info":{"additionalTokens":[],"id":90,"nesting":0,"role":"root","index":0}}],["3-arg",{"type":"RFunctionCall","named":true,"location":[1,1,1,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[1,1,1,7],"content":"library","lexeme":"library","info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":0,"parent":3,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[1,9,1,14],"lexeme":"ggplot","value":{"type":"RSymbol","location":[1,9,1,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[1,9,1,14],"fullLexeme":"ggplot","additionalTokens":[],"id":2,"parent":3,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[1,1,1,15],"additionalTokens":[],"fullLexeme":"library(ggplot)","id":3,"parent":90,"nesting":0,"index":0,"role":"expr-list-child"}}],["7-arg",{"type":"RFunctionCall","named":true,"location":[2,1,2,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[2,1,2,7],"content":"library","lexeme":"library","info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":4,"parent":7,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[2,9,2,13],"lexeme":"dplyr","value":{"type":"RSymbol","location":[2,9,2,13],"content":"dplyr","lexeme":"dplyr","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[2,9,2,13],"fullLexeme":"dplyr","additionalTokens":[],"id":6,"parent":7,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[2,1,2,14],"additionalTokens":[],"fullLexeme":"library(dplyr)","id":7,"parent":90,"nesting":0,"index":1,"role":"expr-list-child"}}],["11-arg",{"type":"RFunctionCall","named":true,"location":[3,1,3,7],"lexeme":"library","functionName":{"type":"RSymbol","location":[3,1,3,7],"content":"library","lexeme":"library","info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":8,"parent":11,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[3,9,3,13],"lexeme":"readr","value":{"type":"RSymbol","location":[3,9,3,13],"content":"readr","lexeme":"readr","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[3,9,3,13],"fullLexeme":"readr","additionalTokens":[],"id":10,"parent":11,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[3,1,3,14],"additionalTokens":[],"fullLexeme":"library(readr)","id":11,"parent":90,"nesting":0,"index":2,"role":"expr-list-child"}}],["17-arg",{"type":"RBinaryOp","location":[6,6,6,7],"lhs":{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[6,1,6,28],"additionalTokens":[{"type":"RComment","location":[5,1,5,25],"content":" read data with read_csv","lexeme":"# read data with read_csv","info":{"fullRange":[6,1,6,28],"additionalTokens":[],"fullLexeme":"# read data with read_csv"}}],"fullLexeme":"data <- read_csv('data.csv')","id":17,"parent":90,"nesting":0,"index":3,"role":"expr-list-child"}}],["23-arg",{"type":"RBinaryOp","location":[7,7,7,8],"lhs":{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[7,1,7,30],"additionalTokens":[],"fullLexeme":"data2 <- read_csv('data2.csv')","id":23,"parent":90,"nesting":0,"index":4,"role":"expr-list-child"}}],["32-arg",{"type":"RBinaryOp","location":[9,3,9,4],"lhs":{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}},"rhs":{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"<-","lexeme":"<-","info":{"fullRange":[9,1,9,17],"additionalTokens":[],"fullLexeme":"m <- mean(data$x)","id":32,"parent":90,"nesting":0,"index":5,"role":"expr-list-child"}}],["36-arg",{"type":"RFunctionCall","named":true,"location":[10,1,10,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[10,1,10,5],"content":"print","lexeme":"print","info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":33,"parent":36,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[10,7,10,7],"lexeme":"m","value":{"type":"RSymbol","location":[10,7,10,7],"content":"m","lexeme":"m","info":{"fullRange":[10,7,10,7],"additionalTokens":[],"fullLexeme":"m","id":34,"parent":35,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[10,7,10,7],"fullLexeme":"m","additionalTokens":[],"id":35,"parent":36,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[10,1,10,8],"additionalTokens":[],"fullLexeme":"print(m)","id":36,"parent":90,"nesting":0,"index":6,"role":"expr-list-child"}}],["55-arg",{"type":"RBinaryOp","location":[13,35,13,35],"lhs":{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}},"rhs":{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}},"operator":"+","lexeme":"+","info":{"fullRange":[12,1,14,20],"additionalTokens":[],"fullLexeme":"data %>%\n\tggplot(aes(x = x, y = y)) +\n\tgeom_point()","id":55,"parent":90,"nesting":0,"index":7,"role":"expr-list-child"}}],["67-arg",{"type":"RFunctionCall","named":true,"location":[16,1,16,4],"lexeme":"plot","functionName":{"type":"RSymbol","location":[16,1,16,4],"content":"plot","lexeme":"plot","info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":56,"parent":67,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[16,6,16,12],"lexeme":"data2$x","value":{"type":"RAccess","location":[16,11,16,11],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,12,16,12],"lexeme":"x","value":{"type":"RSymbol","location":[16,12,16,12],"content":"x","lexeme":"x","info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":58,"parent":59,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,12,16,12],"fullLexeme":"x","additionalTokens":[],"id":59,"parent":60,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,6,16,12],"additionalTokens":[],"fullLexeme":"data2$x","id":60,"parent":61,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,6,16,12],"fullLexeme":"data2$x","additionalTokens":[],"id":61,"parent":67,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[16,15,16,21],"lexeme":"data2$y","value":{"type":"RAccess","location":[16,20,16,20],"lexeme":"$","accessed":{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[16,21,16,21],"lexeme":"y","value":{"type":"RSymbol","location":[16,21,16,21],"content":"y","lexeme":"y","info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":63,"parent":64,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[16,21,16,21],"fullLexeme":"y","additionalTokens":[],"id":64,"parent":65,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[16,15,16,21],"additionalTokens":[],"fullLexeme":"data2$y","id":65,"parent":66,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[16,15,16,21],"fullLexeme":"data2$y","additionalTokens":[],"id":66,"parent":67,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[16,1,16,22],"additionalTokens":[],"fullLexeme":"plot(data2$x, data2$y)","id":67,"parent":90,"nesting":0,"index":8,"role":"expr-list-child"}}],["79-arg",{"type":"RFunctionCall","named":true,"location":[17,1,17,6],"lexeme":"points","functionName":{"type":"RSymbol","location":[17,1,17,6],"content":"points","lexeme":"points","info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":68,"parent":79,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[17,8,17,14],"lexeme":"data2$x","value":{"type":"RAccess","location":[17,13,17,13],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,14,17,14],"lexeme":"x","value":{"type":"RSymbol","location":[17,14,17,14],"content":"x","lexeme":"x","info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":70,"parent":71,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,14,17,14],"fullLexeme":"x","additionalTokens":[],"id":71,"parent":72,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,8,17,14],"additionalTokens":[],"fullLexeme":"data2$x","id":72,"parent":73,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,8,17,14],"fullLexeme":"data2$x","additionalTokens":[],"id":73,"parent":79,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[17,17,17,23],"lexeme":"data2$y","value":{"type":"RAccess","location":[17,22,17,22],"lexeme":"$","accessed":{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[17,23,17,23],"lexeme":"y","value":{"type":"RSymbol","location":[17,23,17,23],"content":"y","lexeme":"y","info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":75,"parent":76,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[17,23,17,23],"fullLexeme":"y","additionalTokens":[],"id":76,"parent":77,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[17,17,17,23],"additionalTokens":[],"fullLexeme":"data2$y","id":77,"parent":78,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[17,17,17,23],"fullLexeme":"data2$y","additionalTokens":[],"id":78,"parent":79,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[17,1,17,24],"additionalTokens":[],"fullLexeme":"points(data2$x, data2$y)","id":79,"parent":90,"nesting":0,"index":9,"role":"expr-list-child"}}],["89-arg",{"type":"RFunctionCall","named":true,"location":[19,1,19,5],"lexeme":"print","functionName":{"type":"RSymbol","location":[19,1,19,5],"content":"print","lexeme":"print","info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":80,"parent":89,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,7,19,19],"lexeme":"mean(data2$k)","value":{"type":"RFunctionCall","named":true,"location":[19,7,19,10],"lexeme":"mean","functionName":{"type":"RSymbol","location":[19,7,19,10],"content":"mean","lexeme":"mean","info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":81,"parent":87,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[19,12,19,18],"lexeme":"data2$k","value":{"type":"RAccess","location":[19,17,19,17],"lexeme":"$","accessed":{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[19,18,19,18],"lexeme":"k","value":{"type":"RSymbol","location":[19,18,19,18],"content":"k","lexeme":"k","info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":83,"parent":84,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[19,18,19,18],"fullLexeme":"k","additionalTokens":[],"id":84,"parent":85,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[19,12,19,18],"additionalTokens":[],"fullLexeme":"data2$k","id":85,"parent":86,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,12,19,18],"fullLexeme":"data2$k","additionalTokens":[],"id":86,"parent":87,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,7,19,19],"additionalTokens":[],"fullLexeme":"mean(data2$k)","id":87,"parent":88,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[19,7,19,19],"fullLexeme":"mean(data2$k)","additionalTokens":[],"id":88,"parent":89,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[19,1,19,20],"additionalTokens":[],"fullLexeme":"print(mean(data2$k))","id":89,"parent":90,"nesting":0,"index":10,"role":"expr-list-child"}}],["1-arg",{"type":"RString","info":{"fullRange":[1,9,1,14],"additionalTokens":[],"fullLexeme":"ggplot","id":1,"parent":2,"role":"arg-value","index":0,"nesting":0},"lexeme":"ggplot","location":[1,9,1,14],"content":{"quotes":"none","str":"ggplot"}}],["5-arg",{"type":"RString","info":{"fullRange":[2,9,2,13],"additionalTokens":[],"fullLexeme":"dplyr","id":5,"parent":6,"role":"arg-value","index":0,"nesting":0},"lexeme":"dplyr","location":[2,9,2,13],"content":{"quotes":"none","str":"dplyr"}}],["9-arg",{"type":"RString","info":{"fullRange":[3,9,3,13],"additionalTokens":[],"fullLexeme":"readr","id":9,"parent":10,"role":"arg-value","index":0,"nesting":0},"lexeme":"readr","location":[3,9,3,13],"content":{"quotes":"none","str":"readr"}}],["12-arg",{"type":"RSymbol","location":[6,1,6,4],"content":"data","lexeme":"data","info":{"fullRange":[6,1,6,4],"additionalTokens":[],"fullLexeme":"data","id":12,"parent":17,"role":"binop-lhs","index":0,"nesting":0}}],["16-arg",{"type":"RFunctionCall","named":true,"location":[6,9,6,16],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[6,9,6,16],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":13,"parent":16,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[6,18,6,27],"lexeme":"'data.csv'","value":{"type":"RString","location":[6,18,6,27],"content":{"str":"data.csv","quotes":"'"},"lexeme":"'data.csv'","info":{"fullRange":[6,18,6,27],"additionalTokens":[],"fullLexeme":"'data.csv'","id":14,"parent":15,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[6,18,6,27],"fullLexeme":"'data.csv'","additionalTokens":[],"id":15,"parent":16,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[6,9,6,28],"additionalTokens":[],"fullLexeme":"read_csv('data.csv')","id":16,"parent":17,"nesting":0,"index":1,"role":"binop-rhs"}}],["18-arg",{"type":"RSymbol","location":[7,1,7,5],"content":"data2","lexeme":"data2","info":{"fullRange":[7,1,7,5],"additionalTokens":[],"fullLexeme":"data2","id":18,"parent":23,"role":"binop-lhs","index":0,"nesting":0}}],["22-arg",{"type":"RFunctionCall","named":true,"location":[7,10,7,17],"lexeme":"read_csv","functionName":{"type":"RSymbol","location":[7,10,7,17],"content":"read_csv","lexeme":"read_csv","info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":19,"parent":22,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[7,19,7,29],"lexeme":"'data2.csv'","value":{"type":"RString","location":[7,19,7,29],"content":{"str":"data2.csv","quotes":"'"},"lexeme":"'data2.csv'","info":{"fullRange":[7,19,7,29],"additionalTokens":[],"fullLexeme":"'data2.csv'","id":20,"parent":21,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[7,19,7,29],"fullLexeme":"'data2.csv'","additionalTokens":[],"id":21,"parent":22,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[7,10,7,30],"additionalTokens":[],"fullLexeme":"read_csv('data2.csv')","id":22,"parent":23,"nesting":0,"index":1,"role":"binop-rhs"}}],["24-arg",{"type":"RSymbol","location":[9,1,9,1],"content":"m","lexeme":"m","info":{"fullRange":[9,1,9,1],"additionalTokens":[],"fullLexeme":"m","id":24,"parent":32,"role":"binop-lhs","index":0,"nesting":0}}],["31-arg",{"type":"RFunctionCall","named":true,"location":[9,6,9,9],"lexeme":"mean","functionName":{"type":"RSymbol","location":[9,6,9,9],"content":"mean","lexeme":"mean","info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":25,"parent":31,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[9,11,9,16],"lexeme":"data$x","value":{"type":"RAccess","location":[9,15,9,15],"lexeme":"$","accessed":{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}},"operator":"$","access":[{"type":"RArgument","location":[9,16,9,16],"lexeme":"x","value":{"type":"RSymbol","location":[9,16,9,16],"content":"x","lexeme":"x","info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":27,"parent":28,"role":"arg-value","index":0,"nesting":0}},"info":{"fullRange":[9,16,9,16],"fullLexeme":"x","additionalTokens":[],"id":28,"parent":29,"nesting":0,"index":1,"role":"index-access"}}],"info":{"fullRange":[9,11,9,16],"additionalTokens":[],"fullLexeme":"data$x","id":29,"parent":30,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[9,11,9,16],"fullLexeme":"data$x","additionalTokens":[],"id":30,"parent":31,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[9,6,9,17],"additionalTokens":[],"fullLexeme":"mean(data$x)","id":31,"parent":32,"nesting":0,"index":1,"role":"binop-rhs"}}],["26-arg",{"type":"RSymbol","location":[9,11,9,14],"content":"data","lexeme":"data","info":{"fullRange":[9,11,9,14],"additionalTokens":[],"fullLexeme":"data","id":26,"parent":29,"role":"accessed","index":0,"nesting":0}}],["52-arg",{"type":"RFunctionCall","named":true,"infixSpecial":true,"lexeme":"data %>%\n\tggplot(aes(x = x, y = y))","location":[12,6,12,8],"functionName":{"type":"RSymbol","location":[12,6,12,8],"lexeme":"%>%","content":"%>%","info":{"id":37,"parent":52,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[12,1,12,4],"value":{"type":"RSymbol","location":[12,1,12,4],"content":"data","lexeme":"data","info":{"fullRange":[12,1,12,4],"additionalTokens":[],"fullLexeme":"data","id":38,"parent":39,"role":"arg-value","index":0,"nesting":0}},"lexeme":"data","info":{"id":39,"parent":52,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,9,13,14],"value":{"type":"RFunctionCall","named":true,"location":[13,9,13,14],"lexeme":"ggplot","functionName":{"type":"RSymbol","location":[13,9,13,14],"content":"ggplot","lexeme":"ggplot","info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":40,"parent":50,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,16,13,32],"lexeme":"aes(x = x, y = y)","value":{"type":"RFunctionCall","named":true,"location":[13,16,13,18],"lexeme":"aes","functionName":{"type":"RSymbol","location":[13,16,13,18],"content":"aes","lexeme":"aes","info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":41,"parent":48,"role":"call-name","index":0,"nesting":0}},"arguments":[{"type":"RArgument","location":[13,20,13,20],"lexeme":"x","name":{"type":"RSymbol","location":[13,20,13,20],"content":"x","lexeme":"x","info":{"fullRange":[13,20,13,20],"additionalTokens":[],"fullLexeme":"x","id":42,"parent":44,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,24,13,24],"content":"x","lexeme":"x","info":{"fullRange":[13,24,13,24],"additionalTokens":[],"fullLexeme":"x","id":43,"parent":44,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,20,13,20],"fullLexeme":"x","additionalTokens":[],"id":44,"parent":48,"nesting":0,"index":1,"role":"call-argument"}},{"type":"RArgument","location":[13,27,13,27],"lexeme":"y","name":{"type":"RSymbol","location":[13,27,13,27],"content":"y","lexeme":"y","info":{"fullRange":[13,27,13,27],"additionalTokens":[],"fullLexeme":"y","id":45,"parent":47,"role":"arg-name","index":0,"nesting":0}},"value":{"type":"RSymbol","location":[13,31,13,31],"content":"y","lexeme":"y","info":{"fullRange":[13,31,13,31],"additionalTokens":[],"fullLexeme":"y","id":46,"parent":47,"role":"arg-value","index":1,"nesting":0}},"info":{"fullRange":[13,27,13,27],"fullLexeme":"y","additionalTokens":[],"id":47,"parent":48,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"fullRange":[13,16,13,32],"additionalTokens":[],"fullLexeme":"aes(x = x, y = y)","id":48,"parent":49,"nesting":0,"index":0,"role":"arg-value"}},"info":{"fullRange":[13,16,13,32],"fullLexeme":"aes(x = x, y = y)","additionalTokens":[],"id":49,"parent":50,"nesting":0,"index":1,"role":"call-argument"}}],"info":{"fullRange":[13,9,13,33],"additionalTokens":[],"fullLexeme":"ggplot(aes(x = x, y = y))","id":50,"parent":51,"nesting":0,"index":0,"role":"arg-value"}},"lexeme":"ggplot","info":{"id":51,"parent":52,"nesting":0,"index":2,"role":"call-argument"}}],"info":{"additionalTokens":[],"id":52,"parent":55,"nesting":0,"role":"binop-lhs"}}],["54-arg",{"type":"RFunctionCall","named":true,"location":[14,9,14,18],"lexeme":"geom_point","functionName":{"type":"RSymbol","location":[14,9,14,18],"content":"geom_point","lexeme":"geom_point","info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":53,"parent":54,"role":"call-name","index":0,"nesting":0}},"arguments":[],"info":{"fullRange":[14,9,14,20],"additionalTokens":[],"fullLexeme":"geom_point()","id":54,"parent":55,"nesting":0,"index":1,"role":"binop-rhs"}}],["57-arg",{"type":"RSymbol","location":[16,6,16,10],"content":"data2","lexeme":"data2","info":{"fullRange":[16,6,16,10],"additionalTokens":[],"fullLexeme":"data2","id":57,"parent":60,"role":"accessed","index":0,"nesting":0}}],["62-arg",{"type":"RSymbol","location":[16,15,16,19],"content":"data2","lexeme":"data2","info":{"fullRange":[16,15,16,19],"additionalTokens":[],"fullLexeme":"data2","id":62,"parent":65,"role":"accessed","index":0,"nesting":0}}],["69-arg",{"type":"RSymbol","location":[17,8,17,12],"content":"data2","lexeme":"data2","info":{"fullRange":[17,8,17,12],"additionalTokens":[],"fullLexeme":"data2","id":69,"parent":72,"role":"accessed","index":0,"nesting":0}}],["74-arg",{"type":"RSymbol","location":[17,17,17,21],"content":"data2","lexeme":"data2","info":{"fullRange":[17,17,17,21],"additionalTokens":[],"fullLexeme":"data2","id":74,"parent":77,"role":"accessed","index":0,"nesting":0}}],["82-arg",{"type":"RSymbol","location":[19,12,19,16],"content":"data2","lexeme":"data2","info":{"fullRange":[19,12,19,16],"additionalTokens":[],"fullLexeme":"data2","id":82,"parent":85,"role":"accessed","index":0,"nesting":0}}]],"v2k":{}},"_unknownSideEffects":[3,7,11],"rootVertices":[1,3,5,7,9,11,14,16,12,17,20,22,18,23,26,27,29,31,24,32,34,36,38,43,44,46,47,48,50,52,54,55,57,58,60,62,63,65,67,69,70,72,74,75,77,79,82,83,85,87,89],"vertexInformation":[[1,{"tag":"value","id":1}],[3,{"tag":"function-call","id":3,"name":"library","onlyBuiltin":true,"args":[{"nodeId":1,"type":32}]}],[5,{"tag":"value","id":5}],[7,{"tag":"function-call","id":7,"name":"library","onlyBuiltin":true,"args":[{"nodeId":5,"type":32}]}],[9,{"tag":"value","id":9}],[11,{"tag":"function-call","id":11,"name":"library","onlyBuiltin":true,"args":[{"nodeId":9,"type":32}]}],[14,{"tag":"value","id":14}],[16,{"tag":"function-call","id":16,"environment":{"current":{"id":358,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":14,"type":32}]}],[12,{"tag":"variable-definition","id":12}],[17,{"tag":"function-call","id":17,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":12,"type":32},{"nodeId":16,"type":32}]}],[20,{"tag":"value","id":20}],[22,{"tag":"function-call","id":22,"environment":{"current":{"id":368,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]]]},"level":0},"name":"read_csv","onlyBuiltin":false,"args":[{"nodeId":20,"type":32}]}],[18,{"tag":"variable-definition","id":18}],[23,{"tag":"function-call","id":23,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":18,"type":32},{"nodeId":22,"type":32}]}],[26,{"tag":"use","id":26}],[27,{"tag":"value","id":27}],[29,{"tag":"function-call","id":29,"name":"$","onlyBuiltin":true,"args":[{"nodeId":26,"type":32},{"nodeId":27,"type":32}]}],[31,{"tag":"function-call","id":31,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":29,"type":32}]}],[24,{"tag":"variable-definition","id":24}],[32,{"tag":"function-call","id":32,"name":"<-","onlyBuiltin":true,"args":[{"nodeId":24,"type":32},{"nodeId":31,"type":32}]}],[34,{"tag":"use","id":34}],[36,{"tag":"function-call","id":36,"name":"print","onlyBuiltin":true,"args":[{"nodeId":34,"type":32}]}],[38,{"tag":"use","id":38}],[43,{"tag":"use","id":43}],[44,{"tag":"use","id":44}],[46,{"tag":"use","id":46}],[47,{"tag":"use","id":47}],[48,{"tag":"function-call","id":48,"environment":{"current":{"id":400,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"aes","onlyBuiltin":false,"args":[{"nodeId":44,"name":"x","type":32},{"nodeId":47,"name":"y","type":32}]}],[50,{"tag":"function-call","id":50,"environment":{"current":{"id":403,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"ggplot","onlyBuiltin":false,"args":[{"nodeId":38,"type":2},{"nodeId":48,"type":32}]}],[52,{"tag":"function-call","id":52,"name":"%>%","onlyBuiltin":true,"args":[{"nodeId":38,"type":32},{"nodeId":50,"type":32}]}],[54,{"tag":"function-call","id":54,"environment":{"current":{"id":409,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"geom_point","onlyBuiltin":false,"args":[]}],[55,{"tag":"function-call","id":55,"name":"+","onlyBuiltin":true,"args":[{"nodeId":52,"type":32},{"nodeId":54,"type":32}]}],[57,{"tag":"use","id":57}],[58,{"tag":"value","id":58}],[60,{"tag":"function-call","id":60,"name":"$","onlyBuiltin":true,"args":[{"nodeId":57,"type":32},{"nodeId":58,"type":32}]}],[62,{"tag":"use","id":62}],[63,{"tag":"value","id":63}],[65,{"tag":"function-call","id":65,"name":"$","onlyBuiltin":true,"args":[{"nodeId":62,"type":32},{"nodeId":63,"type":32}]}],[67,{"tag":"function-call","id":67,"name":"plot","onlyBuiltin":true,"args":[{"nodeId":60,"type":32},{"nodeId":65,"type":32}]}],[69,{"tag":"use","id":69}],[70,{"tag":"value","id":70}],[72,{"tag":"function-call","id":72,"name":"$","onlyBuiltin":true,"args":[{"nodeId":69,"type":32},{"nodeId":70,"type":32}]}],[74,{"tag":"use","id":74}],[75,{"tag":"value","id":75}],[77,{"tag":"function-call","id":77,"name":"$","onlyBuiltin":true,"args":[{"nodeId":74,"type":32},{"nodeId":75,"type":32}]}],[79,{"tag":"function-call","id":79,"environment":{"current":{"id":442,"parent":{"id":0,"memory":[["NULL",[{"type":64,"definedAt":"built-in","value":null,"name":"NULL","nodeId":"built-in"}]],["NA",[{"type":64,"definedAt":"built-in","value":null,"name":"NA","nodeId":"built-in"}]],["TRUE",[{"type":64,"definedAt":"built-in","value":true,"name":"TRUE","nodeId":"built-in"}]],["T",[{"type":64,"definedAt":"built-in","value":true,"name":"T","nodeId":"built-in"}]],["FALSE",[{"type":64,"definedAt":"built-in","value":false,"name":"FALSE","nodeId":"built-in"}]],["F",[{"type":64,"definedAt":"built-in","value":false,"name":"F","nodeId":"built-in"}]],["~",[{"type":128,"definedAt":"built-in","name":"~","nodeId":"built-in"}]],["+",[{"type":128,"definedAt":"built-in","name":"+","nodeId":"built-in"}]],["-",[{"type":128,"definedAt":"built-in","name":"-","nodeId":"built-in"}]],["*",[{"type":128,"definedAt":"built-in","name":"*","nodeId":"built-in"}]],["/",[{"type":128,"definedAt":"built-in","name":"/","nodeId":"built-in"}]],["^",[{"type":128,"definedAt":"built-in","name":"^","nodeId":"built-in"}]],["!",[{"type":128,"definedAt":"built-in","name":"!","nodeId":"built-in"}]],["?",[{"type":128,"definedAt":"built-in","name":"?","nodeId":"built-in"}]],["**",[{"type":128,"definedAt":"built-in","name":"**","nodeId":"built-in"}]],["==",[{"type":128,"definedAt":"built-in","name":"==","nodeId":"built-in"}]],["!=",[{"type":128,"definedAt":"built-in","name":"!=","nodeId":"built-in"}]],[">",[{"type":128,"definedAt":"built-in","name":">","nodeId":"built-in"}]],["<",[{"type":128,"definedAt":"built-in","name":"<","nodeId":"built-in"}]],[">=",[{"type":128,"definedAt":"built-in","name":">=","nodeId":"built-in"}]],["<=",[{"type":128,"definedAt":"built-in","name":"<=","nodeId":"built-in"}]],["%%",[{"type":128,"definedAt":"built-in","name":"%%","nodeId":"built-in"}]],["%/%",[{"type":128,"definedAt":"built-in","name":"%/%","nodeId":"built-in"}]],["%*%",[{"type":128,"definedAt":"built-in","name":"%*%","nodeId":"built-in"}]],["%in%",[{"type":128,"definedAt":"built-in","name":"%in%","nodeId":"built-in"}]],[":",[{"type":128,"definedAt":"built-in","name":":","nodeId":"built-in"}]],["list",[{"type":128,"definedAt":"built-in","name":"list","nodeId":"built-in"}]],["c",[{"type":128,"definedAt":"built-in","name":"c","nodeId":"built-in"}]],["rep",[{"type":128,"definedAt":"built-in","name":"rep","nodeId":"built-in"}]],["seq",[{"type":128,"definedAt":"built-in","name":"seq","nodeId":"built-in"}]],["seq_len",[{"type":128,"definedAt":"built-in","name":"seq_len","nodeId":"built-in"}]],["seq_along",[{"type":128,"definedAt":"built-in","name":"seq_along","nodeId":"built-in"}]],["seq.int",[{"type":128,"definedAt":"built-in","name":"seq.int","nodeId":"built-in"}]],["gsub",[{"type":128,"definedAt":"built-in","name":"gsub","nodeId":"built-in"}]],["which",[{"type":128,"definedAt":"built-in","name":"which","nodeId":"built-in"}]],["class",[{"type":128,"definedAt":"built-in","name":"class","nodeId":"built-in"}]],["dimnames",[{"type":128,"definedAt":"built-in","name":"dimnames","nodeId":"built-in"}]],["min",[{"type":128,"definedAt":"built-in","name":"min","nodeId":"built-in"}]],["max",[{"type":128,"definedAt":"built-in","name":"max","nodeId":"built-in"}]],["intersect",[{"type":128,"definedAt":"built-in","name":"intersect","nodeId":"built-in"}]],["subset",[{"type":128,"definedAt":"built-in","name":"subset","nodeId":"built-in"}]],["match",[{"type":128,"definedAt":"built-in","name":"match","nodeId":"built-in"}]],["sqrt",[{"type":128,"definedAt":"built-in","name":"sqrt","nodeId":"built-in"}]],["abs",[{"type":128,"definedAt":"built-in","name":"abs","nodeId":"built-in"}]],["round",[{"type":128,"definedAt":"built-in","name":"round","nodeId":"built-in"}]],["floor",[{"type":128,"definedAt":"built-in","name":"floor","nodeId":"built-in"}]],["ceiling",[{"type":128,"definedAt":"built-in","name":"ceiling","nodeId":"built-in"}]],["signif",[{"type":128,"definedAt":"built-in","name":"signif","nodeId":"built-in"}]],["trunc",[{"type":128,"definedAt":"built-in","name":"trunc","nodeId":"built-in"}]],["log",[{"type":128,"definedAt":"built-in","name":"log","nodeId":"built-in"}]],["log10",[{"type":128,"definedAt":"built-in","name":"log10","nodeId":"built-in"}]],["log2",[{"type":128,"definedAt":"built-in","name":"log2","nodeId":"built-in"}]],["sum",[{"type":128,"definedAt":"built-in","name":"sum","nodeId":"built-in"}]],["mean",[{"type":128,"definedAt":"built-in","name":"mean","nodeId":"built-in"}]],["unique",[{"type":128,"definedAt":"built-in","name":"unique","nodeId":"built-in"}]],["paste",[{"type":128,"definedAt":"built-in","name":"paste","nodeId":"built-in"}]],["paste0",[{"type":128,"definedAt":"built-in","name":"paste0","nodeId":"built-in"}]],["read.csv",[{"type":128,"definedAt":"built-in","name":"read.csv","nodeId":"built-in"}]],["stop",[{"type":128,"definedAt":"built-in","name":"stop","nodeId":"built-in"}]],["is.null",[{"type":128,"definedAt":"built-in","name":"is.null","nodeId":"built-in"}]],["plot",[{"type":128,"definedAt":"built-in","name":"plot","nodeId":"built-in"}]],["numeric",[{"type":128,"definedAt":"built-in","name":"numeric","nodeId":"built-in"}]],["as.character",[{"type":128,"definedAt":"built-in","name":"as.character","nodeId":"built-in"}]],["as.integer",[{"type":128,"definedAt":"built-in","name":"as.integer","nodeId":"built-in"}]],["as.logical",[{"type":128,"definedAt":"built-in","name":"as.logical","nodeId":"built-in"}]],["as.numeric",[{"type":128,"definedAt":"built-in","name":"as.numeric","nodeId":"built-in"}]],["as.matrix",[{"type":128,"definedAt":"built-in","name":"as.matrix","nodeId":"built-in"}]],["rbind",[{"type":128,"definedAt":"built-in","name":"rbind","nodeId":"built-in"}]],["nrow",[{"type":128,"definedAt":"built-in","name":"nrow","nodeId":"built-in"}]],["ncol",[{"type":128,"definedAt":"built-in","name":"ncol","nodeId":"built-in"}]],["tryCatch",[{"type":128,"definedAt":"built-in","name":"tryCatch","nodeId":"built-in"}]],["expression",[{"type":128,"definedAt":"built-in","name":"expression","nodeId":"built-in"}]],["factor",[{"type":128,"definedAt":"built-in","name":"factor","nodeId":"built-in"}]],["missing",[{"type":128,"definedAt":"built-in","name":"missing","nodeId":"built-in"}]],["as.data.frame",[{"type":128,"definedAt":"built-in","name":"as.data.frame","nodeId":"built-in"}]],["data.frame",[{"type":128,"definedAt":"built-in","name":"data.frame","nodeId":"built-in"}]],["na.omit",[{"type":128,"definedAt":"built-in","name":"na.omit","nodeId":"built-in"}]],["rownames",[{"type":128,"definedAt":"built-in","name":"rownames","nodeId":"built-in"}]],["names",[{"type":128,"definedAt":"built-in","name":"names","nodeId":"built-in"}]],["order",[{"type":128,"definedAt":"built-in","name":"order","nodeId":"built-in"}]],["length",[{"type":128,"definedAt":"built-in","name":"length","nodeId":"built-in"}]],["any",[{"type":128,"definedAt":"built-in","name":"any","nodeId":"built-in"}]],["dim",[{"type":128,"definedAt":"built-in","name":"dim","nodeId":"built-in"}]],["matrix",[{"type":128,"definedAt":"built-in","name":"matrix","nodeId":"built-in"}]],["cbind",[{"type":128,"definedAt":"built-in","name":"cbind","nodeId":"built-in"}]],["nchar",[{"type":128,"definedAt":"built-in","name":"nchar","nodeId":"built-in"}]],["t",[{"type":128,"definedAt":"built-in","name":"t","nodeId":"built-in"}]],["options",[{"type":128,"definedAt":"built-in","name":"options","nodeId":"built-in"}]],["mapply",[{"type":128,"definedAt":"built-in","name":"mapply","nodeId":"built-in"}]],["Mapply",[{"type":128,"definedAt":"built-in","name":"Mapply","nodeId":"built-in"}]],["lapply",[{"type":128,"definedAt":"built-in","name":"lapply","nodeId":"built-in"}]],["sapply",[{"type":128,"definedAt":"built-in","name":"sapply","nodeId":"built-in"}]],["vapply",[{"type":128,"definedAt":"built-in","name":"vapply","nodeId":"built-in"}]],["Lapply",[{"type":128,"definedAt":"built-in","name":"Lapply","nodeId":"built-in"}]],["Sapply",[{"type":128,"definedAt":"built-in","name":"Sapply","nodeId":"built-in"}]],["Vapply",[{"type":128,"definedAt":"built-in","name":"Vapply","nodeId":"built-in"}]],["apply",[{"type":128,"definedAt":"built-in","name":"apply","nodeId":"built-in"}]],["tapply",[{"type":128,"definedAt":"built-in","name":"tapply","nodeId":"built-in"}]],["Tapply",[{"type":128,"definedAt":"built-in","name":"Tapply","nodeId":"built-in"}]],["print",[{"type":128,"definedAt":"built-in","name":"print","nodeId":"built-in"}]],["(",[{"type":128,"definedAt":"built-in","name":"(","nodeId":"built-in"}]],["load",[{"type":128,"definedAt":"built-in","name":"load","nodeId":"built-in"}]],["load_all",[{"type":128,"definedAt":"built-in","name":"load_all","nodeId":"built-in"}]],["setwd",[{"type":128,"definedAt":"built-in","name":"setwd","nodeId":"built-in"}]],["set.seed",[{"type":128,"definedAt":"built-in","name":"set.seed","nodeId":"built-in"}]],["eval",[{"type":128,"definedAt":"built-in","name":"eval","nodeId":"built-in"}]],["body",[{"type":128,"definedAt":"built-in","name":"body","nodeId":"built-in"}]],["formals",[{"type":128,"definedAt":"built-in","name":"formals","nodeId":"built-in"}]],["environment",[{"type":128,"definedAt":"built-in","name":"environment","nodeId":"built-in"}]],["cat",[{"type":128,"definedAt":"built-in","name":"cat","nodeId":"built-in"}]],["switch",[{"type":128,"definedAt":"built-in","name":"switch","nodeId":"built-in"}]],["return",[{"type":128,"definedAt":"built-in","name":"return","nodeId":"built-in"}]],["break",[{"type":128,"definedAt":"built-in","name":"break","nodeId":"built-in"}]],["next",[{"type":128,"definedAt":"built-in","name":"next","nodeId":"built-in"}]],["{",[{"type":128,"definedAt":"built-in","name":"{","nodeId":"built-in"}]],["source",[{"type":128,"definedAt":"built-in","name":"source","nodeId":"built-in"}]],["[",[{"type":128,"definedAt":"built-in","name":"[","nodeId":"built-in"}]],["[[",[{"type":128,"definedAt":"built-in","name":"[[","nodeId":"built-in"}]],["$",[{"type":128,"definedAt":"built-in","name":"$","nodeId":"built-in"}]],["@",[{"type":128,"definedAt":"built-in","name":"@","nodeId":"built-in"}]],["if",[{"type":128,"definedAt":"built-in","name":"if","nodeId":"built-in"}]],["ifelse",[{"type":128,"definedAt":"built-in","name":"ifelse","nodeId":"built-in"}]],["get",[{"type":128,"definedAt":"built-in","name":"get","nodeId":"built-in"}]],["library",[{"type":128,"definedAt":"built-in","name":"library","nodeId":"built-in"}]],["require",[{"type":128,"definedAt":"built-in","name":"require","nodeId":"built-in"}]],["<-",[{"type":128,"definedAt":"built-in","name":"<-","nodeId":"built-in"}]],["=",[{"type":128,"definedAt":"built-in","name":"=","nodeId":"built-in"}]],[":=",[{"type":128,"definedAt":"built-in","name":":=","nodeId":"built-in"}]],["assign",[{"type":128,"definedAt":"built-in","name":"assign","nodeId":"built-in"}]],["delayedAssign",[{"type":128,"definedAt":"built-in","name":"delayedAssign","nodeId":"built-in"}]],["<<-",[{"type":128,"definedAt":"built-in","name":"<<-","nodeId":"built-in"}]],["->",[{"type":128,"definedAt":"built-in","name":"->","nodeId":"built-in"}]],["->>",[{"type":128,"definedAt":"built-in","name":"->>","nodeId":"built-in"}]],["&&",[{"type":128,"definedAt":"built-in","name":"&&","nodeId":"built-in"}]],["&",[{"type":128,"definedAt":"built-in","name":"&","nodeId":"built-in"}]],["||",[{"type":128,"definedAt":"built-in","name":"||","nodeId":"built-in"}]],["|",[{"type":128,"definedAt":"built-in","name":"|","nodeId":"built-in"}]],["|>",[{"type":128,"definedAt":"built-in","name":"|>","nodeId":"built-in"}]],["%>%",[{"type":128,"definedAt":"built-in","name":"%>%","nodeId":"built-in"}]],["function",[{"type":128,"definedAt":"built-in","name":"function","nodeId":"built-in"}]],["\\",[{"type":128,"definedAt":"built-in","name":"\\","nodeId":"built-in"}]],["quote",[{"type":128,"definedAt":"built-in","name":"quote","nodeId":"built-in"}]],["substitute",[{"type":128,"definedAt":"built-in","name":"substitute","nodeId":"built-in"}]],["bquote",[{"type":128,"definedAt":"built-in","name":"bquote","nodeId":"built-in"}]],["for",[{"type":128,"definedAt":"built-in","name":"for","nodeId":"built-in"}]],["repeat",[{"type":128,"definedAt":"built-in","name":"repeat","nodeId":"built-in"}]],["while",[{"type":128,"definedAt":"built-in","name":"while","nodeId":"built-in"}]],["do.call",[{"type":128,"definedAt":"built-in","name":"do.call","nodeId":"built-in"}]],["on.exit",[{"type":128,"definedAt":"built-in","name":"on.exit","nodeId":"built-in"}]],["sys.on.exit",[{"type":128,"definedAt":"built-in","name":"sys.on.exit","nodeId":"built-in"}]],["par",[{"type":128,"definedAt":"built-in","name":"par","nodeId":"built-in"}]],["setnames",[{"type":128,"definedAt":"built-in","name":"setnames","nodeId":"built-in"}]],["setNames",[{"type":128,"definedAt":"built-in","name":"setNames","nodeId":"built-in"}]],["setkey",[{"type":128,"definedAt":"built-in","name":"setkey","nodeId":"built-in"}]],["setkeyv",[{"type":128,"definedAt":"built-in","name":"setkeyv","nodeId":"built-in"}]],["setindex",[{"type":128,"definedAt":"built-in","name":"setindex","nodeId":"built-in"}]],["setindexv",[{"type":128,"definedAt":"built-in","name":"setindexv","nodeId":"built-in"}]],["setattr",[{"type":128,"definedAt":"built-in","name":"setattr","nodeId":"built-in"}]],["sink",[{"type":128,"definedAt":"built-in","name":"sink","nodeId":"built-in"}]],["requireNamespace",[{"type":128,"definedAt":"built-in","name":"requireNamespace","nodeId":"built-in"}]],["loadNamespace",[{"type":128,"definedAt":"built-in","name":"loadNamespace","nodeId":"built-in"}]],["attachNamespace",[{"type":128,"definedAt":"built-in","name":"attachNamespace","nodeId":"built-in"}]],["asNamespace",[{"type":128,"definedAt":"built-in","name":"asNamespace","nodeId":"built-in"}]],["library.dynam",[{"type":128,"definedAt":"built-in","name":"library.dynam","nodeId":"built-in"}]],["install.packages",[{"type":128,"definedAt":"built-in","name":"install.packages","nodeId":"built-in"}]],["install",[{"type":128,"definedAt":"built-in","name":"install","nodeId":"built-in"}]],["install_github",[{"type":128,"definedAt":"built-in","name":"install_github","nodeId":"built-in"}]],["install_gitlab",[{"type":128,"definedAt":"built-in","name":"install_gitlab","nodeId":"built-in"}]],["install_bitbucket",[{"type":128,"definedAt":"built-in","name":"install_bitbucket","nodeId":"built-in"}]],["install_url",[{"type":128,"definedAt":"built-in","name":"install_url","nodeId":"built-in"}]],["install_git",[{"type":128,"definedAt":"built-in","name":"install_git","nodeId":"built-in"}]],["install_svn",[{"type":128,"definedAt":"built-in","name":"install_svn","nodeId":"built-in"}]],["install_local",[{"type":128,"definedAt":"built-in","name":"install_local","nodeId":"built-in"}]],["install_version",[{"type":128,"definedAt":"built-in","name":"install_version","nodeId":"built-in"}]],["update_packages",[{"type":128,"definedAt":"built-in","name":"update_packages","nodeId":"built-in"}]],["attach",[{"type":128,"definedAt":"built-in","name":"attach","nodeId":"built-in"}]],["detach",[{"type":128,"definedAt":"built-in","name":"detach","nodeId":"built-in"}]],["unname",[{"type":128,"definedAt":"built-in","name":"unname","nodeId":"built-in"}]],["rm",[{"type":128,"definedAt":"built-in","name":"rm","nodeId":"built-in"}]],["remove",[{"type":128,"definedAt":"built-in","name":"remove","nodeId":"built-in"}]],["[<-",[{"type":128,"definedAt":"built-in","name":"[<-","nodeId":"built-in"}]],["[<<-",[{"type":128,"definedAt":"built-in","name":"[<<-","nodeId":"built-in"}]],["[[<-",[{"type":128,"definedAt":"built-in","name":"[[<-","nodeId":"built-in"}]],["[[<<-",[{"type":128,"definedAt":"built-in","name":"[[<<-","nodeId":"built-in"}]],["$<-",[{"type":128,"definedAt":"built-in","name":"$<-","nodeId":"built-in"}]],["$<<-",[{"type":128,"definedAt":"built-in","name":"$<<-","nodeId":"built-in"}]],["@<-",[{"type":128,"definedAt":"built-in","name":"@<-","nodeId":"built-in"}]],["@<<-",[{"type":128,"definedAt":"built-in","name":"@<<-","nodeId":"built-in"}]],["names<-",[{"type":128,"definedAt":"built-in","name":"names<-","nodeId":"built-in"}]],["names<<-",[{"type":128,"definedAt":"built-in","name":"names<<-","nodeId":"built-in"}]],["dimnames<-",[{"type":128,"definedAt":"built-in","name":"dimnames<-","nodeId":"built-in"}]],["dimnames<<-",[{"type":128,"definedAt":"built-in","name":"dimnames<<-","nodeId":"built-in"}]],["attributes<-",[{"type":128,"definedAt":"built-in","name":"attributes<-","nodeId":"built-in"}]],["attributes<<-",[{"type":128,"definedAt":"built-in","name":"attributes<<-","nodeId":"built-in"}]],["attr<-",[{"type":128,"definedAt":"built-in","name":"attr<-","nodeId":"built-in"}]],["attr<<-",[{"type":128,"definedAt":"built-in","name":"attr<<-","nodeId":"built-in"}]],["class<-",[{"type":128,"definedAt":"built-in","name":"class<-","nodeId":"built-in"}]],["class<<-",[{"type":128,"definedAt":"built-in","name":"class<<-","nodeId":"built-in"}]],["levels<-",[{"type":128,"definedAt":"built-in","name":"levels<-","nodeId":"built-in"}]],["levels<<-",[{"type":128,"definedAt":"built-in","name":"levels<<-","nodeId":"built-in"}]],["rownames<-",[{"type":128,"definedAt":"built-in","name":"rownames<-","nodeId":"built-in"}]],["rownames<<-",[{"type":128,"definedAt":"built-in","name":"rownames<<-","nodeId":"built-in"}]],["colnames<-",[{"type":128,"definedAt":"built-in","name":"colnames<-","nodeId":"built-in"}]],["colnames<<-",[{"type":128,"definedAt":"built-in","name":"colnames<<-","nodeId":"built-in"}]],["body<-",[{"type":128,"definedAt":"built-in","name":"body<-","nodeId":"built-in"}]],["body<<-",[{"type":128,"definedAt":"built-in","name":"body<<-","nodeId":"built-in"}]],["environment<-",[{"type":128,"definedAt":"built-in","name":"environment<-","nodeId":"built-in"}]],["environment<<-",[{"type":128,"definedAt":"built-in","name":"environment<<-","nodeId":"built-in"}]],["formals<-",[{"type":128,"definedAt":"built-in","name":"formals<-","nodeId":"built-in"}]],["formals<<-",[{"type":128,"definedAt":"built-in","name":"formals<<-","nodeId":"built-in"}]]]},"memory":[["data",[{"nodeId":12,"name":"data","type":1,"definedAt":17}]],["data2",[{"nodeId":18,"name":"data2","type":1,"definedAt":23}]],["m",[{"nodeId":24,"name":"m","type":1,"definedAt":32}]]]},"level":0},"name":"points","onlyBuiltin":false,"args":[{"nodeId":72,"type":32},{"nodeId":77,"type":32}]}],[82,{"tag":"use","id":82}],[83,{"tag":"value","id":83}],[85,{"tag":"function-call","id":85,"name":"$","onlyBuiltin":true,"args":[{"nodeId":82,"type":32},{"nodeId":83,"type":32}]}],[87,{"tag":"function-call","id":87,"name":"mean","onlyBuiltin":true,"args":[{"nodeId":85,"type":32}]}],[89,{"tag":"function-call","id":89,"name":"print","onlyBuiltin":true,"args":[{"nodeId":87,"type":32}]}]],"edgeInformation":[[3,[[1,{"types":64}]]],[7,[[5,{"types":64}]]],[11,[[9,{"types":64}]]],[16,[[14,{"types":64}]]],[17,[[16,{"types":64}],[12,{"types":72}]]],[12,[[16,{"types":2}],[17,{"types":2}]]],[22,[[20,{"types":64}]]],[23,[[22,{"types":64}],[18,{"types":72}]]],[18,[[22,{"types":2}],[23,{"types":2}]]],[26,[[12,{"types":1}]]],[29,[[26,{"types":73}],[27,{"types":65}]]],[31,[[29,{"types":65}]]],[32,[[31,{"types":64}],[24,{"types":72}]]],[24,[[31,{"types":2}],[32,{"types":2}]]],[34,[[24,{"types":1}]]],[36,[[34,{"types":73}]]],[38,[[12,{"types":1}]]],[52,[[38,{"types":64}],[50,{"types":64}]]],[44,[[43,{"types":1}]]],[48,[[43,{"types":1}],[44,{"types":64}],[46,{"types":1}],[47,{"types":64}]]],[47,[[46,{"types":1}]]],[50,[[48,{"types":65}],[38,{"types":64}]]],[55,[[52,{"types":65}],[54,{"types":65}]]],[57,[[18,{"types":1}]]],[60,[[57,{"types":73}],[58,{"types":65}]]],[67,[[60,{"types":65}],[65,{"types":65}]]],[62,[[18,{"types":1}]]],[65,[[62,{"types":73}],[63,{"types":65}]]],[69,[[18,{"types":1}]]],[72,[[69,{"types":73}],[70,{"types":65}]]],[79,[[72,{"types":65}],[77,{"types":65}]]],[74,[[18,{"types":1}]]],[77,[[74,{"types":73}],[75,{"types":65}]]],[82,[[18,{"types":1}]]],[85,[[82,{"types":73}],[83,{"types":65}]]],[87,[[85,{"types":65}]]],[89,[[87,{"types":73}]]]]}},".meta":{"timing":0}}
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

The analysis required _9.05 ms_ (including parsing and normalization) within the generation environment. 
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
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈1ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;9ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _8.77 ms_ (including parsing and normalization and the query) within the generation environment.	

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
    "timing": 1
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
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;5ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _5.40 ms_ (including parsing and normalization and the query) within the generation environment.	

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
_All&nbsp;queries&nbsp;together&nbsp;required&nbsp;≈0ms&nbsp;(1ms&nbsp;accuracy,&nbsp;total&nbsp;9ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _8.67 ms_ (including parsing and normalization and the query) within the generation environment.	

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




