import { getReplCommand } from './doc-util/doc-cli-option';
import { linkToQueryOfName } from './doc-util/doc-query';
import { block, details, section } from './doc-util/doc-structure';
import { getCfg, printCfgCode } from './doc-util/doc-cfg';
import { visitCfgInOrder, visitCfgInReverseOrder } from '../control-flow/simple-visitor';
import {
	type ControlFlowInformation,
	CfgVertexType,
	ControlFlowGraph,
	CfgVertex
} from '../control-flow/control-flow-graph';
import { simplifyControlFlowInformation } from '../control-flow/cfg-simplification';
import { extractCfg } from '../control-flow/control-flow-graph';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { convertCfgToBasicBlocks } from '../control-flow/cfg-to-basic-blocks';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNumberValue } from '../r-bridge/lang-4.x/convert-values';
import { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { happensBefore } from '../control-flow/happens-before';
import { assertCfgSatisfiesProperties } from '../control-flow/cfg-properties';
import { BasicCfgGuidedVisitor } from '../control-flow/basic-cfg-guided-visitor';
import { SyntaxAwareCfgGuidedVisitor } from '../control-flow/syntax-cfg-guided-visitor';
import { diffOfControlFlowGraphs } from '../control-flow/diff-cfg';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { cfgVisitorConfig, DataflowAwareCfgGuidedVisitor } from '../control-flow/dfg-cfg-guided-visitor';
import type { DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import { type SemanticCfgGuidedVisitorConfiguration, SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import { NewIssueUrl } from './doc-util/doc-issue';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { guard } from '../util/assert';
import { contextFromInput } from '../project/context/flowr-analyzer-context';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { prefixLines } from './doc-util/doc-general';
import { codeBlock } from './doc-util/doc-code';
import { Dataflow } from '../dataflow/graph/df-helper';
import { enumMembers } from '../util/objects';

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
		if(RNumber.is(node)) {
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
		if(RNumber.is(astNode)) {
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

	protected override visitValue(node: DataflowGraphVertexValue): void {
		const astNode = this.config.dfg.idMap?.get(node.id);
		if(RNumber.is(astNode)) {
			this.numbers.push(astNode.content);
		}
	}

	public getNumbers(): RNumberValue[] {
		return this.numbers;
	}
}

class CollectSourcesSemanticVisitor extends SemanticCfgGuidedVisitor {
	private sources: string[] = [];

	protected override onAssignmentCall({ source }: { source?: NodeId }): void {
		if(source) {
			this.sources.push(RNode.lexeme(this.getNormalizedAst(source)) ?? '??');
		}
	}

	public getSources(): string[] {
		return this.sources;
	}
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Control-Flow-Graph
 */
export class WikiCfg extends DocMaker<'wiki/Control Flow Graph.md'> {
	constructor() {
		super('wiki/Control Flow Graph.md', module.filename, 'control flow graph');
	}

	public async text({ ctx, shell }: DocMakerArgs): Promise<string> {
		return `
_flowR_ produces three main perspectives of the program: 1)&nbsp;a ${ctx.linkPage('wiki/Normalized AST', 'normalized version of the AST')}, 
2)&nbsp;a ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}, and 3)&nbsp;a control flow graph&nbsp;(CFG).
flowR uses this CFG interweaved with its data flow analysis and for some of its queries (e.g., to link to the last call in a ${linkToQueryOfName('call-context')}).

Please note that the control flow graph is a view on the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')},
similar to the ${ctx.linkPage('wiki/Dataflow Graph', 'call graph', 'perspectives-cg')}.

${
	block({
		type:    'TIP',
		content: `If you want to investigate the Control Flow Graph,
you can use the ${getReplCommand('controlflow*')} command in the REPL (see the ${ctx.linkPage('wiki/Interface', 'Interface wiki page')} for more information).
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

${
	block({
		type:    'TIP',
		content: `FlowR provides you with various helper objects to work with the CFG, such as ${ctx.link('CfgEdge', undefined, { type: 'variable' })} and ${ctx.link('CfgVertex', undefined, { type: 'variable' })}, 
		which you can use to easily access the properties of the CFG and its vertices and edges.`
	})
}

${section('Initial Overview', 2, 'cfg-overview')}

For now, let's look at a CFG for a program without any branching:

${codeBlock('r', 'x <- 2 * 3 + 1')}

The corresponding CFG is a directed, labeled graph with two kinds of edges: flow edges and control edges.

${await printCfgCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart LR\n', ctx })}

${block({
	type:    'IMPORTANT',
	content: 'Edges are in flow order: an edge from `a` to `b` means that `b` is evaluated after `a`. Use `outgoingEdges` (or `successors`) to ask what may run next and `ingoingEdges` (or `predecessors`) to ask what ran before. The [visitors](#cfg-working) can walk either way.'
})}

Every vertex of the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')} is a vertex here as well, carrying the same id
and hence linking back to the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')}.
The control flow is modeled in post-order, so an expression such as \`2 * 3\` is reached once both operands have been
evaluated: the \`*\` vertex itself is where the calculation is over, and no extra node is needed.

To gain a better understanding, let's have a look at a simple program with a single branching structure:

${await printCfgCode(shell, 'if(u) 3 else 2', { showCode: true, openCode: false, prefix: 'flowchart LR\n', ctx })}

The condition \`u\` runs first and splits into the two branches, which join again on the \`if\` vertex itself.
The \`if\` is therefore where the structure is left (see the [structure](#cfg-structure) section for more details).

Standing on \`u\`, the edges leaving it are control edges that name the \`if\`, so what a condition belongs to can be
read off locally. ${ctx.linkM(ControlFlowGraph, 'decides')} lists the constructs a vertex decides,
and ${ctx.linkM(ControlFlowGraph, 'entryOf')} goes the other way, from the \`if\` to the condition it starts with.

For you to compare, the following shows the CFG of an \`if\` without an \`else\` branch:

${await printCfgCode(shell, 'if(u || v) 3', { showCode: true, openCode: false, prefix: 'flowchart LR\n', ctx })}

The \`||\` branches as well, as it only evaluates \`v\` when \`u\` did not already decide the answer.

Basic blocks group what always runs together. A block ends where the flow may go more than one way, and starts
where more than one way may arrive:

${await printCfgCode(shell, 'x <- 1\ny <- x + 2\nif(y) print(y)', { showCode: true, openCode: false, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], ctx })}

Compacting them is easier to read (although the reconstructed code can be slightly misleading, as flowR tries its
best to make it syntactically correct and hence adds closing braces which are technically not part of the block):

${await printCfgCode(shell, 'x <- 1\ny <- x + 2\nif(y) print(y)', { showCode: true, openCode: false, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], simplify: true, ctx })}

Branch-heavy code gains nothing from this: in \`if(u || v) 3\` every vertex may be reached or left in more than
one way, so every block holds a single vertex.

The control flow graph also harmonizes with function definitions, and calls:

${await printCfgCode(shell, 'f <- function() { 3 }\nf()', { showCode: true, openCode: true, prefix: 'flowchart LR\n', ctx })}

${section('Structure of the Control Flow Graph', 2, 'cfg-structure')}

You can produce your very own control flow graph with ${ctx.link(extractCfg)}.
The ${ctx.link(ControlFlowGraph)} class describes everything required to model the control flow graph, with its edge types described by
 ${ctx.link('CfgEdge')} and its vertices by ${ctx.link('CfgVertex')}.
However, you should be aware of the ${ctx.link('ControlFlowInformation')} interface which adds some additional information the CFG
(and is used during the construction of the CFG as well):

${ctx.hierarchy('ControlFlowInformation', { openTop: true })}

To check whether the CFG has the expected shape, you can use the test function ${ctx.link('assertCfg')} which supports testing for
 sub-graphs as well (it provides diffing capabilities similar to ${ctx.link('assertDataflow')}).
As the CFG may become unhandy for larger programs, there are simplifications available with ${ctx.link(simplifyControlFlowInformation)}
(the ${ctx.linkPage('wiki/Analyzer', 'analyzer')} applies the ones you ask for when you request the control flow).

${section('CFG Vertices', 3, 'cfg-structure-vertices')}

All vertex types are summarized in the ${ctx.link('CfgVertexType')} enum which currently contains the following types:

${enumMembers(CfgVertexType).map(([name, value]) => `- \`${name}\` (${value})`).join('\n')}

We use the ${ctx.link('CfgBasicBlockVertex')} to represent [basic blocks](#cfg-basic-blocks) and separate
expressions (${ctx.link('CfgExpressionVertex')}) and statements (${ctx.link('CfgStatementVertex')}) 
as control flow units with and without side effects (if you want to, you can see view statements as effectful expressions).

Every vertex corresponds to a vertex of the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}: the control flow
is modeled in post-order, so a vertex is reached once everything it is made of has been evaluated, which makes it the
point at which the construct is left. That is why there are no separate marker vertices to close an \`if\` or a loop.

In mermaid visualizations, we use rectangles for statements and rounded rectangles for expressions.
Blocks are visualized as boxes around the contained vertices.

${block({
	type:    'NOTE',
	content: `
	Every CFG vertex has a ${ctx.link('NodeId')} that links it to the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} (although basic blocks will find no counterpart as they are a structuring element of the CFG).
	Additionally, it may provide information on the called functions (in case that the current element is a function call).
	Additionally, a function definition names the vertices of its body as children, which is the only way into that region.
		`.trim()
})}

${section('CFG Edges', 3, 'cfg-structure-edges')}

Every edge points the way execution goes: an edge from \`a\` to \`b\` means that \`b\` runs after \`a\`.
There are two kinds, told apart by the ${ctx.link('CfgEdgeType')} enum.

${section('Flow Edges', 4, 'cfg-flow-edge')}

A flow edge says that the target simply runs next. In \`x; y\` there is one from \`x\` to \`y\`:

${await printCfgCode(shell, 'x; y', { showCode: false, prefix: 'flowchart LR\n', ctx })}

${section('Control Edges', 4, 'cfg-control-edge')}

A control edge says the same, but only when a condition holds, which is how the branches of an \`if\` or the
body of a loop are attached. Diagrams draw these dashed.

The edge *is* the ${ctx.link('ControlDependency')} it stands for, the same one the vertices behind it carry in
their \`cds\`, so it names the deciding vertex, whether it is the true or the false case, and whether the
decision comes from iterating a loop:

${ctx.hierarchy('ControlDependency', { openTop: true })}


${await (async() => {
	const exa = await printCfgCode(shell, 'if(u) 3 else 2', { showCode: true, prefix: 'flowchart LR\n', ctx });
	return details('Example: if-else', exa);
})()}

${await (async() => {
	const exa = await printCfgCode(shell, 'while(u) b', { showCode: true, prefix: 'flowchart LR\n', ctx });
	return details('Example: while-loop', exa);
})()}
<br/>

Please note that repeat loops have no control edges, as they repeat their body unconditionally.
Additionally, the control flow graph does not have to be connected. If you use a repeat without any exit condition,
the loop is never left, so its vertex is not reachable from the entry:

${await (async() => {
	const exa = await printCfgCode(shell, 'repeat { b }; after', { showCode: true, prefix: 'flowchart LR\n', ctx });
	return details('Example: repeat-loop (infinite)',  exa);
})()}

${await (async() => {
	const exa = await printCfgCode(shell, 'repeat { b; if(u) break; }; after', { showCode: true, prefix: 'flowchart LR\n', ctx });
	return details('Example: repeat-loop (with break)',  exa);
})()}
<br/>

For a for-loop, the control edge says whether the sequence still has values to iterate over.

${await (async() => {
	const exa = await printCfgCode(shell, 'for(i in 1:10) b', { showCode: true, prefix: 'flowchart LR\n', ctx });
	return details('Example: for-loop', exa);
})()}

${section('Extra: Call Links', 4, 'cfg-call-links')}

The control flow graph is a view on the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}: the dataflow analysis
records the control flow while it walks the program, and ${ctx.link(extractCfg)} projects it into the shape the control
flow analyses expect. Because of that, the interprocedural knowledge the dataflow analysis gained is available without
a second pass over the program.

Control flow itself stays intra-procedural. A call does not flow into the body of what it calls, and the body of a
function definition is not entered when the definition is evaluated &dash; it only produces the closure. What a call
may reach is named separately:

${await printCfgCode(shell, 'f <- function() b; f()', { showCode: true, prefix: 'flowchart LR\n', ctx })}

A _calls_ attribute attached to the function call vertex holds the ${ctx.link('NodeId')} of the function definitions that
are called from this vertex, taken from the \`calls\` edges the dataflow analysis resolved.

For built-in functions that are provided by flowR's built-in configuration (see the ${ctx.linkPage('wiki/Interface', 'interface wiki page')}) the CFG does not contain
the additional information directly:

${await printCfgCode(shell, 'print(3)', { showCode: true, prefix: 'flowchart LR\n', ctx })}

This is due to the fact that the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')} does contain the required call information (and there are no new control vertices to add as the built-in call has no target in the source code):

${await printDfGraphForCode(shell, 'print(3)', { showCode: true, ctx })}

${section('Adding Basic Blocks', 3, 'cfg-basic-blocks')}

As mentioned in the introduction, our control flow graph does not use basic blocks by default and hence simply links all vertices independent of whether they have (un-)conditional jumps or not.
On the upside, this tells us the execution order (and, in case of promises, forcing order) of involved expressions and seamlessly handles cases like
\`x <- return(3)\`.  On the downside, this makes it hard to apply classical control flow graph algorithms and, in general, makes the graph much harder to read.
Yet, we can request basic blocks or transform an existing CFG into basic blocks using the ${ctx.link(convertCfgToBasicBlocks)} function.

Any program without any (un-)conditional jumps now contains a single basic block:

${await printCfgCode(shell, 'x <- 2 * 3 + 1', { showCode: true, openCode: true, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], simplify: true, ctx })}

While the CFG without basic blocks is much bigger:

${await printCfgCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart LR\n', ctx })}

In a way, using the basic blocks perspective does not remove any of these vertices (we just usually visualize them compacted as their execution order should be "obvious").
The vertices are still there, as elems of the ${ctx.link('CfgBasicBlockVertex')}:

${await printCfgCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], simplify: false, ctx })}

The benefit (for comprehensibility and algorithms) becomes more apparent when we look at a more complicated program:

${codeBlock('r', CfgLongExample)}

With basic blocks, this code looks like this:

${await printCfgCode(shell, CfgLongExample, { showCode: false, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], simplify: true, ctx })}

Now, without basic blocks, this is a different story...

${await (async() => {
	const exa = await printCfgCode(shell, CfgLongExample, { showCode: false, prefix: 'flowchart LR\n', ctx });
	return details('The full CFG', exa);
})()}

And again it should be noted that even though the example code is more complicated, this is still far from the average real-world script.

${section('Working with the CFG', 2, 'cfg-working')}

There is a plethora of functions that you can use the traverse the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} and the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}.
Similarly, flowR provides you with a set of utility functions and classes that you can use to interact with the control flow graph:

* ${ctx.link(visitCfgInOrder)} and ${ctx.link(visitCfgInReverseOrder)} for simple traversals
* ${ctx.link(BasicCfgGuidedVisitor)}, ${ctx.link(SyntaxAwareCfgGuidedVisitor)}, ${ctx.link(DataflowAwareCfgGuidedVisitor)}, and ${ctx.link(SemanticCfgGuidedVisitor)} for more sophisticated traversals
* ${ctx.link('CfgEdge', undefined, { type: 'variable' })} and ${ctx.link('CfgVertex', undefined, { type: 'variable' })} for easy access to the properties of the CFG and its vertices and edges
* ${ctx.link(assertCfgSatisfiesProperties)} and ${ctx.link('CfgProperties')} to check for properties of the CFG
* ${ctx.link(diffOfControlFlowGraphs)} to diff two CFGs

${section('Simple Traversal', 3, 'cfg-simple-traversal')}

If you are just interested in traversing the vertices within the cfg, two simple functions
${ctx.link(visitCfgInOrder)} and ${ctx.link(visitCfgInReverseOrder)} are available. For [basic blocks](#cfg-basic-blocks)
these will automatically traverse the elements contained within the blocks (in the respective order).
For example, the following function will return all numbers contained within the CFG:

${ctx.code(sampleCollectNumbers)}

Calling it with the CFG and AST of the expression \`x - 1 + 2L * 3\` yields the following elements (in this order):

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const collected = sampleCollectNumbers(res.info, res.ast);
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

A more useful appearance of these visitors occurs with ${ctx.link(happensBefore)} which uses the CFG to determine whether the execution
of one vertex always, maybe, or never happens before another vertex (see the corresponding ${linkToQueryOfName('happens-before', 'query documentation')} for more information).


${section('Diffing and Testing', 3, 'cfg-diff-and-test')}

As mentioned above, you can use the test function ${ctx.link('assertCfg')} to check whether the control flow graph has the desired shape.
The function supports testing for sub-graphs as well (it provides diffing capabilities similar to ${ctx.link('assertDataflow')}).
If you want to diff two control flow graphs, you can use the ${ctx.link(diffOfControlFlowGraphs)} function.

${section('Checking Properties', 4, 'cfg-check-properties')}

To be a valid representation of the program, the CFG should satisfy a collection of properties that, in turn, you can automatically assume to hold
when working with it. In general, we verify these in every unit test using ${ctx.link(assertCfgSatisfiesProperties)},
and you can have a look at the active properties by checking the ${ctx.link('CfgProperties')} object.
In general, we check for a hammock graph (given that the program contains no definite infinite loop) and the absence of direct cycles.

${section('Sophisticated CFG Traversal', 3, 'cfg-traversal')}

The [simple traversal](#cfg-simple-traversal) functions are great for simple tasks, but very unhandy when you want to do something more sophisticated
that incorporates language semantics such as function calls. Hence, we provide a series of incrementally more sophisticated (but complex)
visitors that incorporate various alternative perspectives:

- [Basic CFG Visitor](#cfg-traversal-basic):\\
  As a class-based version of the [simple traversal](#cfg-traversal-basic) functions
- [Syntax-Aware CFG Visitor](#cfg-traversal-syntax):\\
  If you want directly incorporate the type of the respective vertex in the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} into your visitor
- [Dataflow-Aware CFG Visitor](#cfg-traversal-dfg):\\
  If you require the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow information')} as well (e.g., to track built-in function calls, ...)
- [Semantic CFG Visitor](#cfg-traversal-semantic):\\
  Currently the most advanced visitor that combines syntactic with dataflow information.

The later ones need the dataflow graph and the ast as well. As the CFG is a view on the dataflow graph, and that
graph knows the ast, ${ctx.link(cfgVisitorConfig)} takes both from the control flow you hand it:

${codeBlock('ts', "new MyVisitor(cfgVisitorConfig({ controlFlow, defaultVisitingOrder: 'forward' }))")}

${section('Basic CFG Visitor', 4, 'cfg-traversal-basic')}

The ${ctx.link(BasicCfgGuidedVisitor)} class essential provides the same functionality as the [simple traversal](#cfg-simple-traversal) functions but in a class-based version.
Using it, you can select whether you want to traverse the CFG in order or in reverse order.

To replicate the number collector from above, you can use the following code:

${ctx.code(CollectNumbersVisitor)}

Instead of directly calling ${ctx.link(visitCfgInOrder)} we pass the \`forward\` visiting order to the constructor of the visitor.
Executing it with the CFG and AST of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersVisitor(res.info, res.ast);
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}


${section('Syntax-Aware CFG Visitor', 4, 'cfg-traversal-syntax')}

The ${ctx.link(SyntaxAwareCfgGuidedVisitor)} class incorporates knowledge of the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} into the CFG traversal and
directly provides specialized visitors for the various node types.
Now, our running example of collecting all numbers simplifies to this:

${ctx.code(CollectNumbersSyntaxVisitor)}

And again, executing it with the CFG and AST of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersSyntaxVisitor(res.info, res.ast);
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

${section('Dataflow-Aware CFG Visitor', 4, 'cfg-traversal-dfg')}

There is a lot of benefit in incorporating the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow information')} into the CFG traversal, as it contains
information about overwritten function calls, definition targets, and so on.
Our best friend is the ${ctx.link(Dataflow.origin)} function which provides the important information about the origin of a vertex in the dataflow graph.
The ${ctx.link(DataflowAwareCfgGuidedVisitor)} class does some of the basic lifting for us.
While it is not ideal for our goal of collecting all numbers, it shines in other areas such as collecting all used variables,&nbsp;...

${ctx.code(CollectNumbersDataflowVisitor)}

Again, executing it with the CFG and Dataflow of the expression \`x - 1 + 2L * 3\`, causes the following numbers to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x - 1 + 2L * 3');
	const visitor = new CollectNumbersDataflowVisitor(cfgVisitorConfig({ controlFlow: res.info, defaultVisitingOrder: 'forward' }));
	visitor.start();
	const collected = visitor.getNumbers();
	return collected.map(n => '\n- `' + JSON.stringify(n) + '`').join('');
})()}

${section('Semantic CFG Visitor', 4, 'cfg-traversal-semantic')}

The ${ctx.link(SemanticCfgGuidedVisitor)} class is flowR's most advanced visitor that combines the syntactic and dataflow information.
The main idea is simple, it provides special handlers for assignments, conditionals, and other R semantics but still follows
the structure of the CFG.

${block({
	type:    'NOTE',
	content: `This visitor is still in the design phase so please open up a [new issue](${NewIssueUrl}) if you have any suggestions or find any bugs.`
})}

To explore what it is capable of, let's create a visitor that prints all values that are used in assignments:

${ctx.code(CollectSourcesSemanticVisitor)}

Executing it with the CFG and Dataflow of the expression \`x <- 2; 3 -> x; assign("x", 42 + 21)\`, causes the following values&nbsp;(/lexemes) to be collected:

${await (async() => {
	const res = await getCfg(shell, 'x <- 2; 3 -> x; assign("x", 42 + 21)');
	const visitor = new CollectSourcesSemanticVisitor(cfgVisitorConfig({ controlFlow: res.info, ctx: contextFromInput(''), defaultVisitingOrder: 'forward' }));
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
				const doc = prefixLines(ctx.doc(`SemanticCfgGuidedVisitor::${key}`), '  ');
				return `- ${ctx.link(`SemanticCfgGuidedVisitor::${key}`)}\\\n${doc ?? '_no documentation available_'}\n`;
			}
		).join('\n')
}


${section('Working With Exit Points', 3, 'cfg-exit-points')}

With the ${ctx.linkPage('wiki/Dataflow Graph')} you already get a \`${DfEdge.typeToName(EdgeType.Returns)}\` edge that tells you what a function call returns 
(given that this function call does neither transform nor create a value).
But the control flow perspective gives you more! Given a simple addition like \`x + 1\`, the CFG looks like this:

${await printCfgCode(shell, 'x + 1', { showCode: true, prefix: 'flowchart LR\n', ctx })}

The control flow is modeled in post-order: a vertex is reached once everything it is made of has been evaluated.
For the addition above that means both operands come first and the \`+\` vertex itself is where they join again,
so the vertex of an expression *is* its exit point &dash; there are no separate marker vertices.

${details('Example: Where an if joins again', await (async function() {
	const expr = 'if(u) 3 else 2';
	const cfg = await getCfg(shell, expr);
	const [ifVertexId, ifVertex] = [...cfg.info.graph.vertices()].filter(([n]) => cfg.ast.idMap.get(n)?.lexeme === 'if')[0];
	guard(CfgVertex.isStatement(ifVertex) || CfgVertex.isExpression(ifVertex));

	return `${await printCfgCode(shell, expr, { showCode: true, prefix: 'flowchart LR\n', ctx })}

Both branches of the if (with id \`${ifVertexId}\`) flow into the if vertex itself, which is therefore the single
point at which the statement is left, whichever branch ran.
	`;
})())}

Hence, the vertex of an expression names all of its exits, which is what keeps the graph a hammock graph without
any auxiliary vertices.

${block({
	type:    'WARNING',
	content: 'Using basic blocks, this works just the same. However, please keep in mind that the vertex a control statement joins on does not have to be part of the same basic block as the branches leading to it.'
})}

`;
	}
}
