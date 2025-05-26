import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import {
	mermaidHide,
	getTypesFromFolderAsMermaid,
	shortLink,
	printHierarchy,
	printCodeOfElement,
	getDocumentationForType
} from './doc-util/doc-types';
import path from 'path';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getReplCommand } from './doc-util/doc-cli-option';
import { block, details, section } from './doc-util/doc-structure';
import { getCfg, printCFGCode } from './doc-util/doc-cfg';
import { visitCfgInOrder, visitCfgInReverseOrder } from '../control-flow/simple-visitor';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import { CfgVertexType, ControlFlowGraph } from '../control-flow/control-flow-graph';
import { simplifyControlFlowInformation } from '../control-flow/cfg-simplification';
import { extractCFG, ResolvedCallSuffix } from '../control-flow/extract-cfg';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { convertCfgToBasicBlocks } from '../control-flow/cfg-to-basic-blocks';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNumberValue } from '../r-bridge/lang-4.x/convert-values';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { isRNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { happensBefore } from '../control-flow/happens-before';
import { assertCfgSatisfiesProperties } from '../control-flow/cfg-properties';
import { BasicCfgGuidedVisitor } from '../control-flow/basic-cfg-guided-visitor';
import { SyntaxAwareCfgGuidedVisitor } from '../control-flow/syntax-cfg-guided-visitor';
import { diffOfControlFlowGraphs } from '../control-flow/diff-cfg';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getOriginInDfg } from '../dataflow/origin/dfg-get-origin';
import { DataflowAwareCfgGuidedVisitor } from '../control-flow/dfg-cfg-guided-visitor';
import type { DataflowInformation } from '../dataflow/info';
import type { DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type {
	SemanticCfgGuidedVisitorConfiguration
} from '../control-flow/semantic-cfg-guided-visitor';
import {
	SemanticCfgGuidedVisitor
} from '../control-flow/semantic-cfg-guided-visitor';
import { NewIssueUrl } from './doc-util/doc-issue';
import { EdgeType, edgeTypeToName } from '../dataflow/graph/edge';
import { guard } from '../util/assert';

const CfgLongExample = `f <- function(a, b = 3) {
 if(a > b) {
 	return(a * b);
 } else {
 	while(a < b) {
 		a <- a + 1;
 	}
 	return(a);
 }
}

print(f(21) + f(42))`.trim();


function sampleCollectNumbers(cfg: ControlFlowInformation, ast: NormalizedAst): RNumberValue[] {
	const numbers: RNumberValue[] = [];
	visitCfgInOrder(cfg.graph, cfg.entryPoints, id => {
		/* obtain the corresponding node from the AST */
		const node = ast.idMap.get(id);
		/* if it is present and a number, add the parsed value to the list */
		if(isRNumber(node)) {
			numbers.push(node.content);
		}
	});
	return numbers;
}

class CollectNumbersVisitor extends BasicCfgGuidedVisitor {
	private numbers: RNumberValue[] = [];
	private ast:     NormalizedAst;

	constructor(controlFlow: ControlFlowInformation, ast: NormalizedAst) {
		super({ controlFlow, defaultVisitingOrder: 'forward' });
		this.ast = ast;
	}

	protected override onVisitNode(node: NodeId): void {
		const astNode = this.ast.idMap.get(node);
		if(isRNumber(astNode)) {
			this.numbers.push(astNode.content);
		}
		super.onVisitNode(node);
	}

	public getNumbers(): RNumberValue[] {
		return this.numbers;
	}
}


class CollectNumbersSyntaxVisitor extends SyntaxAwareCfgGuidedVisitor {
	private numbers: RNumberValue[] = [];

	constructor(controlFlow: ControlFlowInformation, normalizedAst: NormalizedAst) {
		super({ controlFlow, normalizedAst, defaultVisitingOrder: 'forward' });
	}

	protected override visitRNumber(node: RNumber<ParentInformation>): void {
		this.numbers.push(node.content);
	}

	public getNumbers(): RNumberValue[] {
		return this.numbers;
	}
}

class CollectNumbersDataflowVisitor extends DataflowAwareCfgGuidedVisitor {
	private numbers: RNumberValue[] = [];

	constructor(controlFlow: ControlFlowInformation, dataflow: DataflowInformation) {
		super({ controlFlow, dataflow, defaultVisitingOrder: 'forward' });
	}

	protected override visitValue(node: DataflowGraphVertexValue): void {
		const astNode = this.config.dataflow.graph.idMap?.get(node.id);
		if(isRNumber(astNode)) {
			this.numbers.push(astNode.content);
		}
	}

	public getNumbers(): RNumberValue[] {
		return this.numbers;
	}
}

class CollectSourcesSemanticVisitor extends SemanticCfgGuidedVisitor {
	private sources: string[] = [];

	constructor(controlFlow: ControlFlowInformation, normalizedAst: NormalizedAst, dataflow: DataflowInformation) {
		super({ controlFlow, normalizedAst, dataflow, defaultVisitingOrder: 'forward' });
	}

	protected override onAssignmentCall({ source }: { source?: NodeId }): void {
		if(source) {
			this.sources.push(recoverName(source, this.config.normalizedAst.idMap) ?? '??');
		}
	}

	public getSources(): NodeId[] {
		return this.sources;
	}
}

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src'),
		typeName:    'RNode',
		inlineTypes: mermaidHide
	});

	const testTypes = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./test'),
		typeName:    'assertCfg',
		inlineTypes: mermaidHide
	});


	return `${autoGenHeader({ filename: module.filename, purpose: 'control flow graph', rVersion: rversion })}

_flowR_ produces three main perspectives of the program: 1) a [normalized version of the AST](${FlowrWikiBaseRef}/Normalized-AST)
and 2) a [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph), and 3) a control flow graph (CFG).
flowR uses this CFG interweaved with its data flow analysis and for some of its queries (e.g., to link to the last call in a [Call-Context Query](${FlowrWikiBaseRef}/Query-API)).

Please note that, mostly due to historical reasons, the [control dependencies](${FlowrWikiBaseRef}/Dataflow%20Graph#control-dependencies) that are stored directly within the
DFG provide only a partial view of the CFG. While they provide you with information on the conditional execution of vertices, they do not encode the order of execution.
In contrast, the CFG describes a complete view of the program's control flow.

${
	block({
		type:    'TIP',
		content: `If you want to investigate the Control Flow Graph,
