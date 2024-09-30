import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import { getTypesFromFolderAsMermaid } from './doc-util/doc-types';
import path from 'path';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { printAsMs } from './doc-util/doc-ms';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const now = performance.now();
	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src/r-bridge/lang-4.x/ast/model/'),
		typeName:    'RNode',
		inlineTypes: ['Leaf', 'Location', 'Namespace', 'Base', 'WithChildren', 'Partial']
	});
	const elapsed = performance.now() - now;

	return `${autoGenHeader({ filename: module.filename, purpose: 'normalized ast', rVersion: rversion })}

_flowR_ produces a normalized version of R's abstract syntax tree (AST), 
offering the following benefits. It...
 
1. abstracts away from intricacies of the R parser
2. provides a version-independent representation of the program
3. decorates the AST with additional information, e.g., parent relations and nesting information

In general, the mapping should be rather intuitive and focused primarily on the
syntactic structure of the program.
Consider the following example which shows the normalized AST of the code

${codeBlock('r', 'x <- 2 * 3 + 1')}

${await printNormalizedAstForCode(shell, 'x <- 2 * 3 + 1')}

Indicative is the root expression list node, which is present in every normalized AST.
In general, we provide node types for:

1. literals (e.g., numbers and strings)
2. references (e.g., symbols, parameters and function calls)
3. constructs (e.g., loops and function definitions)
4. branches (e.g., \`next\` and \`break\`)
5. operators (e.g. \`+\`, \`-\`, and \`*\`)

<details open>

<summary style="color:gray">Complete Class Diagram</summary>

Every node is a link, which directly refers to the implementation in the source code.
Grayed-out parts are used for structuring the AST, grouping together related nodes.

${codeBlock('mermaid', types.text)}

_The generation of the class diagram required ${printAsMs(elapsed)}._
</details>

Node types are controlled by the \`${'RType'}\` enum (see ${getFilePathMd('../r-bridge/lang-4.x/ast/model/type.ts')}), 
which is used to distinguish between different types of nodes.
Additionally, every AST node is generic with respect to the \`Info\` type which allows for arbitrary decorations (e.g., parent inforamtion or dataflow constraints).
Most notably, the \`info\` field holds the \`id\` of the node, which is used to reference the node in the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph).

`;
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
