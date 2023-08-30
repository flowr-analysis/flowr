/**
 * This is just a simple layer to allow me to mock the server's behavior in tests.
 */
import net from 'node:net'

type OnConnect = (socket: Socket) => void

export interface Server {
	onConnect: OnConnect
	start(port: number): void
}

export interface Socket {
	remoteAddress?: string
	remotePort?:    number
	on(event: 'data', listener: (data: Buffer) => void): void
	on(event: 'close', listener: () => void): void
	write(data: string): void
	end(): void
}


export class NetServer implements Server {
	public readonly onConnect: OnConnect
	private readonly server:   net.Server

	constructor(onConnect: OnConnect) {
		this.onConnect = onConnect
		this.server = net.createServer(c => this.onConnect(c))
	}

	public start(port: number) {
		this.server.listen(port)
	}
}

