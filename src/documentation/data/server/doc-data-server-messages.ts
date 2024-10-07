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
import { analysisResponseMessage, requestAnalysisMessage } from '../../../cli/repl/server/messages/message-analysis';
import { FlowrWikiBaseRef } from '../../doc-util/doc-files';
import { cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import { getCfg } from '../../doc-util/doc-cfg';
import { NewIssueUrl } from '../../doc-util/doc-issue';
import { requestSliceMessage, responseSliceMessage } from '../../../cli/repl/server/messages/message-slice';
import type { ExecuteIntermediateResponseMessage } from '../../../cli/repl/server/messages/message-repl';
import {
	requestExecuteReplExpressionMessage,
	responseExecuteReplEndMessage,
	responseExecuteReplIntermediateMessage
} from '../../../cli/repl/server/messages/message-repl';

import {
	requestQueryMessage,
	responseQueryMessage
} from '../../../cli/repl/server/messages/message-query';
import { exampleQueryCode } from '../query/example-query-code';
import { CallTargets } from '../../../queries/catalog/call-context-query/call-context-query-format';
import { requestLineageMessage, responseLineageMessage } from '../../../cli/repl/server/messages/message-lineage';

export function documentAllMessages() {

	documentServerMessage({
		title:                  'Hello',
		type:                   'response',
		definitionPath:         '../cli/repl/server/messages/message-hello.ts',
		defResponse:            helloMessageDefinition,
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
If you want to _slice_ a piece of R code you first have to send an [analysis request](#message-request-file-analysis), so that you can send one or multiple slice requests afterward.
Requests for the [REPL](#message-request-repl) are independent of that.
	`;
		}
	});

	const cfgSample = 'if(unknown > 0) { x <- 2 } else { x <- 5 }\nfor(i in 1:x) { print(x); print(i) }';
	documentServerMessage({
		title:                  'Analysis',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-analysis.ts',
		defRequest:             requestAnalysisMessage,
		defResponse:            analysisResponseMessage,
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
		messageType: 'request-file-analysis',
		messages:    [
			{
				type:        'request',
				description: `Let' suppose you simply want to analyze the following script:\n ${codeBlock('r', 'x <- 1\nx + 1')}\n For this, you can send the following request:`,
				message:     {
					type:      'request-file-analysis',
					id:        '1',
					filetoken: 'x',
					content:   'x <- 1\nx + 1'
				},
				mark: true
			},
			{
				type:         'response',
				expectedType: 'response-file-analysis',
				description:  `

The \`results\` field of the response effectively contains three keys of importance:

- \`parse\`: which contains 1:1 the parse result in CSV format that we received from the \`${RShell.name}\` (i.e., the AST produced by the parser of the R interpreter).
- \`normalize\`: which contains the normalized AST, including ids (see the \`info\` field and the [Normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) wiki page).
- \`dataflow\`: especially important is the \`graph\` field which contains the dataflow graph as a set of root vertices (see the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph) wiki page).
			`
			}
		]
	})
}

You receive an error if, for whatever reason, the analysis fails (e.g., the message or code you sent contained syntax errors).
It contains a human-readable description *why* the analysis failed (see the error message implementation for more details).

${
	await documentServerMessageResponse({
		shell,
		title:    'Example Error Message',
		messages: [{
			type:    'request',
			message: {
				type:     'request-file-analysis',
				id:       '1',
				filename: 'sample.R',
				content:  'x <-'
			}
		}, {
			type:         'response',
			expectedType: 'error',
			mark:         true
		}]
	})
}

&nbsp;

<a id="analysis-include-cfg"></a>
**Including the Control Flow Graph**

While _flowR_ does (for the time being) not use an explicit control flow graph but instead relies on control-dependency edges within the dataflow graph, 
the respective structure can still be exposed using the server (note that, as this feature is not needed within _flowR_, it is tested significantly less - 
so please create a [new issue](${NewIssueUrl}) for any bug you may encounter).
For this, the analysis request may add \`cfg: true\` to its list of options.

${
	await documentServerMessageResponse({
		shell,
		title:    'Requesting a Control Flow Graph',
		messages: [{
			type:    'request',
			message: {
				type:      'request-file-analysis',
				id:        '1',
				filetoken: 'x',
				content:   cfgSample,
				cfg:       true
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-file-analysis',
			description:  `
The response looks basically the same as a response sent without the \`cfg\` flag. However, additionally it contains a \`cfg\` field. 
If you are interested in a visual representation of the control flow graph, see the 
[visualization with mermaid](${
	await (async() => {
		const res = await getCfg(shell, cfgSample);
		return cfgToMermaidUrl(res.info, res.ast);
	})()
}).
			`
		}]
	})
}

&nbsp;

<a id="analysis-format-n-quads"></a>
**Retrieve the Output as RDF N-Quads**

