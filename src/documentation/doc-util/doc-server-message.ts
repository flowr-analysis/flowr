import type { RShell } from '../../r-bridge/shell';
import { getFilePathMd } from './doc-files';
import { describeSchema } from '../../util/schema';
import { markdownFormatter } from '../../util/ansi';
import type { FlowrMessage, IdMessageBase, MessageDefinition } from '../../cli/repl/server/messages/all-messages';
import type { FakeServer, FakeSocket } from '../../../test/functionality/_helper/net';
import { withSocket } from '../../../test/functionality/_helper/net';
import { jsonWithLimit } from './doc-code';
import { guard } from '../../util/assert';
import { printAsMs } from '../../util/time';

export interface ServerMessageDescription {
	readonly title:                  string
	readonly type:                   'request' | 'response'
	readonly mermaidSequenceDiagram: string
	readonly shortDescription:       string
	readonly definitionPath:         string
	readonly defRequest?:            MessageDefinition<IdMessageBase>
	readonly defResponse?:           MessageDefinition<IdMessageBase>
	readonly additionalDefs?:        MessageDefinition<IdMessageBase>[]
	readonly text:                   (shell: RShell) => Promise<string>
}

const messages: ServerMessageDescription[] = [];

export function documentServerMessage(description: ServerMessageDescription): void {
	messages.push(description);
}

export async function printServerMessages(shell: RShell): Promise<string> {
	let text = '<ul>';
	for(const message of messages) {
		text += '<li>' + await printServerMessage(message, shell) + '</li>\n\n';
	}
	return text + '</ul>';
}

export async function inServerContext<T>(shell: RShell, fn: (socket: FakeSocket, server: FakeServer) => Promise<T> | T): Promise<T> {
	return withSocket(shell, async(socket, server) => {
		return fn(socket, server);
	})();
}

interface ResponseMessageInPingPong {
	readonly type:         'response'
	readonly expectedType: FlowrMessage['type']
	readonly description?: string | ((msg: IdMessageBase) => string)
	readonly mark?:        boolean
}

interface RequestMessageInPingPong {
	readonly type:         'request'
	readonly message:      FlowrMessage,
	readonly description?: string | ((msg: IdMessageBase) => string)
	readonly mark?:        boolean
}

export interface MessagePingPongDocumentationArguments {
	readonly shell:        RShell,
	readonly title?:       string,
	readonly messageType?: FlowrMessage['type'],
	readonly messages:     readonly (ResponseMessageInPingPong | RequestMessageInPingPong)[],
}

function explainMsg(msg: IdMessageBase, type: 'request' | 'response', desc = '', open = false): string {
	const bold: (s: string) => string = open ? s => `<b>${s}</b>` : s => s;
	return `
<li> ${bold( '<code>' + msg.type + `</code> (${type})`)}
<details${open ? ' open' : ''}> 

<summary> Show Details </summary>

${desc}

${jsonWithLimit(msg)}

</details>
</li>
`;
}

function getDescriptionForMessage(msg: IdMessageBase, description?: string | ((msg: IdMessageBase) => string)): string {
	if(description === undefined) {
		return '';
	} else if(typeof description === 'function') {
		return description(msg);
	} else {
		return description ?? '';
	}
}

function explainPingPong(
	description: readonly (ResponseMessageInPingPong | RequestMessageInPingPong)[],
	received: readonly IdMessageBase[]
) {
	let result = `<ol>${explainMsg(received[0], 'response', 'The first message is always a hello message.')}`;

	let readReceived = 1;
	/* we received one more than we sent (`hello` :D) */
	for(const msg of description) {
		if(msg.type === 'request') {
			result += explainMsg(msg.message, 'request', getDescriptionForMessage(msg.message, msg.description), msg.mark);
		} else {
			const response = received[readReceived++];
			result += explainMsg(response, 'response', getDescriptionForMessage(response, msg.description), msg.mark);
		}
	}
	return result + '</ol>';
}

export async function documentServerMessageResponse({
	shell, title, messageType, messages
}: MessagePingPongDocumentationArguments): Promise<string> {
	const start = performance.now();
	const response = await inServerContext(shell, async socket => {
		for(const metaMessage of messages) {
			if(metaMessage.type === 'request') {
				socket.send(JSON.stringify(metaMessage.message) + '\n');
			} else {
				try {
					await socket.waitForMessage(metaMessage.expectedType, 20);
				} catch(e) {
					console.error('Failed to receive message', metaMessage.expectedType, 'has', socket.getMessages());
				}
			}
		}
		return socket.getMessages();
	});
	const end = performance.now();

	guard(title !== undefined || messageType !== undefined, 'Either a title or a message type must be given');
	title ??= `Example of the <code>${messageType}</code> Message`;
	return `
<details>
<summary>${title}</summary>

_Note:_ even though we pretty-print these messages, they are sent as a single line, ending with a newline.

The following lists all messages that were sent and received in case you want to reproduce the scenario:

${
	explainPingPong(messages, response)
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
	mermaidSequenceDiagram, text, title, shortDescription, definitionPath, defRequest, defResponse, additionalDefs
}: ServerMessageDescription, shell: RShell): Promise<string> {
	const base = defRequest ?? defResponse;
	guard(base !== undefined, 'At least one of the definitions must be given');
	return `
<a id="message-${base.type}"></a>
<b>${title}</b> Message (<code>${base.type}</code>) 
<details>

<summary style="color:gray"> View Details. <i>${shortDescription}</i> </summary>

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server

    ${mermaidSequenceDiagram}
\`\`\`

${await text(shell)}

<hr>

${getSchema(definitionPath, defRequest)}
${getSchema(definitionPath, defResponse)}
${additionalDefs?.map(def => getSchema(definitionPath, def)).join('\n') ?? ''}

<hr>

</details>	
	`;
}
