/**
 * This is just a simple layer to allow me to mock the server's behavior in tests.
 */
import net from 'node:net'

export type OnConnect = (c: Socket) => void

export interface Server {
	onConnect(handler: OnConnect): void
	start(port: number): void
}

export interface Socket {
	remoteAddress?: string
	remotePort?:    number
	on(event: 'close', listener: () => void): void
	on(event: 'data', listener: (data: Buffer) => void): void
	write(data: string): void
	end(): void
}

export class NetServer implements Server {
	private readonly server: net.Server

	constructor() {
		this.server = net.createServer()
	}

	public onConnect(handler: OnConnect) {
		this.server.on('connection', handler)
	}

	public start(port: number) {
		this.server.listen(port)
	}
}

