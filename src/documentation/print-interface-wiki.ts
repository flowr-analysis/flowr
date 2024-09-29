import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrWikiBaseRef, getFileContentFromRoot } from './doc-util/doc-files';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { getCliLongOptionOf, getReplCommand, multipleCliOptions } from './doc-util/doc-cli-option';
import { printServerMessages } from './doc-util/doc-server-message';
import { documentAllMessages } from './data/server/doc-data-server-messages';
import { codeBlock } from './doc-util/doc-code';
import type { FileAnalysisRequestMessage } from '../cli/repl/server/messages/message-analysis';
import { fileProtocol, removeRQuotes } from '../r-bridge/retriever';
import { DockerName } from './doc-util/doc-docker';
import { documentReplSession, printReplHelpAsMarkdownTable } from './doc-util/doc-repl';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import type { FlowrConfigOptions } from '../config';
import { flowrConfigFileSchema } from '../config';
import { describeSchema } from '../util/schema';
import { markdownFormatter } from '../util/ansi';
import { defaultConfigFile } from '../cli/flowr-main-options';

async function explainServer(shell: RShell): Promise<string> {
	documentAllMessages();

	return `
As explained in the [Overview](${FlowrWikiBaseRef}/Overview), you can simply run the [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)&nbsp;server by adding the ${getCliLongOptionOf('flowr', 'server', true)} flag (and, due to the interactive mode, exit with the conventional <kbd>CTRL</kbd>+<kbd>C</kbd>).
Currently, every connection is handled by the same underlying \`${RShell.name}\` - so the server is not designed to handle many clients at a time.
Additionally, the server is not well guarded against attacks (e.g., you can theoretically spawn an arbitrary number of&nbsp;${RShell.name} sessions on the target machine).

Every message has to be given in a single line (i.e., without a newline in-between) and end with a newline character. Nevertheless, we will pretty-print example given in the following segments for the ease of reading.

> [!NOTE]
> The default ${getCliLongOptionOf('flowr', 'server', false)} uses a simple [TCP](https://de.wikipedia.org/wiki/Transmission_Control_Protocol)
> connection. If you want _flowR_ to expose a [WebSocket](https://de.wikipedia.org/wiki/WebSocket) server instead, add the ${getCliLongOptionOf('flowr', 'server', false)} flag (i.e., ${multipleCliOptions('flowr', 'server', 'ws')}) when starting _flowR_ from the command line.

${await printServerMessages(shell)}

### 📡 Ways of Connecting

If you are interested in clients that communicate with _flowR_, please check out the [R adapter](https://github.com/flowr-analysis/flowr-r-adapter)
as well as the [Visual Studio Code extension](https://github.com/flowr-analysis/vscode-flowr). 

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


async function explainRepl(shell: RShell): Promise<string> {
	return `
> [!NOTE]
> To execute arbitrary R commands with a repl request, _flowR_ has to be started explicitly with ${getCliLongOptionOf('flowr', 'r-session-access')}.
> Please be aware that this introduces a security risk.


Although primarily meant for users to explore, 
there is nothing which forbids simply calling _flowR_ as a subprocess to use standard-in, -output, and -error 
for communication (although you can access the REPL using the server as well, 
with the [REPL Request](#message-request-repl-execution) message).

The read-eval-print loop&nbsp;(REPL) works relatively simple.
You can submit an expression (using enter),
which is interpreted as an R&nbsp;expression by default but interpreted as a *command* if it starts with a colon (\`:\`).
The best command to get started with the REPL is ${getReplCommand('help')}.
Besides, you can leave the REPL either with the command ${getReplCommand('quit')} or by pressing <kbd>CTRL</kbd>+<kbd>C</kbd> twice.


<details>
<summary>Available Commands</summary>

We currently offer the following commands (this with a \`[*]\` suffix are available with and without the star):

${printReplHelpAsMarkdownTable()}

</details>


### Example: Retrieving the Dataflow Graph

To retrieve a URL to the [mermaid](https://mermaid.js.org/) diagram of the dataflow of a given expression, 
use ${getReplCommand('dataflow*')} (or ${getReplCommand('dataflow')} to get the mermaid code in the cli):

${await documentReplSession(shell, [{
		command:     ':dataflow* y <- 1 + x',
		description: `Retrieve the dataflow graph of the expression \`y <- 1 + x\`. It looks like this:\n${await printDfGraphForCode(shell, 'y <- 1 + x')}.`
	}])}