you can use the ${getReplCommand('controlflow*')} command in the REPL (see the [Interface wiki page](${FlowrWikiBaseRef}/Interface) for more information).
By default, this view does _not_ use basic blocks as, for example, R allows unconditional jumps to occur in spots where conventional languages would assume expressions (e.g., if-conditions).
Yet, by using ${getReplCommand('controlflowbb*')} you can inspect the CFG with basic blocks (although you have to keep in mind that now, there can be a value flow between basic blocks)` 
	})
}

For readability, we structure this wiki page into various segments:

- [Initial Overview](#cfg-overview)
- [Structure of the Control Flow Graph](#cfg-structure)
	- [CFG Vertices](#cfg-structure-vertices)
	- [CFG Edges](#cfg-structure-edges)
	- [Adding Basic Blocks](#cfg-basic-blocks)
- [Working with the CFG](#cfg-working)
	- [Simple Traversal](#cfg-simple-traversal)
	- [Diffing and Testing](#cfg-diff-and-test)
	- [Sophisticated CFG Traversal](#cfg-traversal)
	- [Working With Exit Points](#cfg-exit-points)


${section('Initial Overview', 2, 'cfg-overview')}

For now, let's look at a CFG for a program without any branching:

${codeBlock('r', 'x <- 2 * 3 + 1')}

The corresponding CFG is a directed, labeled graph with two types of edges (control and flow dependencies).

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart RL\n' })}

${block({
	type:    'IMPORTANT',
	content: 'As the edges describe dependencies they point in the inverse order of execution (which is very helpful for backward analyses)! The [visitors](#cfg-working) abstract away from this and there is no harm in considering an inverted CFG. Yet, you should keep this in mind!'
})}

Every normalized node of the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) that has any relevance to the
execution is added and automatically linked using its id (similarly to vertices of the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph)).
Expressions, such as \`2 * 3\` get an additional node with an artificial id that ends in \`-exit\` to mark whenever their calculation is over.

To gain a better understanding, let's have a look at a simple program with a single branching structure:

${await printCFGCode(shell, 'if(u) 3 else 2', { showCode: true, openCode: false, prefix: 'flowchart RL\n' })}

Here, you can see the \`if\` node followed by the condition (in this case merely \`u\`) that then splits into two branches for the two possible outcomes.
The \`if\` structure is terminated by the corresponding \`-exit\` node (see the [structure](#cfg-structure) section for more details).

For you to compare, the following shows the CFG of an \`if\` without an \`else\` branch:

${await printCFGCode(shell, 'if(u || v) 3', { showCode: true, openCode: false, prefix: 'flowchart RL\n' })}

Activating the calculation of basic blocks produces the following:

${await printCFGCode(shell, 'if(u || v) 3', { showCode: true, openCode: false, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'] })}

Which is probably much more readable if compacted (although the reconstucted code can sometimes be slightly mislieading as flowR tries its best to make it syntactically correct and hence add closing braces etc. which are technically not part of the respective block):

${await printCFGCode(shell, 'if(u || v) 3', { showCode: true, openCode: false, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'], simplify: true })}

The control flow graph also harmonizes with function definitions, and calls:

${await printCFGCode(shell, 'f <- function() { 3 }\nf()', { showCode: true, openCode: true, prefix: 'flowchart RL\n' })}

${section('Structure of the Control Flow Graph', 2, 'cfg-structure')}

You can produce your very own control flow graph with ${shortLink(extractCFG.name, types.info)}.
The ${shortLink(ControlFlowGraph.name, types.info)} class describes everything required to model the control flow graph, with its edge types described by
 ${shortLink('CfgEdge', types.info)} and its vertices by ${shortLink('CfgSimpleVertex', types.info)}.
However, you should be aware of the ${shortLink('ControlFlowInformation', types.info)} interface which adds some additional information the the CFG
(and is used during the construction of the CFG as well):

${printHierarchy({ info: types.info, root: 'ControlFlowInformation', program: types.program, openTop: true })}

To check whether the CFG has the expected shape, you can use the test function ${shortLink('assertCfg', testTypes.info)} which supports testing for
 sub-graphs as well (it provides diffing capabilities similar to ${shortLink('assertDataflow', testTypes.info)}).
As the CFG may become unhandy for larger programs, there are simplifications available with ${shortLink(simplifyControlFlowInformation.name, types.info)}
(these can be passed on to the ${shortLink(extractCFG.name, types.info)} function as well).

${section('CFG Vertices', 3, 'cfg-structure-vertices')}

All vertex types are summarized in the ${shortLink('CfgVertexType', types.info)} enum which currently contains the following types:

${Object.entries(CfgVertexType).map(([key, value]) => `- \`${key}\` (${value})`).join('\n')}

