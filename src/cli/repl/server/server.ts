import { RShell, TokenMap } from '../../../r-bridge'
import { retrieveVersionInformation, VersionInformation } from '../commands/version'
import { FlowRServerConnection } from './connection'
import { getUnnamedSocketName, sendMessage } from './send'
import { FlowrHelloResponseMessage } from './messages/hello'
import { FlowrErrorMessage } from './messages/error'
import { NetServer, Server, Socket } from './net'

function notYetInitialized(c: Socket, id: string | undefined) {
	sendMessage<FlowrErrorMessage>(c, {
		id,
		type:   'error',
		fatal:  true,
		reason: 'Server not initialized yet (or failed to), please try again later.'
	})
	c.end()
}

function helloClient(c: Socket, name: string, versionInformation: VersionInformation) {
	sendMessage<FlowrHelloResponseMessage>(c, {
		id:         undefined,
		type:       'hello',
		clientName: name,
		versions:   versionInformation
	})
}

export class FlowRServer {
	private readonly server:    Server
	private readonly shell:     RShell
	private readonly tokenMap:  TokenMap
	private versionInformation: VersionInformation | undefined

	/** maps names to the respective connection */
	private connections = new Map<string, FlowRServerConnection>()
	private nameCounter = 0

	constructor(shell: RShell, tokenMap: TokenMap, server = new NetServer(c => this.onConnect(c))) {
		this.server = server
		this.shell = shell
		this.tokenMap = tokenMap
	}

	public async start(port: number) {
		this.versionInformation = await retrieveVersionInformation(this.shell)
		this.server.start(port)
		console.log(`Server listening on port ${port}`)
	}

	private onConnect(c: Socket) {
		if(!this.versionInformation) {
			notYetInitialized(c, undefined)
			return
		}
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

