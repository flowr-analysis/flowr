import { RShell } from '../r-bridge/shell';
import { FlowrGithubBaseRef, FlowrWikiBaseRef, getFileContentFromRoot } from './doc-util/doc-files';
import { getCliLongOptionOf, getReplCommand, multipleCliOptions } from './doc-util/doc-cli-option';
import { printServerMessages } from './doc-util/doc-server-message';
import { documentAllServerMessages } from './data/server/doc-data-server-messages';
import { codeBlock } from './doc-util/doc-code';
import type { FileAnalysisRequestMessage } from '../cli/repl/server/messages/message-analysis';
import { fileProtocol, removeRQuotes } from '../r-bridge/retriever';
import { DockerName } from './doc-util/doc-docker';
import { documentReplSession, printReplHelpAsMarkdownTable } from './doc-util/doc-repl';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { type FlowrConfigOptions, DropPathsOption, flowrConfigFileSchema, InferWorkingDirectory, VariableResolve } from '../config';
import { describeSchema } from '../util/schema';
import { markdownFormatter } from '../util/text/ansi';
import { defaultConfigFile } from '../cli/flowr-main-options';
import { NewIssueUrl } from './doc-util/doc-issue';
import { block } from './doc-util/doc-structure';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import type { KnownParser } from '../r-bridge/parser';
import type { GeneralDocContext } from './wiki-mk/doc-context';
import { BuiltInProcName } from '../dataflow/environments/built-in';
import { explainWritingCode } from './data/interface/doc-writing-code';

