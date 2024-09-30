_This document was generated from 'src/documentation/print-normalized-ast-wiki.ts' on 2024-09-30, 06:14:09 UTC presenting an overview of flowR's normalized ast (v2.0.25, using R v4.4.1)._

_flowR_ produces a normalized version of R's abstract syntax tree (AST), 
offering the following benefits. It...
 
1. abstracts away from intricacies of the R parser
2. provides a version-independent representation of the program
3. decorates the AST with additional information, e.g., parent relations and nesting information

In general, the mapping should be rather intuitive and focused primarily on the
syntactic structure of the program.
Consider the following example which shows the normalized AST of the code


```r
x <- 2 * 3 + 1
```





```mermaid
flowchart TD
    n7(["RExpressionList (7)
 "])
    n6(["RBinaryOp (6)
#60;#45;"])
    n7 -->|"expr-list-child-0"| n6
    n0(["RSymbol (0)
x"])
    n6 -->|"binop-lhs"| n0
    n5(["RBinaryOp (5)
#43;"])
    n6 -->|"binop-rhs"| n5
    n3(["RBinaryOp (3)
#42;"])
    n5 -->|"binop-lhs"| n3
    n1(["RNumber (1)
2"])
    n3 -->|"binop-lhs"| n1
    n2(["RNumber (2)
3"])
    n3 -->|"binop-rhs"| n2
    n4(["RNumber (4)
1"])
    n5 -->|"binop-rhs"| n4

```
	
<details>

<summary style="color:gray">R Code of the Normalized AST</summary>

The analysis required _6.65 ms_ (including parsing) within the generation environment.

```r
x <- 2 * 3 + 1
```

<details>

<summary style="color:gray">Mermaid Code</summary>

```
flowchart TD
    n7(["RExpressionList (7)
 "])
    n6(["RBinaryOp (6)
#60;#45;"])
    n7 -->|"expr-list-child-0"| n6
    n0(["RSymbol (0)
x"])
    n6 -->|"binop-lhs"| n0
    n5(["RBinaryOp (5)
#43;"])
    n6 -->|"binop-rhs"| n5
    n3(["RBinaryOp (3)
#42;"])
    n5 -->|"binop-lhs"| n3
    n1(["RNumber (1)
2"])
    n3 -->|"binop-lhs"| n1
    n2(["RNumber (2)
3"])
    n3 -->|"binop-rhs"| n2
    n4(["RNumber (4)
1"])
    n5 -->|"binop-rhs"| n4

```

</details>

</details>



Indicative is the root expression list node, which is present in every normalized AST.
In general, we provide node types for:

1. literals (e.g., numbers and strings)
2. references (e.g., symbols, parameters and function calls)
3. constructs (e.g., loops and function definitions)
4. branches (e.g., `next` and `break`)
5. operators (e.g. `+`, `-`, and `*`)

The entry type into the structure is the  


