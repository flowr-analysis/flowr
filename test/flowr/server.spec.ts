import { defaultTokenMap, withShell } from '../helper/shell'
import { withSocket } from '../helper/net'
import { retrieveVersionInformation } from '../../src/cli/repl/commands/version'
import { FlowrHelloResponseMessage } from '../../src/cli/repl/server/messages/hello'
import { assert } from 'chai'
import { FileAnalysisResponseMessage } from '../../src/cli/repl/server/messages/analysis'
import { requestFromInput } from '../../src/r-bridge'
import { LAST_PER_FILE_STEP, SteppingSlicer } from '../../src/core'
import { jsonReplacer } from '../../src/util/json'

describe('FlowR Server', withShell(shell => {
	it('Correct Hello Message', withSocket(shell,async socket => {
		const messages = socket.getMessages()
		assert.strictEqual(messages.length, 1, 'Expected exactly one message to hello the client')

		const hello = messages[0] as FlowrHelloResponseMessage
		const knownVersion = await retrieveVersionInformation(shell)

		assert.deepStrictEqual(hello, {
			type:       'hello',
			clientName: 'client-0',
			versions:   {
				r:     knownVersion.r,
				flowr: knownVersion.flowr
			}
		}, "Expected hello message to have the predefined format")
	}))

	it('Allow to analyze a simple expression', withSocket(shell, async socket => {
		socket.send(JSON.stringify({
			type:      "request-file-analysis",
			id:        "42",
			filetoken: "super-token",
			filename:  "x",
			content:   "1 + 1"
		}))
		await socket.waitForMessage('response-file-analysis')
		const messages = socket.getMessages()

		assert.strictEqual(messages.length, 2, 'Expected exactly two messages to hello the client')
		assert.strictEqual(messages[0].type, 'hello', 'Expected the first message to be a hello message')

		const response = messages[1] as FileAnalysisResponseMessage

		// we are testing the server and not the slicer here!
		const results = await new SteppingSlicer({
			stepOfInterest: LAST_PER_FILE_STEP,
			shell,
			tokenMap:       await defaultTokenMap(),
			request:        requestFromInput('1 + 1'),
		}).allRemainingSteps()

		assert.strictEqual(response.type, 'response-file-analysis', 'Expected the second message to be a response-file-analysis message')
		assert.strictEqual(response.id, '42', 'Expected the second message to have the same id as the request')
		// this is really ugly and only to unify the ids
		assert.deepStrictEqual(JSON.stringify(response.results, jsonReplacer)
			.replace(/\.GlobalEnv","id":"\d+"/, ".GlobalEnv\","),
		JSON.stringify(results, jsonReplacer)
			.replace(/\.GlobalEnv","id":"\d+"/, ".GlobalEnv\","), 'Expected the second message to have the same results as the slicer')

	}))
}))