The default response is formatted as JSON.
However, by specifying \`format: "n-quads"\`, you can retrieve the individual results (e.g., the [Normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)),
as [RDF N-Quads](https://www.w3.org/TR/n-quads/).
This works with and without the control flow graph as described [above](#analysis-include-cfg).

${
	await documentServerMessageResponse({
		shell,
		title:    'Requesting RDF N-Quads',
		messages: [{
			type:    'request',
			message: {
				type:      'request-file-analysis',
				id:        '1',
				filetoken: 'x',
				content:   'x <- 1\nx + 1',
				format:    'n-quads',
				cfg:       true
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-file-analysis',
			description:  `
Please note, that the base message format is still JSON. Only the individual results get converted. 
While the context is derived from the \`filename\`, we currently offer no way to customize other parts of the quads 
(please open a [new issue](${NewIssueUrl}) if you require this).
			`
		}]
	})
}
	`;
		}
	});

	documentServerMessage({
		title:                  'Slice',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-slice.ts',
		defRequest:             requestSliceMessage,
		defResponse:            responseSliceMessage,
		mermaidSequenceDiagram: `
    Client->>+Server: request-slice

    alt
        Server-->>Client: response-slice
    else
        Server-->>Client: error
    end
    deactivate  Server
	`,
		shortDescription: 'The server slices a file based on the given criteria.',
		text:             async(shell: RShell) => {
			return `
To slice, you have to send a file analysis request first. The \`filetoken\` you assign is of use here as you can re-use it to repeatedly slice the same file.
Besides that, you only need to add an array of slicing criteria, using one of the formats described on the [terminology wiki page](${FlowrWikiBaseRef}/Terminology#slicing-criterion) 
(however, instead of using \`;\`, you can simply pass separate array elements).
See the implementation of the request-slice message for more information.

Additionally, you may pass \`"noMagicComments": true\` to disable the automatic selection of elements based on magic comments (see below).

${
	await documentServerMessageResponse({
		shell,
		messageType: 'request-slice',
		messages:    [{
			type:        'request',
			description: `Let's assume you want to slice the following script:\n${codeBlock('r', 'x <- 1\nx + 1')}\n\nFor this we first request the analysis, using a \`filetoken\` of \`x\` to slice the file in the next request.`,
			message:     {
				type:      'request-file-analysis',
				id:        '1',
				filetoken: 'x',
				content:   'x <- 1\nx + 1'
			}
		}, {
			type:         'response',
			expectedType: 'response-file-analysis',
			description:  `
See [above](#message-request-file-analysis) for the general structure of the response.
			`
		}, {
			type:        'request',
			description: 'Of course, the second slice criterion `2:1` is redundant for the input, as they refer to the same variable. It is only for demonstration purposes.',
			message:     {
				type:      'request-slice',
				id:        '2',
				filetoken: 'x',
				criterion: ['2@x', '2:1']
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-slice',
			description:  `
The \`results\` field of the response contains two keys of importance:

- \`slice\`: which contains the result of the slicing (e.g., the ids included in the slice in \`result\`).
- \`reconstruct\`: contains the reconstructed code, as well as additional meta information. 
                   The automatically selected lines correspond to additional filters (e.g., magic comments) which force the unconditiojnal inclusion of certain elements.
`
		}]
	})
}

The semantics of the error message are similar. If, for example, the slicing criterion is invalid or the \`filetoken\` is unknown, _flowR_ will respond with an error.

&nbsp;

<a id="slice-magic-comments"></a>
**Magic Comments**


Within a document that is to be sliced, you can use magic comments to influence the slicing process:

- \`# flowr@include_next_line\` will cause the next line to be included, independent of if it is important for the slice.
- \`# flowr@include_this_line\` will cause the current line to be included, independent of if it is important for the slice.
- \`# flowr@include_start\` and \`# flowr@include_end\` will cause the lines between them to be included, independent of if they are important for the slice. These magic comments can be nested but should appear on a separate line.

	`;
		}
	});

	documentServerMessage({
		title:                  'REPL',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-repl.ts',
		defRequest:             requestExecuteReplExpressionMessage,
		defResponse:            responseExecuteReplIntermediateMessage,
		additionalDefs:         [responseExecuteReplEndMessage],
		mermaidSequenceDiagram: `
    Client->>+Server: request-repl-execution

    alt
        Server-->>Client: error
    else

    loop
        Server-->>Client: response-repl-execution
    end
        Server-->>Client: end-repl-execution

    end

    deactivate  Server
	`,
		shortDescription: 'Access the read evaluate print loop of flowR.',
		text:             async(shell: RShell) => {
			return `
> [!WARNING]
> To execute arbitrary R commands with a request, the server has to be started explicitly with ${getCliLongOptionOf('flowr', 'r-session-access')}.
> Please be aware that this introduces a security risk.


The REPL execution message allows to send a REPL command to receive its output. 
For more on the REPL, see the [introduction](${FlowrWikiBaseRef}/Overview#the-read-eval-print-loop-repl), or the [description below](#using-the-repl).
You only have to pass the command you want to execute in the \`expression\` field. 
Furthermore, you can set the \`ansi\` field to \`true\` if you are interested in output formatted using [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code).
We strongly recommend you to make use of the \`id\` field to link answers with requests as you can theoretically request the execution of multiple scripts at the same time, which then happens in parallel.

> [!WARNING]
> There is currently no automatic sandboxing or safeguarding against such requests. They simply execute the respective&nbsp;R code on your machine. 
> Please be very careful (and do not use ${getCliLongOptionOf('flowr', 'r-session-access')} if you are unsure).


The answer on such a request is different from the other messages as the \`response-repl-execution\` message may be sent multiple times. 
This allows to better handle requests that require more time but already output intermediate results.
You can detect the end of the execution by receiving the \`end-repl-execution\` message.

The semantics of the error message are similar to that of the other messages.
${
	await documentServerMessageResponse({
		shell,
		messageType: 'request-slice',
		messages:    [{
			type:    'request',
			message: {
				type:       'request-repl-execution',
				id:         '1',
				expression: ':help',
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-repl-execution',
			description:  msg => {
				return `
The \`stream\` field (either \`stdout\` or \`stderr\`) informs you of the output's origin: either the standard output or the standard error channel. After this message follows the end marker.


<details>
<summary>Pretty-Printed Result</summary>

${codeBlock('text', (msg as ExecuteIntermediateResponseMessage).result)}

</details>
				`;
			}
		}, {
			type:         'response',
			expectedType: 'end-repl-execution',
		}]
	})
}
	`;
		}
	});

	documentServerMessage({
		title:                  'Query',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-query.ts',
		defRequest:             requestQueryMessage,
		defResponse:            responseQueryMessage,
		mermaidSequenceDiagram: `
    Client->>+Server: request-query

    alt
        Server-->>Client: response-query
    else
        Server-->>Client: error
    end
    deactivate  Server
	`,
		shortDescription: 'Query an analysis result for specific information.',
		text:             async(shell: RShell) => {
			return `
