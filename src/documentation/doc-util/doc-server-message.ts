import type { RShell } from '../../r-bridge/shell';
import { getFilePathMd } from './doc-files';
import { describeSchema } from '../../util/schema';
import { markdownFormatter } from '../../util/ansi';
import type { FlowrMessage, IdMessageBase, MessageDefinition } from '../../cli/repl/server/messages/messages';
import type { FakeServer, FakeSocket } from '../../../test/functionality/_helper/net';
import { withSocket } from '../../../test/functionality/_helper/net';
import { codeBlock } from './doc-code';
import { printAsMs } from './doc-ms';
import { guard } from '../../util/assert';

export interface ServerMessageDescription {
	readonly title:                  string
	readonly type:                   'request' | 'response'
	readonly mermaidSequenceDiagram: string
	readonly shortDescription:       string
	readonly definitionPath:         string
	readonly defRequest?:            MessageDefinition<IdMessageBase>
	readonly defResponse?:           MessageDefinition<IdMessageBase>
	readonly text:                   (shell: RShell) => Promise<string>
}

const messages: ServerMessageDescription[] = [];

export function documentServerMessage(description: ServerMessageDescription): void {
	messages.push(description);
}

export async function printServerMessages(shell: RShell): Promise<string> {
	let text = '';
	for(const message of messages) {
		text += await printServerMessage(message, shell) + '\n\n';
	}
	return text;
}

export async function inServerContext<T>(shell: RShell, fn: (socket: FakeSocket, server: FakeServer) => Promise<T> | T): Promise<T> {
	return withSocket(shell, async(socket, server) => {
		return fn(socket, server);
	})();
}

export interface MessagePingPongDocumentationArguments {
	readonly shell:                RShell,
	readonly title?:               string,
	readonly messageTypeToPresent: FlowrMessage['type'],
	readonly messagesToSend:       readonly FlowrMessage[],
	readonly documentResponses: readonly {
		readonly expectedType: FlowrMessage['type'],
		readonly description?: string
	}[]
}

function explainMsg(idx: number, msg: IdMessageBase, type: 'Request' | 'Response', desc = '', open = false): string {
	const bold: (s: string) => string = open ? s => `<b>${s}</b>` : s => s;
	return `
<details${open ? ' open' : ''}> 

<summary> (${idx}) ${type}: ${bold( '<code>' + msg.type + '</code> Message')}</summary>

${desc}

${codeBlock('json', JSON.stringify(msg, null, 2))}

</details>

`;
}

function explainPingPong(
	sent: readonly FlowrMessage[], received: readonly IdMessageBase[], receivedDescriptions: string[], messageTypeToPresent: FlowrMessage['type']
) {
	let result = `${explainMsg(0, received[0], 'Response', 'The first message is always a hello message.')}`;

	let idx = 1;
	/* we received one more than we sent (`hello` :D) */
	for(let i = 1; i < received.length; i++) {
		result += explainMsg(idx++, sent[i - 1], 'Request', '', sent[i - 1].type === messageTypeToPresent);
		result += explainMsg(idx++, received[i], 'Response', receivedDescriptions[i - 1], received[i].type === messageTypeToPresent);
	}
	return result;
}

export async function documentServerMessageResponse({
	shell, messagesToSend, documentResponses, messageTypeToPresent, title
}: MessagePingPongDocumentationArguments): Promise<string> {
	const start = performance.now();
	const response = await inServerContext(shell, async socket => {
		let messageType = 0;
		for(const message of messagesToSend) {
			socket.send(JSON.stringify(message) + '\n');
			await socket.waitForMessage(documentResponses[messageType++].expectedType);
		}
		return socket.getMessages();
	});
	const end = performance.now();
	title ??= `Example of <code>${messageTypeToPresent}</code> Message`;
	return `
<details>
<summary>${title}</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

${
	explainPingPong(messagesToSend, response, documentResponses.map(d => d.description ?? ''), messageTypeToPresent)
}

The complete round-trip took ${printAsMs(end - start)} (including time required to validate the messages, start, and stop the internal mock server).

</details>
`;
}

function getSchema(definitionPath: string, def?: MessageDefinition<IdMessageBase>): string {
	return def ? `<details>
<summary style="color:gray">Message schema (<code>${def.type}</code>)</summary>

For the definition of the hello message, please see it's implementation at ${getFilePathMd(definitionPath)}.

${describeSchema(def.schema, markdownFormatter)}

</details>
` : '';
}

async function printServerMessage({
	mermaidSequenceDiagram, text, title, type, shortDescription, definitionPath, defRequest, defResponse
}: ServerMessageDescription, shell: RShell): Promise<string> {
	const base = defRequest ?? defResponse;
	guard(base !== undefined, 'At least one of the definitions must be given');
	return `
<a id="message-${base.type}"></a>
<details>

<summary> <b>${title}</b> Message (<code>${base.type}</code>, ${type}) <br/> <i><span style="color:gray">${shortDescription}</span></i> </summary>

<details open>
<summary>Sequence Diagram</summary>

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    ${mermaidSequenceDiagram}
\`\`\`

</details>

${await text(shell)}

&nbsp;

${getSchema(definitionPath, defRequest)}
${getSchema(definitionPath, defResponse)}

</details>	
	`;
}
