import { withShell } from '../_helper/shell';
import { fakeSend, withSocket } from '../_helper/net';
import type { FlowrHelloResponseMessage } from '../../../src/cli/repl/server/messages/message-hello';
import { retrieveVersionInformation } from '../../../src/cli/repl/commands/repl-version';
import type {
	ExecuteEndMessage,
	ExecuteIntermediateResponseMessage,
	ExecuteRequestMessage
} from '../../../src/cli/repl/server/messages/message-repl';
import type {
	FileAnalysisRequestMessage,
	FileAnalysisResponseMessageJson
} from '../../../src/cli/repl/server/messages/message-analysis';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { jsonReplacer } from '../../../src/util/json';
import { extractCFG } from '../../../src/util/cfg/cfg';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { sanitizeAnalysisResults } from '../../../src/cli/repl/server/connection';
import type { QueryRequestMessage, QueryResponseMessage } from '../../../src/cli/repl/server/messages/message-query';
import { describe, assert, test } from 'vitest';

describe('flowr', () => {
	describe.sequential('Server', withShell(shell => {
		test('Correct Hello Message', withSocket(shell,async socket => {
			const messages = socket.getMessages();
			assert.strictEqual(messages.length, 1, 'Expected exactly one message to hello the client');

			const hello = messages[0] as FlowrHelloResponseMessage;
			const knownVersion = await retrieveVersionInformation(shell);

			assert.deepStrictEqual(hello, {
				type:       'hello',
				clientName: 'client-0',
				versions:   {
					r:     knownVersion.r,
					flowr: knownVersion.flowr
				}
			}, 'Expected hello message to have the predefined format');
		}));

		test('Process simple REPL Message', withSocket(shell, async socket => {
			fakeSend<ExecuteRequestMessage>(socket, {
				type:       'request-repl-execution',
				ansi:       false,
				id:         '0',
				expression: '1 + 1'
			});

			await socket.waitForMessage('end-repl-execution');

			const messages = socket.getMessages();

			assert.deepStrictEqual(messages[1] as ExecuteIntermediateResponseMessage, {
				type:   'response-repl-execution',
				id:     '0',
				stream: 'stdout',
				result: '[1] 2\n'
			}, 'response message should contain request id, result should be not in standard error (no failure), and it should be the correct result');

			assert.deepStrictEqual(messages[2] as ExecuteEndMessage, {
				type: 'end-repl-execution',
				id:   '0',
			}, 'the end message should have the same id as the response (and come after the response)');

		}));


		test('Analyze a simple expression', withSocket(shell, async socket => {
			fakeSend<FileAnalysisRequestMessage>(socket, {
				type:      'request-file-analysis',
				id:        '42',
				filetoken: 'super-token',
				filename:  'x',
				content:   '1 + 1'
			});
			await socket.waitForMessage('response-file-analysis');
			const messages = socket.getMessages(['hello', 'response-file-analysis']);

			const response = messages[1] as FileAnalysisResponseMessageJson;

			// we are testing the server and not the slicer here!
			const results = sanitizeAnalysisResults(await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				shell,
				request: requestFromInput('1 + 1'),
			}).allRemainingSteps());

			// cfg should not be set as we did not request it
			assert.isUndefined(response.cfg, 'Expected the cfg to be undefined as we did not request it');

			assert.strictEqual(response.id, '42', 'Expected the second message to have the same id as the request');

			// this is hideous and only to unify the ids
			const expected = JSON.stringify(results, jsonReplacer)
				.replace(/"id":\d+|"timing":\s*\d+/g, '');
			const got = JSON.stringify(response.results, jsonReplacer)
				.replace(/"id":\d+|"timing":\s*\d+/g, '');
			assert.strictEqual(got, expected, 'Expected the second message to have the same results as the slicer');
		}));

		test('Analyze the CFG', withSocket(shell, async socket => {
			fakeSend<FileAnalysisRequestMessage>(socket, {
				type:      'request-file-analysis',
				id:        '42',
				filetoken: 'super-token',
				filename:  'x',
				content:   'a;b',
				cfg:       true
			});
			await socket.waitForMessage('response-file-analysis');
			const messages = socket.getMessages(['hello', 'response-file-analysis']);

			const response = messages[1] as FileAnalysisResponseMessageJson;

			const gotCfg = response.cfg;
			assert.isDefined(gotCfg, 'Expected the cfg to be defined as we requested it');
			const expectedCfg = extractCFG(response.results.normalize);
			assert.equal(JSON.stringify(gotCfg?.graph, jsonReplacer), JSON.stringify(expectedCfg.graph, jsonReplacer), 'Expected the cfg to be the same as the one extracted from the results');
		}));

		test('Process a Query', withSocket(shell, async socket => {
			fakeSend<FileAnalysisRequestMessage>(socket, {
				type:      'request-file-analysis',
				id:        '42',
				filetoken: 'super-token',
				filename:  'x',
				content:   'print(17)'
			});
			await socket.waitForMessage('response-file-analysis');

			/* request a query */
			fakeSend<QueryRequestMessage>(socket, {
				type:      'request-query',
				id:        '21',
				filetoken: 'super-token',
				query:     [{ type: 'call-context', callName: 'print' }]
			});

			await socket.waitForMessage('response-query');
			const messages = socket.getMessages(['hello', 'response-file-analysis', 'response-query']);
			const response = messages[2] as QueryResponseMessage;

			assert.exists(response.results['call-context'], 'Expected the query to return at least one result');
			assert.exists(response.results['.meta'], 'Expected the query to return at least one result');
			assert.equal(response.results['call-context']['kinds']['.']['subkinds']['.'].length, 1, 'We should find one call to print!');
		}));
	}));
});