async function explainServer(parser: KnownParser): Promise<string> {
	documentAllServerMessages();

	return `
As explained in the [Overview](${FlowrWikiBaseRef}/Overview), you can simply run the [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)&nbsp;server by adding the ${getCliLongOptionOf('flowr', 'server', true)} flag (and, due to the interactive mode, exit with the conventional <kbd>CTRL</kbd>+<kbd>C</kbd>).
Currently, every connection is handled by the same underlying \`${RShell.name}\` - so the server is not designed to handle many clients at a time.
Additionally, the server is not well guarded against attacks (e.g., you can theoretically spawn an arbitrary number of&nbsp;${RShell.name} sessions on the target machine).

Every message has to be given in a single line (i.e., without a newline in-between) and end with a newline character. Nevertheless, we will pretty-print example given in the following segments for the ease of reading.

${
	block({
		type:    'NOTE',
		content: `
The default ${getCliLongOptionOf('flowr', 'server', false)} uses a simple [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)
connection. If you want _flowR_ to expose a [WebSocket](https://de.wikipedia.org/wiki/WebSocket) server instead, add the ${getCliLongOptionOf('flowr', 'ws', false)} flag (i.e., ${multipleCliOptions('flowr', 'server', 'ws')}) when starting _flowR_ from the command line.
			`
	})
}

${await printServerMessages(parser)}

### 📡 Ways of Connecting

If you are interested in clients that communicate with _flowR_, please check out the [R adapter](${FlowrGithubBaseRef}/flowr-r-adapter)
as well as the [Visual Studio Code extension](${FlowrGithubBaseRef}/vscode-flowr). 

<ol>

<li>
<a id="using-netcat-without-websocket"></a>Using Netcat

<details>

<summary>Without Websocket</summary>

Suppose, you want to launch the server using a docker container. Then, start the server by (forwarding the internal default port):

${codeBlock('shell', `docker run -p1042:1042 -it --rm ${DockerName} --server`)}

Now, using a tool like [_netcat_](https://linux.die.net/man/1/nc) to connect:

${codeBlock('shell', 'nc 127.0.0.1 1042')}

Within the started session, type the following message (as a single line) and press enter to see the response:

${codeBlock('json', removeRQuotes(JSON.stringify({ type: 'request-file-analysis', content: 'x <- 1', id: '1' } satisfies FileAnalysisRequestMessage)))}

</details>
</li>

<li> Using Python
<details>
<summary>Without Websocket</summary>

In Python, a similar process would look like this. After starting the server as with using [netcat](#using-netcat-without-websocket), you can use the following script to connect:

${codeBlock('python', `
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect(('127.0.0.1', 1042))
    print(s.recv(4096))  # for the hello message

    s.send(b'${removeRQuotes(JSON.stringify({ type: 'request-file-analysis', content: 'x <- 1', id: '1' } satisfies FileAnalysisRequestMessage))}\\n')

    print(s.recv(65536))  # for the response (please use a more sophisticated mechanism)
`)}

</details>
</li>

</ol>

`;
}


async function explainRepl(parser: KnownParser, ctx: GeneralDocContext): Promise<string> {
	return `
> [!NOTE]
> To execute arbitrary R commands with a repl request, _flowR_ has to be started explicitly with ${ctx.cliOption('flowr', 'r-session-access')}.
> Please be aware that this introduces a security risk and note that this relies on the ${ctx.linkPage('wiki/Engines', '`r-shell` engine')} .

Although primarily meant for users to explore, 
there is nothing which forbids simply calling _flowR_ as a subprocess to use standard-in, -output, and -error 
for communication (although you can access the REPL using the server as well, 
with the [REPL Request](#message-request-repl-execution) message).

The read-eval-print loop&nbsp;(REPL) works relatively simple.
You can submit an expression (using <kbd>Enter</kbd>),
which is interpreted as an R&nbsp;expression by default but interpreted as a *command* if it starts with a colon (\`:\`).
The best command to get started with the REPL is ${ctx.replCmd('help')}.
Besides, you can leave the REPL either with the command ${ctx.replCmd('quit')} or by pressing <kbd>Ctrl</kbd>+<kbd>C</kbd> twice.
When writing a *command*, you may press <kbd>Tab</kbd> to get a list of completions, if available.
Multiple commands can be entered in a single line by separating them with a semicolon (\`;\`), e.g. \`:parse "x<-2"; :df*\`.
If a command is given without R code, the REPL will re-use R code given in a previous command. 
The prior example will hence return first the parsed AST of the program and then the dataflow graph for \`"x <- 2"\`.

> [!NOTE]
> If you develop flowR, you may want to launch the repl using the \`npm run main-dev\` command, this way, you get a non-minified version of flowR with debug information and hot-reloading of source files.

<details>
<summary>Available Commands</summary>

We currently offer the following commands (this with a \`[*]\` suffix are available with and without the star):

${printReplHelpAsMarkdownTable()}

</details>

${
	block({
		type:    'TIP',
		content: `
As indicated by the examples before, all REPL commands that operate on code keep track of the state.
Hence, if you run a command like ${getReplCommand('dataflow*')} without providing R code,
the REPL will re-use the R code provided in a previous command.
Likewise, doing this will benefit from incrementality!
If you request the dataflow graph with \`:df* x <- 2 * y\` and then want to see the parsed AST with \`:parse\`,
the REPL will re-use previously obtained information and not re-parse the code again.
		`
	})
}

Generally, many commands offer shortcut versions in the REPL. Many queries, for example, offer a shortened format (see the example below).
Of special note, the ${ctx.linkPage('wiki/Query API', 'Config Query', 'Config-Query')}
can be used to also modify the currently active configuration of _flowR_ within the REPL (see the ${ctx.linkPage('wiki/Query API', 'wiki page', 'Config-Query')} for more information).

### Example: Retrieving the Dataflow Graph

