import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { getCliLongOptionOf, multipleCliOptions } from './doc-util/doc-cli-option';
import { printServerMessages } from './doc-util/doc-server-message';
import { documentAllMessages } from './data/server/doc-data-server-messages';
import { codeBlock } from './doc-util/doc-code';
import type { FileAnalysisRequestMessage } from '../cli/repl/server/messages/message-analysis';
import { removeRQuotes } from '../r-bridge/retriever';
import { DockerName } from './doc-util/doc-docker';

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


async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'interfaces', rVersion: rversion })}

Although far from being as detailed as the in-depth explanation of
[_flowR_](${FlowrWikiBaseRef}/Core),
this wiki page explains how to interface with _flowR_ in more detail.
In general, command line arguments and other options provide short descriptions on hover over.

[TODO: Table of Contents]

## 💬 Communicating with the Server

${await explainServer(shell)}

## 💻 Using the REPL

TODO: outsource fn 

> [!NOTE]
> To execute arbitrary R commands with a repl request, _flowR_ has to be started explicitly with \`--r-session-access\`.
> Please be aware, that this introduces a security risk.

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
