_This document was generated from 'src/documentation/print-normalized-ast-wiki.ts' on 2024-11-19, 16:10:08 UTC presenting an overview of flowR's normalized ast (v2.1.7, using R v4.4.0)._

_flowR_ produces a normalized version of R's abstract syntax tree (AST), 
offering the following benefits:
 
1. abstract away from intricacies of the R parser
2. provide a version-independent representation of the program
3. decorate the AST with additional information, e.g., parent relations and nesting information

In general, the mapping should be rather intuitive and focused primarily on the
syntactic structure of the program.
Consider the following example which shows the normalized AST of the code


```r
x <- 2 * 3 + 1
```


Each node in the AST contains the type, the id, and the lexeme (if applicable).
Each edge is labeled with the type of the parent-child relationship (the "role").




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

The analysis required _8.86 ms_ (including parsing) within the generation environment.

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



&nbsp;

> [!TIP]
> If you want to investigate the normalized AST, 
> you can either use the [Visual Studio Code extension](https://github.com/flowr-analysis/vscode-flowr) or the <span title="Description (Repl Command, starred version): Returns the URL to mermaid.live; Base Command: Get mermaid code for the normalized AST of R code, start with 'file://' to indicate a file (aliases: :n*)">`:normalize*`</span> 
> command in the REPL (see the [Interface wiki page](https://github.com/flowr-analysis/flowr/wiki//Interface) for more information). 

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
style RNode opacity:.35,fill:#FAFAFA
click RNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L163" "The #96;RNode#96; type is the union of all possible nodes in the R#45;ast. It should be used whenever you either not care what kind of node you are dealing with or if you want to handle all possible nodes. #60;p#62;  All other subtypes (like; #60;code#62;RLoopConstructs#60;/code#62;; ) listed above can be used to restrict the kind of node. They do not have to be exclusive, some nodes can appear in multiple subtypes."
class RExpressionList~Info = NoInfo~
    <<interface>> RExpressionList
    RExpressionList : type#58; RType.ExpressionList
    RExpressionList : grouping#58; #91;start#58; RSymbol#60;Info, string#62;, end#58; RSymbol#60;Info, string#62;#93;
click RExpressionList href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L9" "Holds a list of expressions (and hence may be the root of an AST, summarizing all expressions in a file). The #96;grouping#96; property holds information on if the expression list is structural or created by a wrapper like #96;#123;#125;#96; or #96;()#96;."
    RExpressionList : children#58; readonly Children#91;#93; [from WithChildren]
    RExpressionList : type#58; RType [from Base]
    RExpressionList : lexeme#58; LexemeType [from Base]
    RExpressionList : info#58; Info #38; Source [from Base]
class RFunctions~Info~
    <<type>> RFunctions
style RFunctions opacity:.35,fill:#FAFAFA
click RFunctions href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L146" "This subtype of; #60;code#62;RNode#60;/code#62;; represents all types related to functions (calls and definitions) in the normalized AST."
class RFunctionDefinition~Info = NoInfo~
    <<interface>> RFunctionDefinition
    RFunctionDefinition : type#58; RType.FunctionDefinition
    RFunctionDefinition : parameters#58; RParameter#60;Info#62;#91;#93;
    RFunctionDefinition : body#58; RNode#60;Info#62;
click RFunctionDefinition href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L14" "#96;#96;#96;r function(#60;parameters#62;) #60;body#62; #96;#96;#96; or#58; #96;#96;#96;r #92;(#60;parameters#62;) #60;body#62; #96;#96;#96;"
    RFunctionDefinition : type#58; RType [from Base]
    RFunctionDefinition : lexeme#58; LexemeType [from Base]
    RFunctionDefinition : info#58; Info #38; Source [from Base]
    RFunctionDefinition : location#58; SourceRange [from Location]
class RFunctionCall~Info = NoInfo~
    <<type>> RFunctionCall
style RFunctionCall opacity:.35,fill:#FAFAFA
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
style ROther opacity:.35,fill:#FAFAFA
click ROther href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L151" "This subtype of; #60;code#62;RNode#60;/code#62;; represents all types of otherwise hard to categorize nodes in the normalized AST. At the moment these are the comment#45;like nodes."
class RComment~Info = NoInfo~
    <<interface>> RComment
    RComment : type#58; RType.Comment
    RComment : content#58; string
click RComment href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9" "#96;#96;#96;r # I am a line comment #96;#96;#96;"
    RComment : location#58; SourceRange [from Location]
class RLineDirective~Info = NoInfo~
    <<interface>> RLineDirective
    RLineDirective : type#58; RType.LineDirective
    RLineDirective : line#58; number
    RLineDirective : file#58; string
click RLineDirective href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7" "Special comment to signal line mappings (e.g., in generated code) to the interpreter."
    RLineDirective : location#58; SourceRange [from Location]
class RConstructs~Info~
    <<type>> RConstructs
style RConstructs opacity:.35,fill:#FAFAFA
click RConstructs href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L141" "As an extension to; #60;code#62;RLoopConstructs#60;/code#62;; , this subtype of; #60;code#62;RNode#60;/code#62;; includes the; #60;code#62;RIfThenElse#60;/code#62;; construct as well."
class RLoopConstructs~Info~
    <<type>> RLoopConstructs
style RLoopConstructs opacity:.35,fill:#FAFAFA
click RLoopConstructs href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L136" "This subtype of; #60;code#62;RNode#60;/code#62;; represents all looping constructs in the normalized AST."
class RForLoop~Info = NoInfo~
    <<interface>> RForLoop
    RForLoop : type#58; RType.ForLoop
    RForLoop : variable#58; RSymbol#60;Info, string#62;
    RForLoop : vector#58; RNode#60;Info#62;
    RForLoop : body#58; RExpressionList#60;Info#62;
click RForLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11" "#96;#96;#96;r for(#60;variable#62; in #60;vector#62;) #60;body#62; #96;#96;#96;"
    RForLoop : type#58; RType [from Base]
    RForLoop : lexeme#58; LexemeType [from Base]
    RForLoop : info#58; Info #38; Source [from Base]
    RForLoop : location#58; SourceRange [from Location]
class RRepeatLoop~Info = NoInfo~
    <<interface>> RRepeatLoop
    RRepeatLoop : type#58; RType.RepeatLoop
    RRepeatLoop : body#58; RExpressionList#60;Info#62;
click RRepeatLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10" "#96;#96;#96;r repeat #60;body#62; #96;#96;#96;"
    RRepeatLoop : type#58; RType [from Base]
    RRepeatLoop : lexeme#58; LexemeType [from Base]
    RRepeatLoop : info#58; Info #38; Source [from Base]
    RRepeatLoop : location#58; SourceRange [from Location]
class RWhileLoop~Info = NoInfo~
    <<interface>> RWhileLoop
    RWhileLoop : type#58; RType.WhileLoop
    RWhileLoop : condition#58; RNode#60;Info#62;
    RWhileLoop : body#58; RExpressionList#60;Info#62;
click RWhileLoop href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10" "#96;#96;#96;r while(#60;condition#62;) #60;body#62; #96;#96;#96;"
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
click RIfThenElse href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L10" "#96;#96;#96;r if(#60;condition#62;) #60;then#62; #91;else #60;otherwise#62;#93; #96;#96;#96;"
    RIfThenElse : type#58; RType [from Base]
    RIfThenElse : lexeme#58; LexemeType [from Base]
    RIfThenElse : info#58; Info #38; Source [from Base]
    RIfThenElse : location#58; SourceRange [from Location]
class RNamedAccess~Info = NoInfo~
    <<interface>> RNamedAccess
    RNamedAccess : operator#58; #34;$#34; | #34;@#34;
    RNamedAccess : access#58; #91;RUnnamedArgument#60;Info#62;#93;
click RNamedAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L19" "Represents an R named access operation with #96;$#96; or #96;@#96;, the field is a string."
    RNamedAccess : type#58; RType.Access [from RAccessBase]
    RNamedAccess : accessed#58; RNode#60;Info#62; [from RAccessBase]
    RNamedAccess : operator#58; #34;#91;#34; | #34;#91;#91;#34; | #34;$#34; | #34;@#34; [from RAccessBase]
class RIndexAccess~Info = NoInfo~
    <<interface>> RIndexAccess
    RIndexAccess : operator#58; #34;#91;#34; | #34;#91;#91;#34;
    RIndexAccess : access#58; readonly (RArgument#60;Info#62; | #34;#60;#62;#34;)#91;#93;
click RIndexAccess href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L25" "access can be a number, a variable or an expression that resolves to one, a filter etc."
    RIndexAccess : type#58; RType.Access [from RAccessBase]
    RIndexAccess : accessed#58; RNode#60;Info#62; [from RAccessBase]
    RIndexAccess : operator#58; #34;#91;#34; | #34;#91;#91;#34; | #34;$#34; | #34;@#34; [from RAccessBase]
class RUnaryOp~Info = NoInfo~
    <<interface>> RUnaryOp
    RUnaryOp : type#58; RType.UnaryOp
    RUnaryOp : operator#58; string
    RUnaryOp : operand#58; RNode#60;Info#62;
click RUnaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L7" "Unary operations like #96;#43;#96; and #96;#45;#96;"
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
click RBinaryOp href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L7" "Operators like #96;#43;#96;, #96;==#96;, #96;#38;#38;#96;, etc."
    RBinaryOp : type#58; RType [from Base]
    RBinaryOp : lexeme#58; LexemeType [from Base]
    RBinaryOp : info#58; Info #38; Source [from Base]
    RBinaryOp : location#58; SourceRange [from Location]
class RSingleNode~Info~
    <<type>> RSingleNode
style RSingleNode opacity:.35,fill:#FAFAFA
click RSingleNode href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L132" "This subtype of; #60;code#62;RNode#60;/code#62;; represents all types of; #60;code#62;Leaf#60;/code#62;; nodes in the normalized AST."
class RSymbol~Info = NoInfo, T extends string = string~
    <<interface>> RSymbol
    RSymbol : type#58; RType.Symbol
    RSymbol : content#58; T
click RSymbol href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L12" "Represents identifiers (variables)."
    RSymbol : namespace#58; string [from Namespace]
    RSymbol : location#58; SourceRange [from Location]
class RConstant~Info~
    <<type>> RConstant
style RConstant opacity:.35,fill:#FAFAFA
click RConstant href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L127" "This subtype of; #60;code#62;RNode#60;/code#62;; represents all types of constants represented in the normalized AST."
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
click RString href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L8" "Represents a string like #96;#34;hello#34;#96;, including raw strings like #96;r#34;(hello)#34;#96;."
    RString : location#58; SourceRange [from Location]
class RLogical~Info = NoInfo~
    <<interface>> RLogical
    RLogical : type#58; RType.Logical
    RLogical : content#58; boolean
click RLogical href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L9" "Represents logical values (#96;TRUE#96; or #96;FALSE#96;)."
    RLogical : location#58; SourceRange [from Location]
class RBreak~Info = NoInfo~
    <<interface>> RBreak
    RBreak : type#58; RType.Break
click RBreak href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L7" "A #96;break#96; statement."
    RBreak : location#58; SourceRange [from Location]
class RNext~Info = NoInfo~
    <<interface>> RNext
    RNext : type#58; RType.Next
click RNext href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L7" "A #96;next#96; statement."
    RNext : location#58; SourceRange [from Location]
class RPipe~Info = NoInfo~
    <<interface>> RPipe
    RPipe : type#58; RType.Pipe
    RPipe : lhs#58; RNode#60;Info#62;
    RPipe : rhs#58; RNode#60;Info#62;
click RPipe href "https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L7" "Variant of the binary operator, specifically for the new, built#45;in pipe operator."
    RPipe : type#58; RType [from Base]
    RPipe : lexeme#58; LexemeType [from Base]
    RPipe : info#58; Info #38; Source [from Base]
    RPipe : location#58; SourceRange [from Location]
RExpressionList .. RNode
Info .. RNode
RFunctions .. RNode
RFunctionDefinition .. RFunctions
Info .. RFunctions
RFunctionCall .. RFunctions
RNamedFunctionCall .. RFunctionCall
Info .. RFunctionCall
RUnnamedFunctionCall .. RFunctionCall
Info .. RFunctionCall
Info .. RFunctions
RParameter .. RFunctions
Info .. RFunctions
RArgument .. RFunctions
Info .. RFunctions
Info .. RNode
ROther .. RNode
RComment .. ROther
Info .. ROther
RLineDirective .. ROther
Info .. ROther
Info .. RNode
RConstructs .. RNode
RLoopConstructs .. RConstructs
RForLoop .. RLoopConstructs
Info .. RLoopConstructs
RRepeatLoop .. RLoopConstructs
Info .. RLoopConstructs
RWhileLoop .. RLoopConstructs
Info .. RLoopConstructs
Info .. RConstructs
RIfThenElse .. RConstructs
Info .. RConstructs
Info .. RNode
RNamedAccess .. RNode
Info .. RNode
RIndexAccess .. RNode
Info .. RNode
RUnaryOp .. RNode
Info .. RNode
RBinaryOp .. RNode
Info .. RNode
RSingleNode .. RNode
RComment .. RSingleNode
Info .. RSingleNode
RSymbol .. RSingleNode
Info .. RSingleNode
RConstant .. RSingleNode
RNumber .. RConstant
Info .. RConstant
RString .. RConstant
Info .. RConstant
RLogical .. RConstant
Info .. RConstant
Info .. RSingleNode
RBreak .. RSingleNode
Info .. RSingleNode
RNext .. RSingleNode
Info .. RSingleNode
RLineDirective .. RSingleNode
Info .. RSingleNode
Info .. RNode
RPipe .. RNode
Info .. RNode
```


_The generation of the class diagram required 813.93 ms._
</details>

Node types are controlled by the `RType` enum (see [`./src/r-bridge/lang-4.x/ast/model/type.ts`](https://github.com/flowr-analysis/flowr/tree/main/./src/r-bridge/lang-4.x/ast/model/type.ts)), 
which is used to distinguish between different types of nodes.
Additionally, every AST node is generic with respect to the `Info` type which allows for arbitrary decorations (e.g., parent inforamtion or dataflow constraints).
Most notably, the `info` field holds the `id` of the node, which is used to reference the node in the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki//Dataflow%20Graph).

In summary, we have the following types:

 * [RNode](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L163)   
   The `RNode` type is the union of all possible nodes in the R-ast.
   It should be used whenever you either not care what kind of
   node you are dealing with or if you want to handle all possible nodes.
   <p>
    All other subtypes (like
   <code>RLoopConstructs</code>
   ) listed above
   can be used to restrict the kind of node. They do not have to be
   exclusive, some nodes can appear in multiple subtypes.
   <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L163">./src/r-bridge/lang-4.x/ast/model/model.ts#L163</a></summary>
   
   
   ```ts
   /**
    * The `RNode` type is the union of all possible nodes in the R-ast.
    * It should be used whenever you either not care what kind of
    * node you are dealing with or if you want to handle all possible nodes.
    * <p>
    *
    * All other subtypes (like {@link RLoopConstructs}) listed above
    * can be used to restrict the kind of node. They do not have to be
    * exclusive, some nodes can appear in multiple subtypes.
    */
   export type RNode<Info = NoInfo>  = RExpressionList<Info> | RFunctions<Info>
       | ROther<Info> | RConstructs<Info> | RNamedAccess<Info> | RIndexAccess<Info>
       | RUnaryOp<Info> | RBinaryOp<Info> | RSingleNode<Info>  | RPipe<Info>
   ```
   
   
   </details>
   
   * **[RExpressionList](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L9)**   
     Holds a list of expressions (and hence may be the root of an AST, summarizing all expressions in a file).
     The `grouping` property holds information on if the expression list is structural or created by a wrapper like `{}` or `()`.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L9">./src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list.ts#L9</a></summary>
     
     
     ```ts
     /**
      * Holds a list of expressions (and hence may be the root of an AST, summarizing all expressions in a file).
      * The `grouping` property holds information on if the expression list is structural or created by a wrapper like `{}` or `()`.
      */
     export interface RExpressionList<Info = NoInfo> extends WithChildren<Info, RNode<Info>>, Base<Info, string | undefined>, Partial<Location> {
         readonly type:     RType.ExpressionList;
         /** encodes wrappers like `{}` or `()` */
         readonly grouping: undefined | [start: RSymbol<Info>, end: RSymbol<Info>]
     }
     ```
     
     
     </details>
     

   * [RFunctions](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L146)   
     This subtype of
     <code>RNode</code>
     represents all types related to functions
     (calls and definitions) in the normalized AST.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L146">./src/r-bridge/lang-4.x/ast/model/model.ts#L146</a></summary>
     
     
     ```ts
     /**
      * This subtype of {@link RNode} represents all types related to functions
      * (calls and definitions) in the normalized AST.
      */
     export type RFunctions<Info>      = RFunctionDefinition<Info> | RFunctionCall<Info> | RParameter<Info> | RArgument<Info>
     ```
     
     
     </details>
     
     * **[RFunctionDefinition](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L14)**   
       ```r
       function(<parameters>) <body>
       ```
       or:
       ```r
       \(<parameters>) <body>
       ```
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L14">./src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition.ts#L14</a></summary>
       
       
       ```ts
       /**
        * ```r
        * function(<parameters>) <body>
        * ```
        * or:
        * ```r
        * \(<parameters>) <body>
        * ```
        */
       export interface RFunctionDefinition<Info = NoInfo> extends Base<Info>, Location {
           readonly type: RType.FunctionDefinition;
           /** the R formals, to our knowledge, they must be unique */
           parameters:    RParameter<Info>[];
           body:          RNode<Info>;
       }
       ```
       
       
       </details>
       

     * [RFunctionCall](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L39)   
       
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L39">./src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L39</a></summary>
       
       
       ```ts
       export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;
       ```
       
       
       </details>
       
       * **[RNamedFunctionCall](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L15)**   
         Calls of functions like `a()` and `foo(42, "hello")`.
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L15">./src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L15</a></summary>
         
         
         ```ts
         /**
          * Calls of functions like `a()` and `foo(42, "hello")`.
          *
          * @see RUnnamedFunctionCall
          */
         export interface RNamedFunctionCall<Info = NoInfo> extends Base<Info>, Location {
             readonly type:      RType.FunctionCall;
             readonly named:     true;
             functionName:       RSymbol<Info>;
             /** arguments can be empty, for example when calling as `a(1, ,3)` */
             readonly arguments: readonly RFunctionArgument<Info>[];
         }
         ```
         
         
         </details>
         

       * **[RUnnamedFunctionCall](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L29)**   
         Direct calls of functions like `(function(x) { x })(3)`.
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L29">./src/r-bridge/lang-4.x/ast/model/nodes/r-function-call.ts#L29</a></summary>
         
         
         ```ts
         /**
          * Direct calls of functions like `(function(x) { x })(3)`.
          *
          * @see RNamedFunctionCall
          */
         export interface RUnnamedFunctionCall<Info = NoInfo> extends Base<Info>, Location {
             readonly type:      RType.FunctionCall;
             readonly named:     false | undefined;
             calledFunction:     RNode<Info>; /* can be either a function definition or another call that returns a function etc. */
             /** marks function calls like `3 %xx% 4` which have been written in special infix notation; deprecated in v2 */
             infixSpecial?:      boolean;
             /** arguments can be undefined, for example when calling as `a(1, ,3)` */
             readonly arguments: readonly RFunctionArgument<Info>[];
         }
         ```
         
         
         </details>
         


     * **[RParameter](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-parameter.ts#L8)**   
       Represents a parameter of a function definition in R.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-parameter.ts#L8">./src/r-bridge/lang-4.x/ast/model/nodes/r-parameter.ts#L8</a></summary>
       
       
       ```ts
       /**
        * Represents a parameter of a function definition in R.
        */
       export interface RParameter<Info = NoInfo> extends Base<Info>, Location {
           readonly type: RType.Parameter;
           /* the name is represented as a symbol to additionally get location information */
           name:          RSymbol<Info>;
           /** is it the special ... parameter? */
           special:       boolean;
           defaultValue:  RNode<Info> | undefined;
       }
       ```
       
       
       </details>
       

     * **[RArgument](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-argument.ts#L8)**   
       Represents a named or unnamed argument of a function definition in R.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-argument.ts#L8">./src/r-bridge/lang-4.x/ast/model/nodes/r-argument.ts#L8</a></summary>
       
       
       ```ts
       /**
        * Represents a named or unnamed argument of a function definition in R.
        */
       export interface RArgument<Info = NoInfo> extends Base<Info>, Location {
           readonly type: RType.Argument;
           /* the name is represented as a symbol to additionally get location information */
           name:          RSymbol<Info> | undefined;
           value:         RNode<Info> | undefined;
       }
       ```
       
       
       </details>
       


   * [ROther](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L151)   
     This subtype of
     <code>RNode</code>
     represents all types of otherwise hard to categorize
     nodes in the normalized AST. At the moment these are the comment-like nodes.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L151">./src/r-bridge/lang-4.x/ast/model/model.ts#L151</a></summary>
     
     
     ```ts
     /**
      * This subtype of {@link RNode} represents all types of otherwise hard to categorize
      * nodes in the normalized AST. At the moment these are the comment-like nodes.
      */
     export type ROther<Info>          = RComment<Info> | RLineDirective<Info>
     ```
     
     
     </details>
     
     * **[RComment](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9)**   
       ```r
       # I am a line comment
       ```
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9">./src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9</a></summary>
       
       
       ```ts
       /**
        * ```r
        * # I am a line comment
        * ```
        */
       export interface RComment<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.Comment;
           content:       string;
       }
       ```
       
       
       </details>
       

     * **[RLineDirective](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7)**   
       Special comment to signal line mappings (e.g., in generated code) to the interpreter.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7</a></summary>
       
       
       ```ts
       /**
        * Special comment to signal line mappings (e.g., in generated code) to the interpreter.
        */
       export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.LineDirective;
           line:          number;
           file:          string;
       }
       ```
       
       
       </details>
       


   * [RConstructs](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L141)   
     As an extension to
     <code>RLoopConstructs</code>
     , this subtype of
     <code>RNode</code>
     includes
     the
     <code>RIfThenElse</code>
     construct as well.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L141">./src/r-bridge/lang-4.x/ast/model/model.ts#L141</a></summary>
     
     
     ```ts
     /**
      * As an extension to {@link RLoopConstructs}, this subtype of {@link RNode} includes
      * the {@link RIfThenElse} construct as well.
      */
     export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>
     ```
     
     
     </details>
     
     * [RLoopConstructs](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L136)   
       This subtype of
       <code>RNode</code>
       represents all looping constructs in the normalized AST.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L136">./src/r-bridge/lang-4.x/ast/model/model.ts#L136</a></summary>
       
       
       ```ts
       /**
        * This subtype of {@link RNode} represents all looping constructs in the normalized AST.
        */
       export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>
       ```
       
       
       </details>
       
       * **[RForLoop](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11)**   
         ```r
         for(<variable> in <vector>) <body>
         ```
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11">./src/r-bridge/lang-4.x/ast/model/nodes/r-for-loop.ts#L11</a></summary>
         
         
         ```ts
         /**
          * ```r
          * for(<variable> in <vector>) <body>
          * ```
          */
         export interface RForLoop<Info = NoInfo> extends Base<Info>, Location {
             readonly type: RType.ForLoop
             /** variable used in for-loop: <p> `for(<variable> in ...) ...`*/
             variable:      RSymbol<Info>
             /** vector used in for-loop: <p> `for(... in <vector>) ...`*/
             vector:        RNode<Info>
             /** body used in for-loop: <p> `for(... in ...) <body>`*/
             body:          RExpressionList<Info>
         }
         ```
         
         
         </details>
         

       * **[RRepeatLoop](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10)**   
         ```r
         repeat <body>
         ```
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10">./src/r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop.ts#L10</a></summary>
         
         
         ```ts
         /**
          * ```r
          * repeat <body>
          * ```
          */
         export interface RRepeatLoop<Info = NoInfo> extends Base<Info>, Location {
             readonly type: RType.RepeatLoop
             body:          RExpressionList<Info>
         }
         ```
         
         
         </details>
         

       * **[RWhileLoop](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10)**   
         ```r
         while(<condition>) <body>
         ```
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10">./src/r-bridge/lang-4.x/ast/model/nodes/r-while-loop.ts#L10</a></summary>
         
         
         ```ts
         /**
          * ```r
          * while(<condition>) <body>
          * ```
          */
         export interface RWhileLoop<Info = NoInfo> extends Base<Info>, Location {
             readonly type: RType.WhileLoop
             condition:     RNode<Info>
             body:          RExpressionList<Info>
         }
         ```
         
         
         </details>
         


     * **[RIfThenElse](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L10)**   
       ```r
       if(<condition>) <then> [else <otherwise>]
       ```
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L10">./src/r-bridge/lang-4.x/ast/model/nodes/r-if-then-else.ts#L10</a></summary>
       
       
       ```ts
       /**
        * ```r
        * if(<condition>) <then> [else <otherwise>]
        * ```
        */
       export interface RIfThenElse<Info = NoInfo> extends Base<Info>, Location {
           readonly type: RType.IfThenElse;
           condition:     RNode<Info>;
           then:          RExpressionList<Info>;
           otherwise?:    RExpressionList<Info>;
       }
       ```
       
       
       </details>
       


   * **[RNamedAccess](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L19)**   
     Represents an R named access operation with `$` or `@`, the field is a string.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L19">./src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L19</a></summary>
     
     
     ```ts
     /**
      * Represents an R named access operation with `$` or `@`, the field is a string.
      */
     export interface RNamedAccess<Info = NoInfo> extends RAccessBase<Info> {
         operator: '$' | '@';
         access:   [RUnnamedArgument<Info>];
     }
     ```
     
     
     </details>
     

   * **[RIndexAccess](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L25)**   
     access can be a number, a variable or an expression that resolves to one, a filter etc.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L25">./src/r-bridge/lang-4.x/ast/model/nodes/r-access.ts#L25</a></summary>
     
     
     ```ts
     /** access can be a number, a variable or an expression that resolves to one, a filter etc. */
     export interface RIndexAccess<Info = NoInfo> extends RAccessBase<Info> {
         operator: '[' | '[[';
         /** is null if the access is empty, e.g. `a[,3]` */
         access:   readonly (RArgument<Info> | typeof EmptyArgument)[]
     }
     ```
     
     
     </details>
     

   * **[RUnaryOp](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L7)**   
     Unary operations like `+` and `-`
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-unary-op.ts#L7</a></summary>
     
     
     ```ts
     /**
      * Unary operations like `+` and `-`
      */
     export interface RUnaryOp<Info = NoInfo> extends Base<Info>, Location {
         readonly type: RType.UnaryOp;
         operator:      string;
         operand:       RNode<Info>;
     }
     ```
     
     
     </details>
     

   * **[RBinaryOp](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L7)**   
     Operators like `+`, `==`, `&&`, etc.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op.ts#L7</a></summary>
     
     
     ```ts
     /**
      * Operators like `+`, `==`, `&&`, etc.
      */
     export interface RBinaryOp<Info = NoInfo> extends Base<Info>, Location {
         readonly type: RType.BinaryOp;
         operator:      string;
         lhs:           RNode<Info>;
         rhs:           RNode<Info>;
     }
     ```
     
     
     </details>
     

   * [RSingleNode](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L132)   
     This subtype of
     <code>RNode</code>
     represents all types of
     <code>Leaf</code>
     nodes in the
     normalized AST.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L132">./src/r-bridge/lang-4.x/ast/model/model.ts#L132</a></summary>
     
     
     ```ts
     /**
      * This subtype of {@link RNode} represents all types of {@link Leaf} nodes in the
      * normalized AST.
      */
     export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info> | RBreak<Info> | RNext<Info> | RLineDirective<Info>
     ```
     
     
     </details>
     
     * **[RComment](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9)**   
       ```r
       # I am a line comment
       ```
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9">./src/r-bridge/lang-4.x/ast/model/nodes/r-comment.ts#L9</a></summary>
       
       
       ```ts
       /**
        * ```r
        * # I am a line comment
        * ```
        */
       export interface RComment<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.Comment;
           content:       string;
       }
       ```
       
       
       </details>
       

     * **[RSymbol](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L12)**   
       Represents identifiers (variables).
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L12">./src/r-bridge/lang-4.x/ast/model/nodes/r-symbol.ts#L12</a></summary>
       
       
       ```ts
       /**
        * Represents identifiers (variables).
        */
       export interface RSymbol<Info = NoInfo, T extends string = string> extends Leaf<Info>, Namespace, Location {
           readonly type: RType.Symbol;
           content:       T;
       }
       ```
       
       
       </details>
       

     * [RConstant](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L127)   
       This subtype of
       <code>RNode</code>
       represents all types of constants
       represented in the normalized AST.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/model.ts#L127">./src/r-bridge/lang-4.x/ast/model/model.ts#L127</a></summary>
       
       
       ```ts
       /**
        * This subtype of {@link RNode} represents all types of constants
        * represented in the normalized AST.
        */
       export type RConstant<Info>       = RNumber<Info> | RString<Info> | RLogical<Info>
       ```
       
       
       </details>
       
       * **[RNumber](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-number.ts#L6)**   
         includes numeric, integer, and complex
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-number.ts#L6">./src/r-bridge/lang-4.x/ast/model/nodes/r-number.ts#L6</a></summary>
         
         
         ```ts
         /** includes numeric, integer, and complex */
         export interface RNumber<Info = NoInfo> extends Leaf<Info>, Location {
             readonly type: RType.Number
             content:       RNumberValue
         }
         ```
         
         
         </details>
         

       * **[RString](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L8)**   
         Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L8">./src/r-bridge/lang-4.x/ast/model/nodes/r-string.ts#L8</a></summary>
         
         
         ```ts
         /**
          * Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
          */
         export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
             readonly type: RType.String;
             content:       RStringValue;
         }
         ```
         
         
         </details>
         

       * **[RLogical](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L9)**   
         Represents logical values (`TRUE` or `FALSE`).
         <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L9">./src/r-bridge/lang-4.x/ast/model/nodes/r-logical.ts#L9</a></summary>
         
         
         ```ts
         /**
          * Represents logical values (`TRUE` or `FALSE`).
          */
         export interface RLogical<Info = NoInfo> extends Leaf<Info>, Location {
             readonly type: RType.Logical
             content:       RLogicalValue
         }
         ```
         
         
         </details>
         


     * **[RBreak](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L7)**   
       A `break` statement.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-break.ts#L7</a></summary>
       
       
       ```ts
       /**
        * A `break` statement.
        */
       export interface RBreak<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.Break;
       }
       ```
       
       
       </details>
       

     * **[RNext](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L7)**   
       A `next` statement.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-next.ts#L7</a></summary>
       
       
       ```ts
       /**
        * A `next` statement.
        */
       export interface RNext<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.Next;
       }
       ```
       
       
       </details>
       

     * **[RLineDirective](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7)**   
       Special comment to signal line mappings (e.g., in generated code) to the interpreter.
       <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-line-directive.ts#L7</a></summary>
       
       
       ```ts
       /**
        * Special comment to signal line mappings (e.g., in generated code) to the interpreter.
        */
       export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
           readonly type: RType.LineDirective;
           line:          number;
           file:          string;
       }
       ```
       
       
       </details>
       


   * **[RPipe](https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L7)**   
     Variant of the binary operator, specifically for the new, built-in pipe operator.
     <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L7">./src/r-bridge/lang-4.x/ast/model/nodes/r-pipe.ts#L7</a></summary>
     
     
     ```ts
     /**
      * Variant of the binary operator, specifically for the new, built-in pipe operator.
      */
     export interface RPipe<Info = NoInfo> extends Base<Info>, Location {
         readonly type: RType.Pipe;
         readonly lhs:  RNode<Info>;
         readonly rhs:  RNode<Info>;
     }
     ```
     
     
     </details>
     


With this, the example file produced the following AST (shown from left to right for space reasons):




```mermaid
flowchart LR
    n53(["RExpressionList (53)
 "])
    n2(["RBinaryOp (2)
#60;#45;"])
    n53 -->|"expr-list-child-0"| n2
    n0(["RSymbol (0)
sum"])
    n2 -->|"binop-lhs"| n0
    n1(["RNumber (1)
0"])
    n2 -->|"binop-rhs"| n1
    n5(["RBinaryOp (5)
#60;#45;"])
    n53 -->|"expr-list-child-1"| n5
    n3(["RSymbol (3)
product"])
    n5 -->|"binop-lhs"| n3
    n4(["RNumber (4)
1"])
    n5 -->|"binop-rhs"| n4
    n8(["RBinaryOp (8)
#60;#45;"])
    n53 -->|"expr-list-child-2"| n8
    n6(["RSymbol (6)
w"])
    n8 -->|"binop-lhs"| n6
    n7(["RNumber (7)
7"])
    n8 -->|"binop-rhs"| n7
    n11(["RBinaryOp (11)
#60;#45;"])
    n53 -->|"expr-list-child-3"| n11
    n9(["RSymbol (9)
N"])
    n11 -->|"binop-lhs"| n9
    n10(["RNumber (10)
10"])
    n11 -->|"binop-rhs"| n10
    n36(["RForLoop (36)
for"])
    n53 -->|"expr-list-child-4"| n36
    n12(["RSymbol (12)
i"])
    n36 -->|"for-variable"| n12
    n20(["RBinaryOp (20)
#58;"])
    n36 -->|"for-vector"| n20
    n13(["RNumber (13)
1"])
    n20 -->|"binop-lhs"| n13
    n19(["RExpressionList (19)
 "])
    n20 -->|"binop-rhs"| n19
    n19 -.-|"group-open"| n14
    n19 -.-|"group-close"| n15
    n14(["RSymbol (14)
("])
    n15(["RSymbol (15)
)"])
    n18(["RBinaryOp (18)
#45;"])
    n19 -->|"expr-list-child-0"| n18
    n16(["RSymbol (16)
N"])
    n18 -->|"binop-lhs"| n16
    n17(["RNumber (17)
1"])
    n18 -->|"binop-rhs"| n17
    n35(["RExpressionList (35)
 "])
    n36 -->|"for-body"| n35
    n35 -.-|"group-open"| n21
    n35 -.-|"group-close"| n22
    n21(["RSymbol (21)
#123;"])
    n22(["RSymbol (22)
#125;"])
    n29(["RBinaryOp (29)
#60;#45;"])
    n35 -->|"expr-list-child-0"| n29
    n23(["RSymbol (23)
sum"])
    n29 -->|"binop-lhs"| n23
    n28(["RBinaryOp (28)
#43;"])
    n29 -->|"binop-rhs"| n28
    n26(["RBinaryOp (26)
#43;"])
    n28 -->|"binop-lhs"| n26
    n24(["RSymbol (24)
sum"])
    n26 -->|"binop-lhs"| n24
    n25(["RSymbol (25)
i"])
    n26 -->|"binop-rhs"| n25
    n27(["RSymbol (27)
w"])
    n28 -->|"binop-rhs"| n27
    n34(["RBinaryOp (34)
#60;#45;"])
    n35 -->|"expr-list-child-1"| n34
    n30(["RSymbol (30)
product"])
    n34 -->|"binop-lhs"| n30
    n33(["RBinaryOp (33)
#42;"])
    n34 -->|"binop-rhs"| n33
    n31(["RSymbol (31)
product"])
    n33 -->|"binop-lhs"| n31
    n32(["RSymbol (32)
i"])
    n33 -->|"binop-rhs"| n32
    n44(["RFunctionCall (44)
cat"])
    n53 -->|"expr-list-child-5"| n44
    n37(["RSymbol (37)
cat"])
    n44 -->|"call-name"| n37
    n39(["RArgument (39)
#34;Sum#58;#34;"])
    n44 -->|"call-argument-1"| n39
    n38(["RString (38)
#34;Sum#58;#34;"])
    n39 -->|"arg-value"| n38
    n41(["RArgument (41)
sum"])
    n44 -->|"call-argument-2"| n41
    n40(["RSymbol (40)
sum"])
    n41 -->|"arg-value"| n40
    n43(["RArgument (43)
#34;
#34;"])
    n44 -->|"call-argument-3"| n43
    n42(["RString (42)
#34;
#34;"])
    n43 -->|"arg-value"| n42
    n52(["RFunctionCall (52)
cat"])
    n53 -->|"expr-list-child-6"| n52
    n45(["RSymbol (45)
cat"])
    n52 -->|"call-name"| n45
    n47(["RArgument (47)
#34;Product#58;#34;"])
    n52 -->|"call-argument-1"| n47
    n46(["RString (46)
#34;Product#58;#34;"])
    n47 -->|"arg-value"| n46
    n49(["RArgument (49)
product"])
    n52 -->|"call-argument-2"| n49
    n48(["RSymbol (48)
product"])
    n49 -->|"arg-value"| n48
    n51(["RArgument (51)
#34;
#34;"])
    n52 -->|"call-argument-3"| n51
    n50(["RString (50)
#34;
#34;"])
    n51 -->|"arg-value"| n50

```
	
<details>

<summary style="color:gray">R Code of the Normalized AST</summary>

The analysis required _6.09 ms_ (including parsing) within the generation environment.

```r
sum <- 0
product <- 1
w <- 7
N <- 10

for (i in 1:(N-1)) {
  sum <- sum + i + w
  product <- product * i
}

cat("Sum:", sum, "\n")
cat("Product:", product, "\n")

```

<details>

<summary style="color:gray">Mermaid Code</summary>

```
flowchart LR
    n53(["RExpressionList (53)
 "])
    n2(["RBinaryOp (2)
#60;#45;"])
    n53 -->|"expr-list-child-0"| n2
    n0(["RSymbol (0)
sum"])
    n2 -->|"binop-lhs"| n0
    n1(["RNumber (1)
0"])
    n2 -->|"binop-rhs"| n1
    n5(["RBinaryOp (5)
#60;#45;"])
    n53 -->|"expr-list-child-1"| n5
    n3(["RSymbol (3)
product"])
    n5 -->|"binop-lhs"| n3
    n4(["RNumber (4)
1"])
    n5 -->|"binop-rhs"| n4
    n8(["RBinaryOp (8)
#60;#45;"])
    n53 -->|"expr-list-child-2"| n8
    n6(["RSymbol (6)
w"])
    n8 -->|"binop-lhs"| n6
    n7(["RNumber (7)
7"])
    n8 -->|"binop-rhs"| n7
    n11(["RBinaryOp (11)
#60;#45;"])
    n53 -->|"expr-list-child-3"| n11
    n9(["RSymbol (9)
N"])
    n11 -->|"binop-lhs"| n9
    n10(["RNumber (10)
10"])
    n11 -->|"binop-rhs"| n10
    n36(["RForLoop (36)
for"])
    n53 -->|"expr-list-child-4"| n36
    n12(["RSymbol (12)
i"])
    n36 -->|"for-variable"| n12
    n20(["RBinaryOp (20)
#58;"])
    n36 -->|"for-vector"| n20
    n13(["RNumber (13)
1"])
    n20 -->|"binop-lhs"| n13
    n19(["RExpressionList (19)
 "])
    n20 -->|"binop-rhs"| n19
    n19 -.-|"group-open"| n14
    n19 -.-|"group-close"| n15
    n14(["RSymbol (14)
("])
    n15(["RSymbol (15)
)"])
    n18(["RBinaryOp (18)
#45;"])
    n19 -->|"expr-list-child-0"| n18
    n16(["RSymbol (16)
N"])
    n18 -->|"binop-lhs"| n16
    n17(["RNumber (17)
1"])
    n18 -->|"binop-rhs"| n17
    n35(["RExpressionList (35)
 "])
    n36 -->|"for-body"| n35
    n35 -.-|"group-open"| n21
    n35 -.-|"group-close"| n22
    n21(["RSymbol (21)
#123;"])
    n22(["RSymbol (22)
#125;"])
    n29(["RBinaryOp (29)
#60;#45;"])
    n35 -->|"expr-list-child-0"| n29
    n23(["RSymbol (23)
sum"])
    n29 -->|"binop-lhs"| n23
    n28(["RBinaryOp (28)
#43;"])
    n29 -->|"binop-rhs"| n28
    n26(["RBinaryOp (26)
#43;"])
    n28 -->|"binop-lhs"| n26
    n24(["RSymbol (24)
sum"])
    n26 -->|"binop-lhs"| n24
    n25(["RSymbol (25)
i"])
    n26 -->|"binop-rhs"| n25
    n27(["RSymbol (27)
w"])
    n28 -->|"binop-rhs"| n27
    n34(["RBinaryOp (34)
#60;#45;"])
    n35 -->|"expr-list-child-1"| n34
    n30(["RSymbol (30)
product"])
    n34 -->|"binop-lhs"| n30
    n33(["RBinaryOp (33)
#42;"])
    n34 -->|"binop-rhs"| n33
    n31(["RSymbol (31)
product"])
    n33 -->|"binop-lhs"| n31
    n32(["RSymbol (32)
i"])
    n33 -->|"binop-rhs"| n32
    n44(["RFunctionCall (44)
cat"])
    n53 -->|"expr-list-child-5"| n44
    n37(["RSymbol (37)
cat"])
    n44 -->|"call-name"| n37
    n39(["RArgument (39)
#34;Sum#58;#34;"])
    n44 -->|"call-argument-1"| n39
    n38(["RString (38)
#34;Sum#58;#34;"])
    n39 -->|"arg-value"| n38
    n41(["RArgument (41)
sum"])
    n44 -->|"call-argument-2"| n41
    n40(["RSymbol (40)
sum"])
    n41 -->|"arg-value"| n40
    n43(["RArgument (43)
#34;
#34;"])
    n44 -->|"call-argument-3"| n43
    n42(["RString (42)
#34;
#34;"])
    n43 -->|"arg-value"| n42
    n52(["RFunctionCall (52)
cat"])
    n53 -->|"expr-list-child-6"| n52
    n45(["RSymbol (45)
cat"])
    n52 -->|"call-name"| n45
    n47(["RArgument (47)
#34;Product#58;#34;"])
    n52 -->|"call-argument-1"| n47
    n46(["RString (46)
#34;Product#58;#34;"])
    n47 -->|"arg-value"| n46
    n49(["RArgument (49)
product"])
    n52 -->|"call-argument-2"| n49
    n48(["RSymbol (48)
product"])
    n49 -->|"arg-value"| n48
    n51(["RArgument (51)
#34;
#34;"])
    n52 -->|"call-argument-3"| n51
    n50(["RString (50)
#34;
#34;"])
    n51 -->|"arg-value"| n50

```

</details>

</details>




# Working with the Normalized AST
## Visiting
This chapter will outline how to use the `NormalizedAstVisitor` to go over the AST.

### **Step 1**: Get the ast

We can get the AST by running a parse & normalize _flowr_ pipeline:

```ts
async function getAst(code: string) {
    const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
        shell: new RShell(),
        request: requestFromInput(code.trim())
    }).allRemainingSteps();
    return result.normalize.ast;
}
```


### **Step 2**: Implement the `Visitor` Interface
To use the NormalizedAstVisitor we have to implement the Visitor interface:
 * **[Visitor](https://github.com/flowr-analysis/flowr/tree/main//src/abstract-interpretation/normalized-ast-visitor.ts#L27)**   
   
   <details><summary style="color:gray">Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main//src/abstract-interpretation/normalized-ast-visitor.ts#L27">./src/abstract-interpretation/normalized-ast-visitor.ts#L27</a></summary>
   
   
   ```ts
   export interface Visitor<Info = NoInfo> {
       visitNumber?(num: RNumber<Info>): void;
       visitString?(str: RString<Info>): void;
       visitLogical?(logical: RLogical<Info>): void;
       visitSymbol?(symbol: RSymbol<Info>): void;
       visitAccess?(node: RAccess<Info>): void;
       visitBinaryOp?(op: RBinaryOp<Info>): void;
       visitPipe?(op: RPipe<Info>): void;
       visitUnaryOp?(op: RUnaryOp<Info>): void;
       visitFor?(loop: RForLoop<Info>): void;
       visitWhile?(loop: RWhileLoop<Info>): void;
       visitRepeat?(loop: RRepeatLoop<Info>): void;
       visitNext?(next: RNext<Info>): void;
       visitBreak?(next: RBreak<Info>): void;
       visitComment?(comment: RComment<Info>): void;
       visitLineDirective?(comment: RLineDirective<Info>): void;
       visitIfThenElse?(ifThenExpr: RIfThenElse<Info>): void;
       visitExprList?(exprList: RExpressionList<Info>): void;
       visitFunctionDefinition?(definition: RFunctionDefinition<Info>): void;
       visitFunctionCall?(call: RFunctionCall<Info>): void;
       visitArgument?(argument: RArgument<Info>): void;
       visitParameter?(parameter: RParameter<Info>): void;
   }
   ```
   
   
   </details>
   


In this example we will implement a Visitor that counts the occurances of _if-statements_. For this we only implement the `visitIfThenElse` function.

```ts
const ifCountVisitor: Visitor & {count: number } = {
    visitIfThenElse() {
        this.count++;
    },
    count: 0
}
```


### **Step 3**: Run the NormalizedAstVisitor

```ts
new NormalizedAstVisitor(ast).accept(ifCount);
```


### Complete Code

```ts
async function countIfs(code: string) {
    const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
        shell: new RShell(),
        request: requestFromInput(code.trim())
    }).allRemainingSteps();

    const ast = result.normalize.ast;

    const ifCountVisitor: Visitor & {count: number } = {
        visitIfThenElse() {
            this.count++;
        },
        count: 0
    }

    new NormalizedAstVisitor(ast).accept(ifCountVisitor);
    return ifCount.count;
}
```