```mermaid
classDiagram
direction RL
class RNode~Info = NoInfo~
    <<type>> RNode
style RNode fill:#FAFAFA,stroke:#333
click RNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L160" ""
class RExpressionList~Info = NoInfo~
    <<interface>> RExpressionList
    RExpressionList : type
    RExpressionList : grouping
click RExpressionList href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L5" ""
class WithChildren~Info, Children extends Base<Info, string | undefined>~
    <<interface>> WithChildren
    WithChildren : children
click WithChildren href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L71" ""
    RExpressionList : lexeme [from Base]
    RExpressionList : info [from Base]
class RFunctions~Info~
    <<type>> RFunctions
style RFunctions fill:#FAFAFA,stroke:#333
click RFunctions href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L143" ""
class RFunctionDefinition~Info = NoInfo~
    <<interface>> RFunctionDefinition
    RFunctionDefinition : type
    RFunctionDefinition : parameters
    RFunctionDefinition : body
click RFunctionDefinition href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L5" ""
    RFunctionDefinition : lexeme [from Base]
    RFunctionDefinition : info [from Base]
    RFunctionDefinition : location [from Location]
class RFunctionCall~Info = NoInfo~
    <<type>> RFunctionCall
style RFunctionCall fill:#FAFAFA,stroke:#333
click RFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L39" ""
class RNamedFunctionCall~Info = NoInfo~
    <<interface>> RNamedFunctionCall
    RNamedFunctionCall : type
    RNamedFunctionCall : named
    RNamedFunctionCall : functionName
    RNamedFunctionCall : arguments
click RNamedFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L15" ""
    RNamedFunctionCall : lexeme [from Base]
    RNamedFunctionCall : info [from Base]
    RNamedFunctionCall : location [from Location]
class RUnnamedFunctionCall~Info = NoInfo~
    <<interface>> RUnnamedFunctionCall
    RUnnamedFunctionCall : type
    RUnnamedFunctionCall : named
    RUnnamedFunctionCall : calledFunction
    RUnnamedFunctionCall : infixSpecial
    RUnnamedFunctionCall : arguments
click RUnnamedFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L29" ""
    RUnnamedFunctionCall : lexeme [from Base]
    RUnnamedFunctionCall : info [from Base]
    RUnnamedFunctionCall : location [from Location]
class RParameter~Info = NoInfo~
    <<interface>> RParameter
    RParameter : type
    RParameter : name
    RParameter : special
    RParameter : defaultValue
click RParameter href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-parameter.ts#L8" ""
    RParameter : lexeme [from Base]
    RParameter : info [from Base]
    RParameter : location [from Location]
class RArgument~Info = NoInfo~
    <<interface>> RArgument
    RArgument : type
    RArgument : name
    RArgument : value
click RArgument href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-argument.ts#L8" ""
    RArgument : lexeme [from Base]
    RArgument : info [from Base]
    RArgument : location [from Location]
class ROther~Info~
    <<type>> ROther
style ROther fill:#FAFAFA,stroke:#333
click ROther href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L148" ""
class RComment~Info = NoInfo~
    <<interface>> RComment
    RComment : type
    RComment : content
click RComment href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L4" ""
    RComment : location [from Location]
class RLineDirective~Info = NoInfo~
    <<interface>> RLineDirective
    RLineDirective : type
    RLineDirective : line
    RLineDirective : file
click RLineDirective href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L4" ""
    RLineDirective : location [from Location]
class RConstructs~Info~
    <<type>> RConstructs
style RConstructs fill:#FAFAFA,stroke:#333
click RConstructs href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L138" ""
class RLoopConstructs~Info~
    <<type>> RLoopConstructs
style RLoopConstructs fill:#FAFAFA,stroke:#333
click RLoopConstructs href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L133" ""
class RForLoop~Info = NoInfo~
    <<interface>> RForLoop
    RForLoop : type
    RForLoop : variable
    RForLoop : vector
    RForLoop : body
click RForLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11" ""
    RForLoop : lexeme [from Base]
    RForLoop : info [from Base]
    RForLoop : location [from Location]
class RRepeatLoop~Info = NoInfo~
    <<interface>> RRepeatLoop
    RRepeatLoop : type
    RRepeatLoop : body
click RRepeatLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10" ""
    RRepeatLoop : lexeme [from Base]
    RRepeatLoop : info [from Base]
    RRepeatLoop : location [from Location]
class RWhileLoop~Info = NoInfo~
    <<interface>> RWhileLoop
    RWhileLoop : type
    RWhileLoop : condition
    RWhileLoop : body
click RWhileLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10" ""
    RWhileLoop : lexeme [from Base]
    RWhileLoop : info [from Base]
    RWhileLoop : location [from Location]
class RIfThenElse~Info = NoInfo~
    <<interface>> RIfThenElse
    RIfThenElse : type
    RIfThenElse : condition
    RIfThenElse : then
    RIfThenElse : otherwise
click RIfThenElse href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L5" ""
    RIfThenElse : lexeme [from Base]
    RIfThenElse : info [from Base]
    RIfThenElse : location [from Location]
class RNamedAccess~Info = NoInfo~
    <<interface>> RNamedAccess
    RNamedAccess : operator
    RNamedAccess : access
click RNamedAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L16" ""
class RAccessBase~Info = NoInfo~
    <<interface>> RAccessBase
    RAccessBase : type
    RAccessBase : accessed
    RAccessBase : operator
click RAccessBase href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L9" ""
    RAccessBase : lexeme [from Base]
    RAccessBase : info [from Base]
    RAccessBase : location [from Location]
class RIndexAccess~Info = NoInfo~
    <<interface>> RIndexAccess
    RIndexAccess : operator
    RIndexAccess : access
click RIndexAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L22" ""
class RUnaryOp~Info = NoInfo~
    <<interface>> RUnaryOp
    RUnaryOp : type
    RUnaryOp : operator
    RUnaryOp : operand
click RUnaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L4" ""
    RUnaryOp : lexeme [from Base]
    RUnaryOp : info [from Base]
    RUnaryOp : location [from Location]
class RBinaryOp~Info = NoInfo~
    <<interface>> RBinaryOp
    RBinaryOp : type
    RBinaryOp : operator
    RBinaryOp : lhs
    RBinaryOp : rhs
click RBinaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L4" ""
    RBinaryOp : lexeme [from Base]
    RBinaryOp : info [from Base]
    RBinaryOp : location [from Location]
class RSingleNode~Info~
    <<type>> RSingleNode
style RSingleNode fill:#FAFAFA,stroke:#333
click RSingleNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L129" ""
class RSymbol~Info = NoInfo, T extends string = string~
    <<interface>> RSymbol
    RSymbol : type
    RSymbol : content
click RSymbol href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L9" ""
    RSymbol : namespace [from Namespace]
    RSymbol : location [from Location]
class RConstant~Info~
    <<type>> RConstant
style RConstant fill:#FAFAFA,stroke:#333
click RConstant href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L124" ""
class RNumber~Info = NoInfo~
    <<interface>> RNumber
    RNumber : type
    RNumber : content
click RNumber href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-number.ts#L6" ""
    RNumber : location [from Location]
class RString~Info = NoInfo~
    <<interface>> RString
    RString : type
    RString : content
click RString href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L5" ""
    RString : location [from Location]
class RLogical~Info = NoInfo~
    <<interface>> RLogical
    RLogical : type
    RLogical : content
click RLogical href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L6" ""
    RLogical : location [from Location]
class RBreak~Info = NoInfo~
    <<interface>> RBreak
    RBreak : type
click RBreak href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L4" ""
    RBreak : location [from Location]
class RNext~Info = NoInfo~
    <<interface>> RNext
    RNext : type
click RNext href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L4" ""
    RNext : location [from Location]
class RPipe~Info = NoInfo~
    <<interface>> RPipe
    RPipe : type
    RPipe : lhs
    RPipe : rhs
click RPipe href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L4" ""
    RPipe : lexeme [from Base]
    RPipe : info [from Base]
    RPipe : location [from Location]
RExpressionList .. RNode
WithChildren <|-- RExpressionList
Partial <|-- RExpressionList
RFunctions .. RNode
RFunctionDefinition .. RFunctions
RFunctionCall .. RFunctions
RNamedFunctionCall .. RFunctionCall
RUnnamedFunctionCall .. RFunctionCall
RParameter .. RFunctions
RArgument .. RFunctions
ROther .. RNode
RComment .. ROther
RLineDirective .. ROther
RConstructs .. RNode
RLoopConstructs .. RConstructs
RForLoop .. RLoopConstructs
RRepeatLoop .. RLoopConstructs
RWhileLoop .. RLoopConstructs
RIfThenElse .. RConstructs
RNamedAccess .. RNode
RAccessBase <|-- RNamedAccess
RIndexAccess .. RNode
RAccessBase <|-- RIndexAccess
RUnaryOp .. RNode
RBinaryOp .. RNode
RSingleNode .. RNode
RComment .. RSingleNode
RSymbol .. RSingleNode
RConstant .. RSingleNode
RNumber .. RConstant
RString .. RConstant
RLogical .. RConstant
RSymbol .. RConstant
RBreak .. RSingleNode
RNext .. RSingleNode
RLineDirective .. RSingleNode
RPipe .. RNode
```




