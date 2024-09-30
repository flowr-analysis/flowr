_This document was generated from 'src/documentation/print-normalized-ast-wiki.ts' on 2024-09-30, 07:05:10 UTC presenting an overview of flowR's normalized ast (v2.0.25, using R v4.4.1)._

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

The analysis required _9.88 ms_ (including parsing) within the generation environment.

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

<details>

<summary style="color:gray">Complete Class Diagram</summary>

Every node is a link, which directly refers to the implementation in the source code.
Grayed-out parts are used for structuring the AST, grouping together related nodes.


```mermaid
classDiagram
direction RL
class RNode~Info = NoInfo~
    <<type>> RNode
style RNode fill:#FAFAFA,stroke:#333
click RNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L160" ""
class RExpressionList~Info = NoInfo~
    <<interface>> RExpressionList
    RExpressionList : type#58; RType.ExpressionList
    RExpressionList : grouping#58; #91;start#58; RSymbol#60;Info, string#62;, end#58; RSymbol#60;Info, string#62;#93;
click RExpressionList href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L5" ""
    RExpressionList : children#58; readonly Children#91;#93; [from WithChildren]
    RExpressionList : type#58; RType [from Base]
    RExpressionList : lexeme#58; LexemeType [from Base]
    RExpressionList : info#58; Info #38; Source [from Base]
class RFunctions~Info~
    <<type>> RFunctions
style RFunctions fill:#FAFAFA,stroke:#333
click RFunctions href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L143" ""
class RFunctionDefinition~Info = NoInfo~
    <<interface>> RFunctionDefinition
    RFunctionDefinition : type#58; RType.FunctionDefinition
    RFunctionDefinition : parameters#58; RParameter#60;Info#62;#91;#93;
    RFunctionDefinition : body#58; RNode#60;Info#62;
click RFunctionDefinition href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L5" ""
    RFunctionDefinition : type#58; RType [from Base]
    RFunctionDefinition : lexeme#58; LexemeType [from Base]
    RFunctionDefinition : info#58; Info #38; Source [from Base]
    RFunctionDefinition : location#58; SourceRange [from Location]
class RFunctionCall~Info = NoInfo~
    <<type>> RFunctionCall
style RFunctionCall fill:#FAFAFA,stroke:#333
click RFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L39" ""
class RNamedFunctionCall~Info = NoInfo~
    <<interface>> RNamedFunctionCall
    RNamedFunctionCall : type#58; RType.FunctionCall
    RNamedFunctionCall : named#58; true
    RNamedFunctionCall : functionName#58; RSymbol#60;Info, string#62;
    RNamedFunctionCall : arguments#58; readonly RFunctionArgument#60;Info#62;#91;#93;
click RNamedFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L15" "Calls of functions like #96;a()#96; and #96;foo(42, #34;hello#34;)#96;."
    RNamedFunctionCall : type#58; RType [from Base]
    RNamedFunctionCall : lexeme#58; LexemeType [from Base]
    RNamedFunctionCall : info#58; Info #38; Source [from Base]
    RNamedFunctionCall : location#58; SourceRange [from Location]
class RUnnamedFunctionCall~Info = NoInfo~
    <<interface>> RUnnamedFunctionCall
    RUnnamedFunctionCall : type#58; RType.FunctionCall
    RUnnamedFunctionCall : named#58; false
    RUnnamedFunctionCall : calledFunction#58; RNode#60;Info#62;
    RUnnamedFunctionCall : infixSpecial#58; boolean
    RUnnamedFunctionCall : arguments#58; readonly RFunctionArgument#60;Info#62;#91;#93;
click RUnnamedFunctionCall href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L29" "Direct calls of functions like #96;(function(x) #123; x #125;)(3)#96;."
    RUnnamedFunctionCall : type#58; RType [from Base]
    RUnnamedFunctionCall : lexeme#58; LexemeType [from Base]
    RUnnamedFunctionCall : info#58; Info #38; Source [from Base]
    RUnnamedFunctionCall : location#58; SourceRange [from Location]
class RParameter~Info = NoInfo~
    <<interface>> RParameter
    RParameter : type#58; RType.Parameter
    RParameter : name#58; RSymbol#60;Info, string#62;
    RParameter : special#58; boolean
    RParameter : defaultValue#58; RNode#60;Info#62;
click RParameter href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-parameter.ts#L8" "Represents a parameter of a function definition in R."
    RParameter : type#58; RType [from Base]
    RParameter : lexeme#58; LexemeType [from Base]
    RParameter : info#58; Info #38; Source [from Base]
    RParameter : location#58; SourceRange [from Location]
class RArgument~Info = NoInfo~
    <<interface>> RArgument
    RArgument : type#58; RType.Argument
    RArgument : name#58; RSymbol#60;Info, string#62;
    RArgument : value#58; RNode#60;Info#62;
click RArgument href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-argument.ts#L8" "Represents a named or unnamed argument of a function definition in R."
    RArgument : type#58; RType [from Base]
    RArgument : lexeme#58; LexemeType [from Base]
    RArgument : info#58; Info #38; Source [from Base]
    RArgument : location#58; SourceRange [from Location]
class ROther~Info~
    <<type>> ROther
style ROther fill:#FAFAFA,stroke:#333
click ROther href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L148" ""
class RComment~Info = NoInfo~
    <<interface>> RComment
    RComment : type#58; RType.Comment
    RComment : content#58; string
click RComment href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L4" ""
    RComment : location#58; SourceRange [from Location]
class RLineDirective~Info = NoInfo~
    <<interface>> RLineDirective
    RLineDirective : type#58; RType.LineDirective
    RLineDirective : line#58; number
    RLineDirective : file#58; string
click RLineDirective href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L4" ""
    RLineDirective : location#58; SourceRange [from Location]
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
    RForLoop : type#58; RType.ForLoop
    RForLoop : variable#58; RSymbol#60;Info, string#62;
    RForLoop : vector#58; RNode#60;Info#62;
    RForLoop : body#58; RExpressionList#60;Info#62;
click RForLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11" "#96;#96;#96;ts for(#60;variable#62; in #60;vector#62;) #60;body#62;
#96;#96;#96;"
    RForLoop : type#58; RType [from Base]
    RForLoop : lexeme#58; LexemeType [from Base]
    RForLoop : info#58; Info #38; Source [from Base]
    RForLoop : location#58; SourceRange [from Location]
class RRepeatLoop~Info = NoInfo~
    <<interface>> RRepeatLoop
    RRepeatLoop : type#58; RType.RepeatLoop
    RRepeatLoop : body#58; RExpressionList#60;Info#62;
click RRepeatLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10" "#96;#96;#96;ts repeat #60;body#62;
#96;#96;#96;"
    RRepeatLoop : type#58; RType [from Base]
    RRepeatLoop : lexeme#58; LexemeType [from Base]
    RRepeatLoop : info#58; Info #38; Source [from Base]
    RRepeatLoop : location#58; SourceRange [from Location]
class RWhileLoop~Info = NoInfo~
    <<interface>> RWhileLoop
    RWhileLoop : type#58; RType.WhileLoop
    RWhileLoop : condition#58; RNode#60;Info#62;
    RWhileLoop : body#58; RExpressionList#60;Info#62;
click RWhileLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10" "#96;#96;#96;ts while ( #60;condition#62; ) #60;body#62;
#96;#96;#96;"
    RWhileLoop : type#58; RType [from Base]
    RWhileLoop : lexeme#58; LexemeType [from Base]
    RWhileLoop : info#58; Info #38; Source [from Base]
    RWhileLoop : location#58; SourceRange [from Location]
class RIfThenElse~Info = NoInfo~
    <<interface>> RIfThenElse
    RIfThenElse : type#58; RType.IfThenElse
    RIfThenElse : condition#58; RNode#60;Info#62;
    RIfThenElse : then#58; RExpressionList#60;Info#62;
    RIfThenElse : otherwise#58; RExpressionList#60;Info#62;
click RIfThenElse href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L5" ""
    RIfThenElse : type#58; RType [from Base]
    RIfThenElse : lexeme#58; LexemeType [from Base]
    RIfThenElse : info#58; Info #38; Source [from Base]
    RIfThenElse : location#58; SourceRange [from Location]
class RNamedAccess~Info = NoInfo~
    <<interface>> RNamedAccess
    RNamedAccess : operator#58; #34;$#34; | #34;@#34;
    RNamedAccess : access#58; #91;RUnnamedArgument#60;Info#62;#93;
click RNamedAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L16" ""
class RAccessBase~Info = NoInfo~
    <<interface>> RAccessBase
    RAccessBase : type#58; RType.Access
    RAccessBase : accessed#58; RNode#60;Info#62;
    RAccessBase : operator#58; #34;#91;#34; | #34;#91;#91;#34; | #34;$#34; | #34;@#34;
click RAccessBase href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L9" "Represents an R Indexing operation with #96;$#96;, #96;@#96;, #96;#91;#91;#96;, or #96;#91;#96;."
    RAccessBase : type#58; RType [from Base]
    RAccessBase : lexeme#58; LexemeType [from Base]
    RAccessBase : info#58; Info #38; Source [from Base]
    RAccessBase : location#58; SourceRange [from Location]
class RIndexAccess~Info = NoInfo~
    <<interface>> RIndexAccess
    RIndexAccess : operator#58; #34;#91;#34; | #34;#91;#91;#34;
    RIndexAccess : access#58; readonly (RArgument#60;Info#62; | #34;#60;#62;#34;)#91;#93;
click RIndexAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L22" "access can be a number, a variable or an expression that resolves to one, a filter etc."
class RUnaryOp~Info = NoInfo~
    <<interface>> RUnaryOp
    RUnaryOp : type#58; RType.UnaryOp
    RUnaryOp : operator#58; string
    RUnaryOp : operand#58; RNode#60;Info#62;
click RUnaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L4" ""
    RUnaryOp : type#58; RType [from Base]
    RUnaryOp : lexeme#58; LexemeType [from Base]
    RUnaryOp : info#58; Info #38; Source [from Base]
    RUnaryOp : location#58; SourceRange [from Location]
class RBinaryOp~Info = NoInfo~
    <<interface>> RBinaryOp
    RBinaryOp : type#58; RType.BinaryOp
    RBinaryOp : operator#58; string
    RBinaryOp : lhs#58; RNode#60;Info#62;
    RBinaryOp : rhs#58; RNode#60;Info#62;
click RBinaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L4" ""
    RBinaryOp : type#58; RType [from Base]
    RBinaryOp : lexeme#58; LexemeType [from Base]
    RBinaryOp : info#58; Info #38; Source [from Base]
    RBinaryOp : location#58; SourceRange [from Location]
class RSingleNode~Info~
    <<type>> RSingleNode
style RSingleNode fill:#FAFAFA,stroke:#333
click RSingleNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L129" ""
class RSymbol~Info = NoInfo, T extends string = string~
    <<interface>> RSymbol
    RSymbol : type#58; RType.Symbol
    RSymbol : content#58; T
click RSymbol href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L9" ""
    RSymbol : namespace#58; string [from Namespace]
    RSymbol : location#58; SourceRange [from Location]
class RConstant~Info~
    <<type>> RConstant
style RConstant fill:#FAFAFA,stroke:#333
click RConstant href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L124" ""
class RNumber~Info = NoInfo~
    <<interface>> RNumber
    RNumber : type#58; RType.Number
    RNumber : content#58; RNumberValue
click RNumber href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-number.ts#L6" "includes numeric, integer, and complex"
    RNumber : location#58; SourceRange [from Location]
class RString~Info = NoInfo~
    <<interface>> RString
    RString : type#58; RType.String
    RString : content#58; RStringValue
click RString href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L5" ""
    RString : location#58; SourceRange [from Location]
class RLogical~Info = NoInfo~
    <<interface>> RLogical
    RLogical : type#58; RType.Logical
    RLogical : content#58; boolean
click RLogical href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L6" ""
    RLogical : location#58; SourceRange [from Location]
class RBreak~Info = NoInfo~
    <<interface>> RBreak
    RBreak : type#58; RType.Break
click RBreak href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L4" ""
    RBreak : location#58; SourceRange [from Location]
class RNext~Info = NoInfo~
    <<interface>> RNext
    RNext : type#58; RType.Next
click RNext href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L4" ""
    RNext : location#58; SourceRange [from Location]
class RPipe~Info = NoInfo~
    <<interface>> RPipe
    RPipe : type#58; RType.Pipe
    RPipe : lhs#58; RNode#60;Info#62;
    RPipe : rhs#58; RNode#60;Info#62;
click RPipe href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L4" ""
    RPipe : type#58; RType [from Base]
    RPipe : lexeme#58; LexemeType [from Base]
    RPipe : info#58; Info #38; Source [from Base]
    RPipe : location#58; SourceRange [from Location]
RExpressionList .. RNode
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


_The generation of the class diagram took required 694.99 ms._
</details>

Node types are controlled by the `RType` enum (see [`./src/r-bridge/lang-4.x/ast/model/type.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/r-bridge/lang-4.x/ast/model/type.ts)), 
which is used to distinguish between different types of nodes.
Additionally, every AST node is generic with respect to the `Info` type which allows for arbitrary decorations (e.g., parent inforamtion or dataflow constraints).
Most notably, the `info` field holds the `id` of the node, which is used to reference the node in the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki//Dataflow%20Graph).