We use the ${shortLink('CfgBasicBlockVertex', types.info)} to represent [basic blocks](#cfg-basic-blocks) and separate
expressions (${shortLink('CfgExpressionVertex', types.info)}) and statements (${shortLink('CfgStatementVertex', types.info)}) 
as control flow units with and without side effects (if you want to, you can see view statements as effectful expressions).
The markers (${shortLink('CfgMidMarkerVertex', types.info)} and ${shortLink('CfgEndMarkerVertex', types.info)})
indicate specific segments of larger expressions/statements (e.g., an \`if\` which has a condition and its branches). 

To signal these links, the expressions and statements contain information about the attached markers:

${printHierarchy({ info: types.info, root: 'CfgWithMarker', program: types.program, openTop: true })}

Similarly, the markers contain a link to their root: 

${printHierarchy({ info: types.info, root: 'CfgWithRoot', program: types.program, openTop: true })}

In mermaid visualizations, we use rectangles for statements, rounded rectangles for expressions, circles for exit markers and double-lined rectangles for mid markers.
Blocks are visualized as boxes around the contained vertices.

${block({
	type:    'NOTE',
	content: `
	Every CFG vertex has a ${shortLink('NodeId', types.info)} that links it to the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) (although basic blocks will find no counterpart as they are a structuring element of the CFG).
	Additionally, it may provide information on the called functions (in case that the current element is a function call).
	Have a look at the ${shortLink('CfgBaseVertex', types.info)} interface for more information.
		`.trim()
})}

${section('CFG Edges', 3, 'cfg-structure-edges')}

The ${shortLink(ControlFlowGraph.name, types.info)} uses two types of edges to represent the control flow, separated by the ${shortLink('CfgEdgeType', types.info)} enum
and the two interfaces: ${shortLink('CfgFlowDependencyEdge', types.info)} and ${shortLink('CfgControlDependencyEdge', types.info)}.

${section('Flow Dependencies', 4, 'cfg-flow-dependency')}

The most common edge is the flow dependency&nbsp;(FD) which simply signals that the source vertex happens _after_ the target vertex in the control flow.
So \`x; y\` would produce a flow dependency from \`y\` to \`x\` (additionally to the program-enveloping root expression list):

${await printCFGCode(shell, 'x; y', { showCode: false, prefix: 'flowchart RL\n' })}

${section('Control Dependencies', 4, 'cfg-control-dependency')}

Control dependencies&nbsp;(CD) are used to signal that the execution of the source vertex depends on the taget vertex (which, e.g., is the condition of an \`if\` statement or \`while\` loop).
They contain additional information to signal _when_ the source vertex is executed:

${printHierarchy({ info: types.info, root: 'CfgControlDependencyEdge', program: types.program, openTop: true })}

The extra \`caused\` link signals the vertex that caused the control flow influence.


${await (async() => {
	const exa = await printCFGCode(shell, 'if(u) 3 else 2', { showCode: true, prefix: 'flowchart RL\n' });
	return details('Example: if-else', exa);
})()}

${await (async() => {
	const exa = await printCFGCode(shell, 'while(u) b', { showCode: true, prefix: 'flowchart RL\n' });
	return details('Example: while-loop', exa);
})()}
<br/>

Please note that repeat loops do _not_ have control dependencies, as they repeat their body unconditionally.
Additionally, the control flow graph does not have to be connected. If you use a repeat without any exit condition,
the corresponding exit markers are not reachable from the entry:

${await (async() => {
	const exa = await printCFGCode(shell, 'repeat { b }; after', { showCode: true, prefix: 'flowchart RL\n' });
	return details('Example: repeat-loop (infinite)',  exa);
})()}

${await (async() => {
	const exa = await printCFGCode(shell, 'repeat { b; if(u) break; }; after', { showCode: true, prefix: 'flowchart RL\n' });
	return details('Example: repeat-loop (with break)',  exa);
})()}
<br/>

In the context of a for-loop, the control dependency refer to whether the respective vector still has values to iterate over.

${await (async() => {
	const exa = await printCFGCode(shell, 'for(i in 1:10) b', { showCode: true, prefix: 'flowchart RL\n' });
	return details('Example: for-loop', exa);
})()}

${section('Extra: Call Links', 4, 'cfg-call-links')}

If you generate the CFG with the ${shortLink(extractCFG.name, types.info)} function you can (and, if you want to gain inter-procedural information, should)
pass a matching [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph) to it to incorporate the dataflow perspective into the CFG.

The difference becomes obvious when we look at the code \`f <- function() b; f()\` first without the dataflow graph:

${await printCFGCode(shell, 'f <- function() b; f()', { showCode: true, prefix: 'flowchart RL\n', useDfg: false })}

And now, including dataflow information:

${await printCFGCode(shell, 'f <- function() b; f()', { showCode: true, prefix: 'flowchart RL\n', useDfg: true })}

There are two important additions:

1. A new exit marker, canonically suffixed with \`${ResolvedCallSuffix}\` signals that we are aware of the function call target.
   This marker always follows the exit marker of the function call and links not just the call but also the exit points of the function definition.
2. A new _calls_ attribute attached to the function call vertex. This holds the ${shortLink('NodeId', types.info)} of the function definitions that are called from this vertex.

For built-in functions that are provided by flowR's built-in configuration (see the [interface wiki page](${FlowrWikiBaseRef}/Interface)) the CFG does not contain
the additional information directly:

${await printCFGCode(shell, 'print(3)', { showCode: true, prefix: 'flowchart RL\n' })}

This is due to the fact that the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph) does contain the required call information (and there are no new control vertices to add as the built-in call has no target in the source code):

${await printDfGraphForCode(shell, 'print(3)', { showCode: true })}

${section('Adding Basic Blocks', 3, 'cfg-basic-blocks')}

As mentioned in the introduction, our control flow graph does not use basic blocks by default and hence simply links all vertices independent of whether they have (un-)conditional jumps or not.
On the upside, this tells us the execution order (and, in case of promises, forcing order) of involved expressions and seamlessly handles cases like
\`x <- return(3)\`.  On the downside, this makes it hard to apply classical control flow graph algorithms and, in general, makes the graph much harder to read.
Yet, we can request basic blocks or transform an existing CFG into basic blocks using the ${shortLink(convertCfgToBasicBlocks.name, types.info)} function.

Any program without any (un-)conditional jumps now contains a single basic block:

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: true, openCode: true, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'], simplify: true })}

While the CFG without basic blocks is much bigger:

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart RL\n' })}

In a way, using the basic blocks perspective does not remove any of these vertices (we just usually visualize them compacted as their execution order should be "obvious").
The vertices are still there, as elems of the ${shortLink('CfgBasicBlockVertex', types.info)}:

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'], simplify: false })}

The benefit (for comprehensibility and algorithms) becomes more apparent when we look at a more complicated program:

${codeBlock('r', CfgLongExample)}

With basic blocks, this code looks like this:

${await printCFGCode(shell, CfgLongExample, { showCode: false, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'], simplify: true })}

Now, without basic blocks, this is a different story...

${await (async() => {
	const exa = await printCFGCode(shell, CfgLongExample, { showCode: false, prefix: 'flowchart RL\n' });
	return details('The full CFG', exa);
})()}

And again it should be noted that even though the example code is more complicated, this is still far from the average real-world script.

${section('Working with the CFG', 2, 'cfg-working')}

There is a plethora of functions that you can use the traverse the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) and the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph). 
Similarly, flowR provides you with a set of utility functions and classes that you can use to interact with the control flow graph.

${section('Simple Traversal', 3, 'cfg-simple-traversal')}

If you are just interested in traversing the vertices within the cfg, two simple functions
${shortLink(visitCfgInOrder.name, types.info)} and ${shortLink(visitCfgInReverseOrder.name, types.info)} are available. For [basic blocks](#cfg-basic-blocks)
these will automatically traverse the elements contained within the blocks (in the respective order).
For example, the following function will return all numbers contained within the CFG:

${printCodeOfElement(types, sampleCollectNumbers.name)}

Calling it with the CFG and AST of the expression \`x - 1 + 2L * 3\` yields the following elements (in this order):

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const collected = sampleCollectNumbers(res.info, res.ast);
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

A more useful appearance of these visitors occurs with ${shortLink(happensBefore.name, types.info)} which uses the CFG to determine whether the execution
of one vertex always, maybe, or never happens before another vertex (see the corresponding [query documentation](${FlowrWikiBaseRef}/Query-API#happens-before-query) for more information).


${section('Diffing and Testing', 3, 'cfg-diff-and-test')}

As mentioned above, you can use the test function ${shortLink('assertCfg', testTypes.info)} to check whether the control flow graph has the desired shape.
The function supports testing for sub-graphs as well (it provides diffing capabilities similar to ${shortLink('assertDataflow', testTypes.info)}).
If you want to diff two control flow graphs, you can use the ${shortLink(diffOfControlFlowGraphs.name, types.info)} function.

${section('Checking Properties', 4, 'cfg-check-properties')}

To be a valid representation of the program, the CFG should satisfy a collection of properties that, in turn, you can automatically assume to hold
when working with it. In general, we verify these in every unit test using ${shortLink(assertCfgSatisfiesProperties.name, types.info)},
and you can have a look at the active properties by checking the ${shortLink('CfgProperties', types.info)} object.
In general, we check for a hammock graph (given that the program contains no definite infinite loop) and the absence of direct cycles.

${section('Sophisticated CFG Traversal', 3, 'cfg-traversal')}

The [simple traversal](#cfg-simple-traversal) functions are great for simple tasks, but very unhandy when you want to do something more sophisticated
that incorporates language semantics such as function calls. Hence, we provide a series of incrementally more sophisticated (but complex)
visitors that incorporate various alternative perspectives:

- [Basic CFG Visitor](#cfg-traversal-basic):\\
  As a class-based version of the [simple traversal](#cfg-traversal-basic) functions
- [Syntax-Aware CFG Visitor](#cfg-traversal-syntax):\\
  If you want directly incorporate the type of the respective vertex in the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) into your visitor
- [Dataflow-Aware CFG Visitor](#cfg-traversal-dfg):\\
  If you require the [dataflow information](${FlowrWikiBaseRef}/Dataflow%20Graph) as well (e.g., to track built-in function calls, ...)
- [Semantic CFG Visitor](#cfg-traversal-semantic):\\
  Currently the most advanced visitor that combines syntactic with dataflow information.

${section('Basic CFG Visitor', 4, 'cfg-traversal-basic')}

The ${shortLink(BasicCfgGuidedVisitor.name, types.info)} class essential provides the same functionality as the [simple traversal](#cfg-simple-traversal) functions but in a class-based version.
Using it, you can select whether you want to traverse the CFG in order or in reverse order.

To replicate the number collector from above, you can use the following code:

${printCodeOfElement(types, CollectNumbersVisitor.name)}

Instead of directly calling ${shortLink(visitCfgInOrder.name, types.info)} we pass the \`forward\` visiting order to the constructor of the visitor.
Executing it with the CFG and AST of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersVisitor(res.info, res.ast);
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}


${section('Syntax-Aware CFG Visitor', 4, 'cfg-traversal-syntax')}

The ${shortLink(SyntaxAwareCfgGuidedVisitor.name, types.info)} class incorporates knowledge of the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) into the CFG traversal and
directly provides specialized visitors for the various node types.
Now, our running example of collecting all numbers simplifies to this:

${printCodeOfElement(types, CollectNumbersSyntaxVisitor.name)}

And again, executing it with the CFG and AST of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersSyntaxVisitor(res.info, res.ast);
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

${section('Dataflow-Aware CFG Visitor', 4, 'cfg-traversal-dfg')}

There is a lot of benefit in incorporating the [dataflow information](${FlowrWikiBaseRef}/Dataflow%20Graph) into the CFG traversal, as it contains
information about overwritten function calls, definition targets, and so on.
Our best friend is the ${shortLink(getOriginInDfg.name, types.info)} function which provides the important information about the origin of a vertex in the dataflow graph.
The ${shortLink(DataflowAwareCfgGuidedVisitor.name, types.info)} class does some of the basic lifting for us.
While it is not ideal for our goal of collecting all numbers, it shines in other areas such as collecting all used variables,&nbsp;...

${printCodeOfElement(types, CollectNumbersDataflowVisitor.name)}

Again, executing it with the CFG and Dataflow of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersDataflowVisitor(res.info, res.dataflow);
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

${section('Semantic CFG Visitor', 4, 'cfg-traversal-semantic')}

The ${shortLink(SemanticCfgGuidedVisitor.name, types.info)} class is flowR's most advanced visitor that combines the syntactic and dataflow information.
The main idea is simple, it provides special handlers for assignments, conditionals, and other R semantics but still follows
the structure of the CFG.

${block({
	type:    'NOTE',
	content: `This visitor is still in the design phase so please open up a [new issue](${NewIssueUrl}) if you have any suggestions or find any bugs.`
})}

To explore what it is capable of, let's create a visitor that prints all values that are used in assignments:

${printCodeOfElement(types, CollectSourcesSemanticVisitor.name)}

Executing it with the CFG and Dataflow of the expression \`x <- 2; 3 -> x; assign("x", 42 + 21)\`, causes the following values&nbsp;(/lexemes) to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x <- 2; 3 -> x; assign("x", 42 + 21)');
	const visitor = new CollectSourcesSemanticVisitor(res.info, res.ast, res.dataflow);
	visitor.start();
	const collected = visitor.getSources();
	return collected.map(n => '\n- `' + n + '`').join('');
})()}

All in all, this visitor offers the following semantic events:

${
	/* let's iterate over all methods */
	Object.getOwnPropertyNames(Object.getPrototypeOf(new SemanticCfgGuidedVisitor(undefined as unknown as SemanticCfgGuidedVisitorConfiguration)))
		.filter(n => n !== 'constructor').sort().map(
			key => {
				const doc = getDocumentationForType(`SemanticCfgGuidedVisitor::${key}`, types.info, '  ');
				return `- ${shortLink(`SemanticCfgGuidedVisitor::${key}`, types.info)}\\\n${doc ?? '_no documentation available_'}\n`;	
			}
		).join('\n')
}


${section('Working With Exit Points', 3, 'cfg-exit-points')}

With the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph) you already get a \`${edgeTypeToName(EdgeType.Returns)}\` edge that tells you what a function call returns 
(given that this function call does neither transform nor create a value).
But the control flow perspective gives you more! Given a simple addition like \`x + 1\`, the CFG looks like this:

${await (async function() {
	const cfg = await getCfg(shell, 'x + 1');
	const [plusVertexId, plusVertex] = [...cfg.info.graph.vertices()].filter(([n]) => recoverName(n, cfg.ast.idMap) === '+')[0];
	guard(plusVertex.type === CfgVertexType.Expression);
	const numOfExits
		= plusVertex.end?.length ?? 0;
	guard(plusVertex.end && numOfExits === 1);
	
	return `${await printCFGCode(shell, 'x + 1', { showCode: true, prefix: 'flowchart RL\n' })}
	
Looking at the binary operation vertex for \`+\` (with id \`${plusVertexId}\`) we see that it is linked to a single exit ("end marker") point: \`${plusVertex.end[0]}\`.
Checking this vertex essentially reveals all exit points of the expression &dash; in this case, this simply refers to the operands of the addition.
However, the idea transfers to more complex expressions as well...
	`;
})()}

${details('Example: Exit Points for an if', await (async function() {
	const expr = 'if(u) 3 else 2';
	const cfg = await getCfg(shell, expr);
	const [ifVertexId, ifVertex] = [...cfg.info.graph.vertices()].filter(([n]) => recoverName(n, cfg.ast.idMap) === 'if')[0];
	guard(ifVertex.type === CfgVertexType.Statement);
	const numOfExits
			= ifVertex.end?.length ?? 0;
	guard(ifVertex.end && numOfExits === 1);

	return `${await printCFGCode(shell, expr, { showCode: true, prefix: 'flowchart RL\n' })}
	
Looking at the if vertex for (with id \`${ifVertexId}\`) we see that it is again linked to a single exit point: \`${ifVertex.end[0]}\`.
Yet, now this exit vertex is linked to the two branches of the if statement (the \`then\` and \`else\` branch).
	`;
})())}

Hence, you may rely on the corresponding exit point(s) to identify all exits of a given expression (in a way, these exit-points are merely super-sinks trying to ensure the hammock graph property).

${block({
	type:    'WARNING',
	content: 'Using basic blocks, this works just the same. However please keep in mind that the corresponding exit markers do not (and for control statements usually will not) be part of the same basic block.'
})}

`;
}

if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
