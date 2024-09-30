import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { codeBlock } from './doc-util/doc-code';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import {getTypesFromFolderAsMermaid} from './doc-util/doc-types';
import path from "path";

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

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

The entry type into the structure is the  

${codeBlock('mermaid', getTypesFromFolderAsMermaid({
		rootFolder: path.resolve('./src/r-bridge/lang-4.x/ast/model/'),
		typeName: 'RNode',
		inlineTypes: ['Leaf', 'Location', 'Namespace', 'Base']
	}))}


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