For the slicing with ${getReplCommand('slicer')}, you have access to the same [magic comments](#slice-magic-comments) as with the [slice request](#message-request-slice).

### Example: Interfacing with the File System

Many commands that allow for an R-expression (like ${getReplCommand('dataflow*')}) allow for a file as well 
if the argument starts with \`${fileProtocol}\`. 
If you are working from the root directory of the _flowR_ repository, the following gives you the parsed AST of the example file using the ${getReplCommand('parse')} command:

${await documentReplSession(shell, [{
		command:     `:parse ${fileProtocol}test/testfiles/example.R`,
		description: `Retrieve the parsed AST of the example file.

<details>

<summary>File Content</summary>	

${codeBlock('r', getFileContentFromRoot('test/testfiles/example.R'))}

</details>

As _flowR_ directly transforms this AST the output focuses on being human-readable instead of being machine-readable. 
		`
	}])}
`;
}

async function explainConfigFile(shell: RShell): Promise<string> {
	return `

When running _flowR_, you may want to specify some behaviors with a dedicated configuration file. 
By default, flowR looks for a file named \`${defaultConfigFile}\` in the current working directory (or any higher directory). 
You can also specify a different file with ${getCliLongOptionOf('flowr', 'config-file')}.
The following summarizes the configuration options:


- \`ignoreSourceCalls\`: If set to \`true\`, _flowR_ will ignore source calls when analyzing the code, i.e., ignoring the inclusion of other files.
- \`rPath\`: The path to the R executable. If not set, _flowR_ will try to find the R executable in the system's PATH.
- \`semantics\`: allows to configure the way _flowR_ handles R, although we currently only support \`semantics/environment/overwriteBuiltIns\`. 
  You may use this to overwrite _flowR_'s handling of built-in function and even completely clear the preset definitions shipped with flowR. 
  See [Configure BuiltIn Semantics](#configure-builtin-semantics) for more information.

So you can configure _flowR_ by adding a file like the following:

${codeBlock('json', JSON.stringify(
		{
			ignoreSourceCalls: true,
			rPath:             '/usr/bin/R',
			semantics:         {
				environment: {
					overwriteBuiltIns: {
						definitions: [
							{ type: 'function', names: ['foo'], processor: 'builtin:assignment', config: {} }
						]
					}
				}
			}
		} satisfies FlowrConfigOptions,
		null, 2))
}

<details> 
<a id='configure-builtin-semantics'></a>
<summary>Configure Built-In Semantics</summary> 


\`semantics/environment/overwriteBuiltins\` accepts two keys:

- \`loadDefaults\` (boolean, initially \`true\`): If set to \`true\`, the default built-in definitions are loaded before applying the custom definitions. Setting this flag to \`false\` explicitly disables the loading of the default definitions.
- \`definitions\` (array, initially empty): Allows to overwrite or define new built-in elements. Each object within must have a \`type\` which is one of the below. Furthermore, they may define a string array of \`names\` which specifies the identifiers to bind the definitions to. You may use \`assumePrimitive\` to specify whether _flowR_ should assume that this is a primitive non-library definition (so you probably just do not want to specify the key).

  | Type          | Description                                                                                                                                                                                                                                                                                              | Example                                                                                                    |
  | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | \`constant\`    | Additionally allows for a \`value\` this should resolve to.                                                                                                                                                                                                                                                | \`{ type: 'constant', names: ['NULL', 'NA'],  value: null }\`                                                |
  | \`function\`    | Is a rather flexible way to define and bind built-in functions. For the time, we do not have extensive documentation to cover all the cases, so please either consult the sources with the \`default-builtin-config.ts\` or open a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose). | \`{ type: 'function', names: ['next'], processor: 'builtin:default', config: { cfg: ExitPointType.Next } }\` |
  | \`replacement\` | A comfortable way to specify replacement functions like \`$<-\` or \`names<-\`. \`suffixes\` describes the... suffixes to attach automatically. | \`{ type: 'replacement', suffixes: ['<-', '<<-'], names: ['[', '[['] }\` |


</details>

<details>

<summary style='color:gray'>Full Configuration-File Schema</summary>

${describeSchema(flowrConfigFileSchema, markdownFormatter)}

</details>

	`;
}

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'interfaces', rVersion: rversion })}

Although far from being as detailed as the in-depth explanation of
[_flowR_](${FlowrWikiBaseRef}/Core),
this wiki page explains how to interface with _flowR_ in more detail.
In general, command line arguments and other options provide short descriptions on hover over.

- [💬 Communicating with the Server](#communicating-with-the-server)
- [💻 Using the REPL](#using-the-repl)
- [⚙️ Configuring FlowR](#configuring-flowr)
- [⚒️ Writing Code](#writing-code)

<a id='communicating-with-the-server'></a>
## 💬 Communicating with the Server

${await explainServer(shell)}

<a id='using-the-repl'></a>
## 💻 Using the REPL

${await explainRepl(shell)}

<a id='configuring-flowr'></a>
## ⚙️ Configuring FlowR

${await explainConfigFile(shell)}

<a id='writing-code'></a>
## ⚒️ Writing Code

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
