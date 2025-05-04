import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import { mermaidHide, getTypesFromFolderAsMermaid, shortLink, printHierarchy } from './doc-util/doc-types';
import path from 'path';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getReplCommand } from './doc-util/doc-cli-option';
import { block, details, section } from './doc-util/doc-structure';
import { printCFGCode } from './doc-util/doc-cfg';
import { visitCfgInReverseOrder } from '../control-flow/simple-visitor';
import { CfgVertexType, ControlFlowGraph } from '../control-flow/control-flow-graph';
import { simplifyControlFlowInformation } from '../control-flow/cfg-simplification';
import { extractCFG, ResolvedCallSuffix } from '../control-flow/extract-cfg';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { convertCfgToBasicBlocks } from '../control-flow/cfg-to-basic-blocks';

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

Which is probably much more readable if compacted:

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
	Every CFG vertex has a ${shortLink('NodeId', types.info)} that links it to the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) (although basic blocks will find no counterpart as they are a structuring element of the CFG.
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

${section('Adding Basic Blocks', 2, 'cfg-basic-blocks')}

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


In general, it is probably best to use the ${getReplCommand('controlflow*')} command in the REPL to investigate the CFG interactively.
Have a look at the ${shortLink(visitCfgInReverseOrder.name, types.info)} function for a generic CFG visitor.

TODO: document and link the origin function!

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
