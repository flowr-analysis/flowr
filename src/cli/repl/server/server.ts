import * as net from 'node:net'
import { RShell, TokenMap } from '../../../r-bridge'
import { retrieveVersionInformation, VersionInformation } from '../commands/version'
import {
	FlowrErrorMessage, FlowrHelloResponseMessage,
	getUnnamedSocketName,
	sendMessage,
} from './messages'
import { FlowRServerConnection } from './connection'

function notYetInitialized(c: net.Socket) {
	sendMessage<FlowrErrorMessage>(c, {
		type:   'error',
		fatal:  true,
		reason: 'Server not initialized yet (or failed to), please try again later.'
	})
	c.end()
}

function helloClient(c: net.Socket, name: string, versionInformation: VersionInformation) {
	sendMessage<FlowrHelloResponseMessage>(c, {
		type:       'hello',
		clientName: name,
		versions:   versionInformation
	})
}

export class FlowRServer {
	private readonly server:    net.Server
	private readonly shell:     RShell
	private readonly tokenMap:  TokenMap
	private versionInformation: VersionInformation | undefined

	// TODO: manually shut down everything?
	/** maps names to the respective connection */
	private connections = new Map<string, FlowRServerConnection>()
	private nameCounter = 0

	constructor(shell: RShell, tokenMap: TokenMap) {
		this.server = net.createServer(c => this.onConnect(c))
		this.shell = shell
		this.tokenMap = tokenMap
	}

	public async start(port: number) {
		this.versionInformation = await retrieveVersionInformation(this.shell)
		this.server.listen(port)
		// TODO: update stuff like this to a normal logger?
		console.log(`Server listening on port ${port}`)
	}

	private onConnect(c: net.Socket) {
		if(!this.versionInformation) {
			notYetInitialized(c)
			return
		}
		// TODO: produce better unique names? :D
		const name = `client-${this.nameCounter++}`
		console.log(`Client connected: ${getUnnamedSocketName(c)} as "${name}"`)

		this.connections.set(name, new FlowRServerConnection(c, name, this.shell, this.tokenMap))
		helloClient(c, name, this.versionInformation)
		c.on('close', () => {
			this.connections.delete(name)
			console.log(`Client "${name}" disconnected (${getUnnamedSocketName(c)})`)
		})
	}
}

