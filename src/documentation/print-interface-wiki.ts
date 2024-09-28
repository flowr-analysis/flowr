import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { getCliLongOptionOf, multipleCliOptions } from './doc-util/doc-cli-option';
import { printServerMessages } from './doc-util/doc-server-message';
import { documentAllMessages } from './data/server/doc-server-messages';

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