To retrieve a URL to the [mermaid](https://mermaid.js.org/) diagram of the dataflow of a given expression, 
use ${ctx.replCmd('dataflow*')} (or ${ctx.replCmd('dataflow')} to get the mermaid code in the cli):

${await documentReplSession(parser, [{
	command:     ':dataflow* y <- 1 + x',
	description: `Retrieve the dataflow graph of the expression \`y <- 1 + x\`. It looks like this:\n${await printDfGraphForCode(parser, 'y <- 1 + x')}`
}])}

For small graphs like this, ${ctx.replCmd('dataflowascii')} also provides an ASCII representation directly in the REPL:

${await documentReplSession(parser, [{
	command:     ':df! y <- 1 + x',
	description: 'Retrieve the dataflow graph of the expression `y <- 1 + x` as ASCII art.'
}], { openOutput: true })}

For the slicing with ${ctx.replCmd('slicer')}, you have access to the same [magic comments](#slice-magic-comments) as with the [slice request](#message-request-slice).

### Example: Interfacing with the File System

Many commands that allow for an R-expression (like ${ctx.replCmd('dataflow*')}) allow for a file as well 
if the argument starts with \`${fileProtocol}\`. 
If you are working from the root directory of the _flowR_ repository, the following gives you the parsed AST of the example file using the ${ctx.replCmd('parse')} command:

${await documentReplSession(parser, [{
	command:     `:parse ${fileProtocol}test/testfiles/example.R`,
	description: `Retrieve the parsed AST of the example file.

<details>

<summary>File Content</summary>

${codeBlock('r', getFileContentFromRoot('test/testfiles/example.R'))}

</details>

As _flowR_ directly transforms this AST the output focuses on being human-readable instead of being machine-readable. 
		`
}])}

### Example: Run a Query

You can run any query supported by _flowR_ using the ${ctx.replCmd('query')} command.
For example, to obtain the shapes of all data frames in a given piece of code, you can run:
${await documentReplSession(parser, [{
	command:     ':query @df-shape "x <- data.frame(a = 1:10, b = 1:10)\\ny <- x$a"',
	description: 'Retrieve the shapes of all data frames in the given code.'
}], { openOutput: true })}
To run the linter on a file, you can use (in this example, we just issue the \`dead-code\` linter on a small piece of code):
${await documentReplSession(parser, [{
	command:     ':query @linter rules:dead-code "if(FALSE) x <- 2"',
	description: 'Run the linter on the given code, with only the `dead-code` rule enabled.'
}], { openOutput: true })}

For more information on the available queries, please check out the ${ctx.linkPage('wiki/Query API', 'Query API')}.
`;
}

function explainConfigFile(): string {
	return `

When running _flowR_, you may want to specify some behaviors with a dedicated configuration file. 
By default, flowR looks for a file named \`${defaultConfigFile}\` in the current working directory (or any higher directory). 
You can also specify a different file with ${getCliLongOptionOf('flowr', 'config-file')} or pass the configuration inline using ${getCliLongOptionOf('flowr', 'config-json')}.
To inspect the current configuration, you can run flowr with the ${getCliLongOptionOf('flowr', 'verbose')} flag, or use the \`config\` [Query](${FlowrWikiBaseRef}/Query%20API).
Within the REPL this works by running the following:

${codeBlock('shell', ':query @config')}

The following summarizes the configuration options:

- \`ignoreSourceCalls\`: If set to \`true\`, _flowR_ will ignore source calls when analyzing the code, i.e., ignoring the inclusion of other files.
- \`semantics\`: allows to configure the way _flowR_ handles R, although we currently only support \`semantics/environment/overwriteBuiltIns\`. 
  You may use this to overwrite _flowR_'s handling of built-in function and even completely clear the preset definitions shipped with flowR. 
  See [Configure BuiltIn Semantics](#configure-builtin-semantics) for more information.
- \`solver\`: allows to configure how _flowR_ resolves variables and their values (currently we support: ${Object.values(VariableResolve).map(v => `\`${v}\``).join(', ')}), as well as if pointer analysis should be active.
- \`engines\`: allows to configure the engines used by _flowR_ to interact with R code. See the [Engines wiki page](${FlowrWikiBaseRef}/Engines) for more information.
- \`defaultEngine\`: allows to specify the default engine to use for interacting with R code. If not set, an arbitrary engine from the specified list will be used.
- \`abstractInterpretation\`: allows to configure how _flowR_ performs abstract interpretation, although we currently only support data frame shape inference through abstract interpretation.

So you can configure _flowR_ by adding a file like the following:

<details>

<summary>Example Configuration File</summary>

${codeBlock('json', JSON.stringify(
		{
			ignoreSourceCalls: true,
			semantics:         {
				environment: {
					overwriteBuiltIns: {
						definitions: [
							{ type: 'function', names: ['foo'], processor: BuiltInProcName.Assignment, config: {} }
						]
					}
				}
			},
			repl: {
				quickStats:      false,
				dfProcessorHeat: false
			},
			project: {
				resolveUnknownPathsOnDisk: true
			},
			engines: [{ type: 'r-shell' }],
			solver:  {
				variables:     VariableResolve.Alias,
				evalStrings:   true,
				resolveSource: {
					dropPaths:             DropPathsOption.No,
					ignoreCapitalization:  true,
					inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
					searchPath:            []
				},
				instrument: {},
				slicer:     {
					threshold: 50
				}
			},
			abstractInterpretation: {
				wideningThreshold: 4,
				dataFrame:         {
					maxColNames:    20,
					readLoadedData: {
						readExternalFiles: true,
						maxReadLines:      1_000_000
					}
				}
			}
		} satisfies FlowrConfigOptions,
		null, 2))
}

</details>

<details> 
<a id='configure-builtin-semantics'></a>
<summary>Configure Built-In Semantics</summary> 


\`semantics/environment/overwriteBuiltins\` accepts two keys:

- \`loadDefaults\` (boolean, initially \`true\`): If set to \`true\`, the default built-in definitions are loaded before applying the custom definitions. Setting this flag to \`false\` explicitly disables the loading of the default definitions.
- \`definitions\` (array, initially empty): Allows to overwrite or define new built-in elements. Each object within must have a \`type\` which is one of the below. Furthermore, they may define a string array of \`names\` which specifies the identifiers to bind the definitions to. You may use \`assumePrimitive\` to specify whether _flowR_ should assume that this is a primitive non-library definition (so you probably just do not want to specify the key).

  | Type            | Description                                                                                                                                                                                                                                                                                              | Example                                                                                                    |
  | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | \`constant\`    | Additionally allows for a \`value\` this should resolve to.                                                                                                                                                                                                                                                | \`{ type: 'constant', names: ['NULL', 'NA'],  value: null }\`                                                |
  | \`function\`    | Is a rather flexible way to define and bind built-in functions. For the time, we do not have extensive documentation to cover all the cases, so please either consult the sources with the \`default-builtin-config.ts\` or open a [new issue](${NewIssueUrl}). | \`{ type: 'function', names: ['next'], processor: '${BuiltInProcName.Default}', config: { cfg: ExitPointType.Next } }\` |
  | \`replacement\` | A comfortable way to specify replacement functions like \`$<-\` or \`names<-\`. \`suffixes\` describes the... suffixes to attach automatically. | \`{ type: 'replacement', suffixes: ['<-', '<<-'], names: ['[', '[['] }\` |


</details>

<details>

<summary style='color:gray'>Full Configuration-File Schema</summary>

${describeSchema(flowrConfigFileSchema, markdownFormatter)}

</details>

	`;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Interface
 */
export class WikiInterface extends DocMaker<'wiki/Interface.md'> {
	constructor() {
		super('wiki/Interface.md', module.filename, 'interface');
	}

	protected async text({ shell, ctx, treeSitter }: DocMakerArgs): Promise<string> {
		return `
Although far from being as detailed as the in-depth explanation of ${ctx.linkPage('wiki/Core', '_flowR_')},
this wiki page explains how to interface with _flowR_ in more detail.
In general, command line arguments and other options provide short descriptions on hover over.

* [💻 Using the REPL](#using-the-repl)
* [⚙️ Configuring FlowR](#configuring-flowr)
* [⚒️ Writing Code](#writing-code)
* [💬 Communicating with the Server](#communicating-with-the-server)

<a id='using-the-repl'></a>
## 💻 Using the REPL

${await explainRepl(treeSitter, ctx)}


<a id='configuring-flowr'></a>
## ⚙️ Configuring FlowR

${explainConfigFile()}

<a id='writing-code'></a>
## ⚒️ Writing Code

${explainWritingCode(shell, ctx)}

<a id='communicating-with-the-server'></a>
## 💬 Communicating with the Server

${await explainServer(shell)}
`;
	}
}


