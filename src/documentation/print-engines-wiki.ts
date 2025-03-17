import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';


import { autoGenHeader } from './doc-util/doc-auto-gen';
import { getTypesFromFolderAsMermaid, mermaidHide, shortLink } from './doc-util/doc-types';
import path from 'path';
import { RShellExecutor } from '../r-bridge/shell-executor';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getCliLongOptionOf } from './doc-util/doc-cli-option';
import { block } from './doc-util/doc-structure';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('src/r-bridge/lang-4.x/tree-sitter/'),
		files:       [path.resolve('./src/config.ts'), path.resolve('./src/r-bridge/shell.ts'), path.resolve('./src/r-bridge/shell-executor.ts')],
		typeName:    'FlowrConfigOptions',
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'engines', rVersion: rversion })}

To analyze R scripts, flowR needs to parse the R code and for that, we require a parser.
Originally, flowR shipped with an ${shortLink(RShell.name, types.info)}, an asynchronous interface to the R interpreter, still available today.
Later we extended this with the ${shortLink(RShellExecutor.name, types.info)}, the synchronous counterpart to the ${shortLink(RShell.name, types.info)}.
However, these interfaces are relatively slow as they require communication with an underlying R interpreter. 
Using [tree-sitter](https://tree-sitter.github.io/tree-sitter/), with its [node bindings](https://github.com/tree-sitter/node-tree-sitter)
and [R grammar](https://github.com/r-lib/tree-sitter-r), we can provide the ${shortLink(TreeSitterExecutor.name, types.info)} which
is synchronous, faster, and no longer needs an R installation, but requires the appropriate bindings.
To allow users of R to freely choose their backend between the R interpreter and the tree-sitter parser,
we provide the concept of engines. 

Engines can be loaded with [flowR's configuration file](${FlowrWikiBaseRef}/Interface#configuring-flowr). Additionally, they
are exposed with some command line options (e.g., when using the docker image of flowR):

- ${getCliLongOptionOf('flowr', 'engine.r-shell.disabled', false)} to disable the ${shortLink(RShell.name, types.info)} engine
- ${getCliLongOptionOf('flowr', 'engine.r-shell.r-path', false)} (which is the canonical version of ${getCliLongOptionOf('flowr', 'r-path')})
- ${getCliLongOptionOf('flowr', 'engine.tree-sitter.disabled', false)} to disable the ${shortLink(TreeSitterExecutor.name, types.info)} engine
- ${getCliLongOptionOf('flowr', 'engine.tree-sitter.lax', false)} to use lax parsing with tree-sitter
- ${getCliLongOptionOf('flowr', 'engine.tree-sitter.wasm-path', false)} pass the path to the wasm of the r grammar of tree-sitter (see [below](#tree-sitter))
- ${getCliLongOptionOf('flowr', 'engine.tree-sitter.tree-sitter-wasm-path', false)} pass the path to the wasm of tree-sitter (see [below](#tree-sitter))
- ${getCliLongOptionOf('flowr', 'default-engine', false)} to set the default engine to use

<a id="tree-sitter"></a>
## Dealing with the Tree-Sitter Engine

${
	block({
		type:    'WARNING',
		content: 'As the tree-sitter engine is only for parsing, it cannot execute R code.'
	})
}

In general, there is no need for you to pass custom paths using either 
${getCliLongOptionOf('flowr', 'engine.tree-sitter.wasm-path', false)} or
${getCliLongOptionOf('flowr', 'engine.tree-sitter.tree-sitter-wasm-path', false)}.
However, you may want to experiment with the R grammar or provide a newer
one in case that of _flowR_ is outdated. 

To use a newer [R grammar](https://github.com/r-lib/tree-sitter-r),
you first must build the new wasm file. For this you have to:

1. Install the dependencies with \`npm ci\` in the tree-sitter-r repository.
2. Build the wasm using \`tree-sitter build --wasm .\` the [tree sitter cli](https://github.com/tree-sitter/tree-sitter)
   which should be a dev dependency.
3. Pass the \`tree-sitter-r.wasm\` to flowR. 

For tree-sitter, please rely on the [releases](https://github.com/tree-sitter/tree-sitter/releases).

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
