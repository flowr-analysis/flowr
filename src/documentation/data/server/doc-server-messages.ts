import {
	documentServerMessage,
	documentServerMessageResponse,
	inServerContext
} from '../../doc-util/doc-server-message';
import { helloMessageDefinition } from '../../../cli/repl/server/messages/message-hello';
import { RShell } from '../../../r-bridge/shell';
import { DockerName } from '../../doc-util/doc-docker';
import { getCliLongOptionOf } from '../../doc-util/doc-cli-option';
import { codeBlock } from '../../doc-util/doc-code';
import { requestAnalysisMessage } from '../../../cli/repl/server/messages/message-analysis';
import { FlowrWikiBaseRef } from '../../doc-util/doc-files';

export function documentAllMessages() {

	documentServerMessage({
		title:                  'Hello',
		type:                   'response',
		definitionPath:         '../cli/repl/server/messages/message-hello.ts',
		base:                   helloMessageDefinition,
		mermaidSequenceDiagram: `
    Client-->Server: connects
    Server->>Client: hello
	`,
		shortDescription: 'The server informs the client about the successful connection and provides Meta-Information.',
		text:             async(shell: RShell) => {
			return `
	
After launching _flowR_, for example, with <code>docker run -it --rm ${DockerName} ${getCliLongOptionOf('flowr', 'server', false, false)}</code>&nbsp;(🐳️), simply connecting should present you with a \`${helloMessageDefinition.type}\` message, that amongst others should reveal the versions of&nbsp;_flowR_ and&nbsp;R, using the [semver 2.0](https://semver.org/spec/v2.0.0.html) versioning scheme.
The message looks like this:

${codeBlock('json',
		await inServerContext(shell, socket => {
			const [hello] = socket.getMessages(['hello']);
			return JSON.stringify(hello, null, 2);
		})
	)
}

There are currently a few messages that you can send after the hello message.
If you want to *slice* a piece of R code you first have to send an [analysis request](#message-request-analysis), so that you can send one or multiple slice requests afterward.
Requests for the [REPL](#message-request-repl) are independent of that.
	`;
		}
	});

	documentServerMessage({
		title:                  'Analysis',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-analysis.ts',
		base:                   requestAnalysisMessage,
		mermaidSequenceDiagram: `
    Client->>+Server: request-file-analysis
    alt
        Server-->>Client: response-file-analysis
    else
        Server-->>Client: error
    end
    deactivate  Server
	`,
		shortDescription: 'The server builds the dataflow graph for a given input file (or a set of files).',
		text:             async(shell: RShell) => {
			return `
	
The request allows the server to analyze a file and prepare it for slicing.
The message can contain a \`filetoken\`, which is used to identify the file in later slice or lineage requests (if you do not add one, the request will not be stored and therefore, it is not available for subsequent requests).

> [!IMPORTANT]
> If you want to send and process a lot of analysis requests, but do not want to slice them, please do not pass the \`filetoken\` field. This will save the server a lot of memory allocation.

Furthermore, the request must contain either a \`content\` field to directly pass the file's content or a \`filepath\` field which contains the path to the file (this path must be accessible for the server to be useful).
If you add the \`id\` field, the answer will use the same \`id\` so you can match requests and the corresponding answers.
See the implementation of the request-file-analysis message for more information.

${
	await documentServerMessageResponse({
		shell,
		documentResponses: [{
			expectedType: 'response-file-analysis',
			description:  `

The \`results\` field of the response effectively contains three keys of importance:

- \`parse\`: which contains 1:1 the parse result in CSV format that we received from the \`${RShell.name}\` (i.e., the AST produced by the parser of the R interpreter).
- \`normalize\`: which contains the normalized AST, including ids (see the \`info\` field and the [Normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) wiki page).
- \`dataflow\`: especially important is the \`graph\` field which contains the dataflow graph as a set of root vertices (see the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph) wiki page).
			`
		}],
		messagesToSend: [{
			'type':      'request-file-analysis',
			'id':        '1',
			'filetoken': 'x',
			'content':   'x <- 1\nx + 1'
		}], 
		messageTypeToPresent: 'request-file-analysis'
	})
}

	`;
		}
	});

}
