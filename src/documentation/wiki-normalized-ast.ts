import { codeBlock, codeInline } from './doc-util/doc-code';
import { printNormalizedAst, printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import { FlowrGithubBaseRef, FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { getReplCommand } from './doc-util/doc-cli-option';
import { details } from './doc-util/doc-structure';
import { requestFromInput } from '../r-bridge/retriever';
import { visitAst } from '../r-bridge/lang-4.x/ast/model/processing/visitor';
import { collectAllIds } from '../r-bridge/lang-4.x/ast/model/collect';
import { DefaultNormalizedAstFold } from '../abstract-interpretation/normalized-ast-fold';
import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../project/context/flowr-file';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { parseRoxygenCommentsOfNode } from '../r-bridge/roxygen2/roxygen-parse';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';

async function quickNormalizedAstMultipleFiles() {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addFile(new FlowrInlineTextFile('foo.R', 'x <- 12; source("a.R")'));
	analyzer.addFile(new FlowrInlineTextFile('a.R', 'y <- x + 3'));
	analyzer.addFile(new FlowrInlineTextFile('b.R', 'print(x, y)'));
	analyzer.addRequest(
		{ request: 'file', content: 'a.R' },
		{ request: 'file', content: 'b.R' },
		{ request: 'file', content: 'foo.R' }
	);
	const n = await analyzer.normalize();
	return n;
}

export /* we have it in this separate line just to hide it in the doc generation */
class MyMathFold<Info> extends DefaultNormalizedAstFold<number, Info> {
	constructor() {
		/* use \`0\` as a placeholder empty for the monoid */
		super(0);
	}

	protected override concat(a: number, b: number): number {
		/* for this example, we ignore cases that we cannot handle */
		return b;
	}

	override foldRNumber(node: RNumber<Info>) {
	/* return the value of the number */
		return node.content.num;
	}

	override foldRBinaryOp(node: RBinaryOp<Info>) {
		if(node.operator === '+') {
			return this.fold(node.lhs) + this.fold(node.rhs);
		} else if(node.operator === '*') {
			return this.fold(node.lhs) * this.fold(node.rhs);
		} else {
		/* in case we cannot handle the operator we could throw an error, or just use the default behavior: */
			return super.foldRBinaryOp(node);
		}
	}
}

async function useMyMathFoldExample() {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	analyzer.addRequest('1 + 3 * 2');
	const normalize = await analyzer.normalize();
	const result = new MyMathFold().fold(normalize.ast);
	return result;
}


/**
 * https://github.com/flowr-analysis/flowr/wiki/Normalized-AST
 */
export class WikiNormalizedAst extends DocMaker<'wiki/Normalized AST.md'> {
	constructor() {
		super('wiki/Normalized AST.md', module.filename, 'normalized ast');
	}

	protected async text({ ctx, treeSitter }: DocMakerArgs): Promise<string> {
		return `
_flowR_ produces a normalized version of R's abstract syntax tree (AST),
offering the following benefits:

1. abstract away from intricacies of the R parser
2. provide a version-independent representation of the program
3. decorate the AST with additional information, e.g., parent relations and nesting information

In general, the mapping should be rather intuitive and focused primarily on the
syntactic structure of the program.
Consider the following example which shows the normalized AST of the code

${codeBlock('r', 'x <- 2 * 3 + 1')}

Each node in the AST contains the type, the id, and the lexeme (if applicable).
Each edge is labeled with the type of the parent-child relationship (the "role").

${await printNormalizedAstForCode(treeSitter, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart LR\n' })}

> [!TIP]
> If you want to investigate the normalized AST, 
> you can either use the [Visual Studio Code extension](${FlowrGithubBaseRef}/vscode-flowr) or the ${getReplCommand('normalize*')} 
> command in the REPL (see the [Interface wiki page](${FlowrWikiBaseRef}/Interface) for more information).

Indicative of the normalization is the root ${ctx.link('RProject')} node, which is present in every normalized AST
and provides the ${ctx.link('RExpressionList')} nodes for each file in the project.
In general, we provide node types for:

1. literals (e.g., numbers and strings)
2. references (e.g., symbols, parameters and function calls)
3. constructs (e.g., loops and function definitions)
4. branches (e.g., \`next\` and \`break\`)
5. operators (e.g. \`+\`, \`-\`, and \`*\`)

<details>

<summary style="color:gray">Complete Class Diagram</summary>

Every node is a link, which directly refers to the implementation in the source code.
Grayed-out parts are used for structuring the AST, grouping together related nodes.

${codeBlock('mermaid', ctx.mermaid('RNode'))}

</details>

Node types are controlled by the ${ctx.link('RType')} enum (see ${getFilePathMd('../r-bridge/lang-4.x/ast/model/type.ts')}), 
which is used to distinguish between different types of nodes.
Additionally, every AST node is generic with respect to the \`Info\` type which allows for arbitrary decorations (e.g., parent inforamtion or dataflow constraints).
Most notably, the \`info\` field holds the \`id\` of the node, which is used to reference the node in the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph).

In summary, we have the following types:

${details('Normalized AST Node Types',
	ctx.hierarchy('RNode', { collapseFromNesting: Number.MAX_VALUE })
)}

The following segments intend to give you an overview of how to work with the normalized AST:

* [How to get a Normalized AST](#how-to-get-a-normalized-ast)
* [Visitors and Folds](#visitors-and-folds)

> [!TIP]
> If you want to get more information on roxygen comments attached to AST nodes,
> check out ${ctx.link(parseRoxygenCommentsOfNode)}.


## How to Get a Normalized AST

As explained alongside the [Interface](${FlowrWikiBaseRef}/Interface#creating-flowr-analyses) wiki page, you can use an instance of
${ctx.link(FlowrAnalyzer)} to get the ${ctx.link('NormalizedAst')}:

${codeBlock('ts', `
async function getAst(code: string): Promise<RNode> {
    const analyzer = await new FlowrAnalyzerBuilder(${requestFromInput.name}(code.trim())).build();
    const result = analyzer.normalizedAst();
    return result.ast;
}`)}

From the REPL, you can use the ${getReplCommand('normalize')} command.

### Multi-File Projects

With the ${ctx.link(FlowrAnalyzer)}, you can analyze multiple files at once:

${ctx.code(quickNormalizedAstMultipleFiles, { dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true })}

Visualizing the resulting AST yields the following.

<details>

<summary style="color:gray">Mermaid Diagram</summary>

${printNormalizedAst((await quickNormalizedAstMultipleFiles()).ast, 'flowchart LR\n')}

</details>


## Traversing the Normalized AST

We provide two ways to traverse the normalized AST: [Visitors](#visitors) and [Folds](#folds).
Please note, that they usually operate on the ${ctx.link('RExpressionList')} level, and it is up to
you to decide how you want to traverse multiple files with a ${ctx.link('RProject')} in the AST (you can, for example, simplify flat-map over the files).
The ${ctx.link('RProject')} node cannot appear nested within other nodes, so you can safely assume that any child of a node is not an ${ctx.link('RProject')}.

### Visitors

If you want a simple visitor which traverses the AST, the ${ctx.link(visitAst)} function is a good starting point.
You may specify functions to be called whenever you enter and exit a node during the traversal, and any
computation is to be done by side effects.
For example, if you want to collect all the \`id\`s present within a normalized (sub-)AST,
as it is done by the ${ctx.link(collectAllIds)} function, you can use the following visitor:

${codeBlock('ts', `
const ids = new Set<NodeId>();
visitAst(nodes, node => {
    ids.add(node.info.id);
});
return ids;
`)} 

### Folds

We formulate a fold with the base class ${ctx.link(DefaultNormalizedAstFold)} in ${getFilePathMd('../abstract-interpretation/normalized-ast-fold.ts')}.
Using this class, you can create your own fold behavior by overwriting the default methods.
By default, the class provides a monoid abstraction using the _empty_ from the constructor and the _concat_ method.

 
${ctx.hierarchy(DefaultNormalizedAstFold)}

Now, of course, we could provide hundreds of examples here, but we use tests to verify that the fold behaves as expected
and happily point to them at ${getFilePathMd('../../test/functionality/r-bridge/normalize-ast-fold.test.ts')}.

As a simple showcase, we want to use the fold to evaluate numeric expressions containing numbers, \`+\`, and \`*\` operators.

${ctx.code(MyMathFold, { dropLinesStart: 1 })}

Now, we can use the ${ctx.link(FlowrAnalyzer)} (see the ${ctx.linkPage('wiki/Analyzer')} wiki page) to get the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} and apply the fold:
 
${ctx.code(useMyMathFoldExample, { dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true })}

Running the code, we retrieve the result: ${codeInline(String(await useMyMathFoldExample()))}.
`;
	}
}
