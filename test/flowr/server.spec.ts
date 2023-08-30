import {  withShell } from '../helper/shell'
import { withSocket } from '../helper/net'
import { retrieveVersionInformation } from '../../src/cli/repl/commands/version'
import { FlowrHelloResponseMessage } from '../../src/cli/repl/server/messages/hello'
import { assert } from 'chai'

describe('FlowR Server', withShell(shell => {
	it('Correct Hello Message', withSocket(shell,async socket => {
		await socket.waitForMessage('hello')
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
}))
