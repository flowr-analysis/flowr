/**
 * This is just a simple layer to allow me to mock the server's behavior in tests.
 */
import net from 'net';
import type WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { serverLog } from './server';

/** Function handler that should be triggered when the respective socket connects */
export type OnConnect = (c: Socket) => void;

/**
 * A generic server interface that allows us to mock the server's behavior in tests.
 */
export interface Server {
	/**
	 * Register a function to be called when a new socket connects.
	 * This should be only called once per server.
	 */
	onConnect(handler: OnConnect): void
	start(port: number): void
}


/**
 * Whether a WebSocket client with the given `Origin` header may connect.
 * Browsers send the origin of the page that opens the connection, so this keeps arbitrary web pages from talking to a
 * local server (cross-site WebSocket hijacking). Clients that are no browser usually send no origin and are allowed,
 * as are pages served from this machine and the origins in `allowed` (`*` allows all).
 */
export function isAllowedWebSocketOrigin(origin: string | undefined, allowed: readonly string[] = []): boolean {
	if(origin === undefined || allowed.includes('*') || allowed.includes(origin)) {
		return true;
	}
	try {
		return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
	} catch{
		return false;
	}
}

export class WebSocketServerWrapper implements Server {
	private server:         WebSocket.Server | undefined;
	private connectHandler: ((c: Socket) => void) | undefined;

	/** @param allowedOrigins - additional origins (besides the local ones) whose pages may connect, see {@link isAllowedWebSocketOrigin} */
	constructor(private readonly allowedOrigins: readonly string[] = []) {}

	public onConnect(handler: OnConnect) {
		this.connectHandler = handler;
	}

	start(port: number) {
		this.server = new WebSocketServer({
			port,
			maxPayload:   1024 * 1024 * 1024 * 1024,
			verifyClient: ({ origin }: { origin?: string }) => {
				const allowed = isAllowedWebSocketOrigin(origin, this.allowedOrigins);
				if(!allowed) {
					serverLog.warn(`Refusing a WebSocket connection from origin ${origin}, allow it with --ws-allow-origin`);
				}
				return allowed;
			}
		});
		this.server.on('error', (e: NodeJS.ErrnoException) => reportListenFailure(port, e));
		serverLog.info('WebSocket-Server wrapper is active!');
		this.server.on('connection', c => this.connectHandler?.(new WebSocketWrapper(c)));
	}
}

/**
 * The socket abstraction of *flowR*.
 * Essentially a subset of what the default `net.Socket` of `node` provides.
 */
export interface Socket {
	remoteAddress?: string
	remotePort?:    number
	on(event: 'error', listener: (e: unknown) => void): void
	on(event: 'close', listener: () => void): void
	on(event: 'data', listener: (data: Buffer) => void): void
	write(data: string): void
	end(): void
}

export class WebSocketWrapper implements Socket {
	private readonly socket: WebSocket;

	public remoteAddress?: string;
	public remotePort?:    number;

	constructor(socket: WebSocket) {
		this.socket = socket;
		this.remoteAddress = socket.url;
	}

	write(data: string) {
		this.socket.send(data);
	}

	end() {
		this.socket.close();
	}

	on(event: 'data' | 'close' | 'error', listener: (data: Buffer) => void) {
		if(event === 'data') {
			this.socket.on('message', listener);
		} else {
			this.socket.on(event, listener);
		}
	}
}

export class NetServer implements Server {
	private readonly server: net.Server;

	constructor() {
		this.server = net.createServer();
	}

	public onConnect(handler: OnConnect) {
		this.server.on('connection', handler);
	}

	public start(port: number) {
		this.server.on('error', (e: NodeJS.ErrnoException) => reportListenFailure(port, e));
		this.server.listen(port);
	}
}

/** Log a clear, actionable message for a server that failed to bind its port, then exit (there is nothing left to serve). */
function reportListenFailure(port: number, e: NodeJS.ErrnoException): void {
	if(e.code === 'EADDRINUSE') {
		serverLog.error(`Port ${port} is already in use. Pick another port with --port <number> or stop the process using it.`);
	} else if(e.code === 'EACCES') {
		serverLog.error(`Not allowed to listen on port ${port} (permission denied). Try a port above 1024 with --port <number>.`);
	} else {
		serverLog.error(`Failed to start the server on port ${port}: ${e.message}`);
	}
	process.exit(1);
}
