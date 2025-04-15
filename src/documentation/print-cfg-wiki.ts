import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import { mermaidHide, getTypesFromFolderAsMermaid, shortLink } from './doc-util/doc-types';
import path from 'path';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getReplCommand } from './doc-util/doc-cli-option';
import { block } from './doc-util/doc-structure';
import { NewIssueUrl } from './doc-util/doc-issue';
import { printCFGCode } from './doc-util/doc-cfg';
import { visitCfgInReverseOrder } from '../control-flow/visitor';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src'),
		typeName:    'RNode',
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'control flow graph', rVersion: rversion })}

_flowR_ produces two main perspectives of the program: 1) a [normalized version of the AST](${FlowrWikiBaseRef}/Normalized-AST)
and 2) a [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph). However, for further analyses, we also provide an explicit control flow graph 
that is calculated from the normalized AST **and** the dataflow graph to incorporate change in language semantics.
flowR also uses this CFG for some of its queries (e.g., to link to the last call in a [Call-Context Query](${FlowrWikiBaseRef}/Query-API))
but does not incorporate it into its core analysis.


${
	block({
		type:    'TIP',
		content: `If you want to investigate the Control Flow Graph,
you can use the ${getReplCommand('controlflow*')} command in the REPL (see the [Interface wiki page](${FlowrWikiBaseRef}/Interface) for more information).`
	})
}

The CFG may be a little bit uncommon compared to the classical CFG with basic blocks. This is mostly due to historical reasons. 
Please [open a new issue](${NewIssueUrl}) if you are interested in such a perspective.

But for now, let's look at a simple CFG for a program without any branching:

${codeBlock('r', 'x <- 2 * 3 + 1')}

The corresponding CFG is a directed, labeled graph with two types of edges (control and flow dependencies):

${await printCFGCode(shell, 'x <- 2 * 3 + 1', { showCode: false, prefix: 'flowchart RL\n' })}

Every normalized node of the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) that has any relevance to the
execution is added and automatically linked using its id (similarly to vertices of the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph)).
Higher expressions, such as \`2 * 3\` get an additional node with an artificial id that ends in \`-exit\` to mark whenever their calculation is over.

To gain a better understanding, let's have a look at a simple program with a single branching structure:

${await printCFGCode(shell, 'if(u) 3 else 2', { showCode: true, openCode: true, prefix: 'flowchart RL\n' })}

Here, you can see the \`if\` node followed by the condition (in this case merely \`u\`) that then splits into two branches for the two possible outcomes.
The \`if\` structure is terminated by the corresponding \`-exit\` node.

For you to compare, the following shows the CFG of an \`if\` without an \`else\` branch:

${await printCFGCode(shell, 'if(u || v) 3', { showCode: true, openCode: false, prefix: 'flowchart RL\n' })}

The control flow graph also harmonizes with function definitions, and calls:

${await printCFGCode(shell, 'f <- function() { 3 }\nf()', { showCode: true, openCode: true, prefix: 'flowchart RL\n' })}

In general, it is probably best to use the ${getReplCommand('controlflow*')} command in the REPL to investigate the CFG interactively.
Have a look at the ${shortLink(visitCfgInReverseOrder.name, types.info)} function for a generic CFG visitor.

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
