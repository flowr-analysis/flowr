import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import { mermaidHide, getTypesFromFolderAsMermaid, shortLink, printHierarchy } from './doc-util/doc-types';
import path from 'path';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getReplCommand } from './doc-util/doc-cli-option';
import { block, section } from './doc-util/doc-structure';
import { printCFGCode } from './doc-util/doc-cfg';
import { visitCfgInReverseOrder } from '../control-flow/simple-visitor';
import { CfgVertexType, ControlFlowGraph } from '../control-flow/control-flow-graph';
import { simplifyControlFlowInformation } from '../control-flow/cfg-simplification';
import { extractCFG } from '../control-flow/extract-cfg';

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

The corresponding CFG is a directed, labeled graph with three types of edges (control, flow, and call dependencies):

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart RL\n' })}

Every normalized node of the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) that has any relevance to the
execution is added and automatically linked using its id (similarly to vertices of the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph)).
Expressions, such as \`2 * 3\` get an additional node with an artificial id that ends in \`-exit\` to mark whenever their calculation is over.

To gain a better understanding, let's have a look at a simple program with a single branching structure:

${await printCFGCode(shell, 'if(u) 3 else 2', { showCode: true, openCode: true, prefix: 'flowchart RL\n' })}

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

${printHierarchy({ info: types.info, root: 'ControlFlowInformation', program: types.program })}

To check whether the CFG has the expected shape, you can use the test function ${shortLink('assertCfg', testTypes.info)} which supports testing for
 sub-graphs as well (it provides diffing capabilities similar to ${shortLink('assertDataflow', testTypes.info)}).
As the CFG may become unhandy for larger programs, there are simplifications available with ${shortLink(simplifyControlFlowInformation.name, types.info)}
(these can be passed on to the ${shortLink(extractCFG.name, types.info)} function as well).

${section('CFG Vertices', 3, 'cfg-structure-vertices')}

All vertex types are summarized in the ${shortLink('CfgVertexType', types.info)} enum which currently contains the following types:

${Object.entries(CfgVertexType).map(([key, value]) => `- \`${key}\` (${value})`).join('\n')}

We describe each of them in the following:

${section('CFG Edges', 3, 'cfg-structure-edges')}



${section('Adding Basic Blocks', 2, 'cfg-basic-blocks')}

Foo bar

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
