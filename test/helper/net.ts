import { OnConnect, Server, Socket } from '../../src/cli/repl/server/net'
import * as Buffer from 'buffer'
import { FlowrBaseMessage } from '../../src/cli/repl'
import { RShell } from '../../src/r-bridge'
import { FlowRServer } from '../../src/cli/repl/server/server'
import { defaultTokenMap } from './shell'

export class FakeServer implements Server {
	private connectHandler: OnConnect | undefined
	private port:           number | undefined

	public onConnect(handler: OnConnect) {
		this.connectHandler = handler
	}

	public start(port: number) {
		this.port = port
	}

	public connectClient(socket: FakeSocket) {
		this.connectHandler?.(socket)
	}
}

export class FakeSocket implements Socket {
	public readonly remoteAddress= 'fake-remote-address'
	public readonly remotePort = 1234

	private dataHandler:    ((data: Buffer) => void) | undefined
	private messageHandler: ((message: FlowrBaseMessage) => void) | undefined

	private closeHandler: (() => void) | undefined


	private messages: FlowrBaseMessage[] = []

	// for messages sent by the server
	public write(data: string): void {
		const message = JSON.parse(data) as FlowrBaseMessage
		this.messages.push(message)
		this.messageHandler?.(message)
	}

	public end(): void {
		this.closeHandler?.()
	}



	public on(event: "close", listener: () => void): void
	public on(event: "data", listener: (data: Buffer) => void): void
	public on(event: "close" | "data", listener: (() => void) | ((data: Buffer) => void)): void {
		if(event === 'close') {
			this.closeHandler = listener as () => void
		} else  {
			this.dataHandler = listener as (data: Buffer) => void
		}
	}

	public send(data: string) {
		this.dataHandler?.(Buffer.Buffer.from(`${data}\n`))
	}

	public async waitForMessage(type: FlowrBaseMessage['type']): Promise<void> {
		return new Promise(resolve => {
			// check if the message was already sent
			for(const message of this.messages) {
				if(message.type === type) {
					resolve()
					return
				}
			}
			// otherwise wait
			this.messageHandler = (message: FlowrBaseMessage) => {
				if(message.type === type) {
					resolve()
				}
			}
		})
	}

	public getMessages(): readonly FlowrBaseMessage[] {
		return this.messages
	}
}


export function withSocket(shell: RShell, fn: (socket: FakeSocket, server: FakeServer) => Promise<void>): () => Promise<void>  {
	return async function() {
		const net = new FakeServer()
		const server = new FlowRServer(shell, await defaultTokenMap(), net)
		await server.start(42)
		const socket = new FakeSocket()
		net.connectClient(socket)
		await socket.waitForMessage('hello')
		await fn(socket, net)
	}
}