To send queries, you have to send an [analysis request](#message-request-file-analysis) first. The \`filetoken\` you assign is of use here as you can re-use it to repeatedly query the same file.
This message provides direct access to _flowR_'s Query API. Please consult the [Query API documentation](${FlowrWikiBaseRef}/Query%20API) for more information.

${
	await documentServerMessageResponse({
		shell,
		messageType: 'request-query',
		messages:    [{
			type:        'request',
			description: `Let's assume you want to query the following script:\n${codeBlock('r', exampleQueryCode)}.\n\nFor this we first request the analysis, using a dummy \`filetoken\` of \`x\` to slice the file in the next request.`,
			message:     {
				type:      'request-file-analysis',
				id:        '1',
				filetoken: 'x',
				content:   exampleQueryCode
			}
		}, {
			type:         'response',
			expectedType: 'response-file-analysis',
			description:  `
See [above](#message-request-file-analysis) for the general structure of the response.
			`
		}, {
			type:    'request',
			message: {
				type:      'request-query',
				id:        '2',
				filetoken: 'x',
				query:     [
					{
						type:            'compound',
						query:           'call-context',
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- otherwise we would have to carry generic typing information through the test infrastrcuture
						commonArguments: {
							kind:        'visualize',
							subkind:     'text',
							callTargets: CallTargets.OnlyGlobal,
						} as never,
						arguments: [
							{
								callName: '^mean$'
							},
							{
								callName:    '^print$',
								callTargets: CallTargets.OnlyLocal
							}
						]
					} as const
				]
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-query'
		}]
	})
}

	`;
		}
	});

	documentServerMessage({
		title:                  'Lineage',
		type:                   'request',
		definitionPath:         '../cli/repl/server/messages/message-lineage.ts',
		defRequest:             requestLineageMessage,
		defResponse:            responseLineageMessage,
		mermaidSequenceDiagram: `
    Client->>+Server: request-lineage

    alt
        Server-->>Client: response-lineage
    else
        Server-->>Client: error
    end
    deactivate  Server
	`,
		shortDescription: 'Obtain the lineage of a given slicing criterion.',
		text:             async(shell: RShell) => {
			return `

In order to retrieve the lineage of an object, you have to send a file analysis request first. The \`filetoken\` you assign is of use here as you can re-use it to repeatedly retrieve the lineage of the same file.
Besides that, you will need to add a [criterion](${FlowrWikiBaseRef}/Terminology#slicing-criterion) that specifies the object whose lineage you're interested in.

${
	await documentServerMessageResponse({
		shell,
		messageType: 'request-query',
		messages:    [{
			type:    'request',
			message: {
				type:      'request-file-analysis',
				id:        '1',
				filetoken: 'x',
				content:   'x <- 1\nx + 1'
			}
		}, {
			type:         'response',
			expectedType: 'response-file-analysis',
			description:  `
See [above](#message-request-file-analysis) for the general structure of the response.
			`
		}, {
			type:    'request',
			message: {
				type:      'request-lineage',
				id:        '2',
				filetoken: 'x',
				criterion: '2@x'
			},
			mark: true
		}, {
			type:         'response',
			expectedType: 'response-lineage',
			description:  'The response contains the lineage of the desired object in form of an array of IDs (as the representation of a set).'
		}]
	})
}

	`;
		}
	});
}
