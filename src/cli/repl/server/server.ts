import * as net from 'node:net'
import { RShell, TokenMap } from '../../../r-bridge'
import { retrieveVersionInformation, VersionInformation } from '../commands/version'
import {
	FileAnalysisRequestMessage,
	FlowrHelloErrorMessage,
	FlowrHelloResponseMessage,
	FlowrRequestMessage, SliceRequestMessage
} from './messages'
import { LAST_STEP, SteppingSlicer, STEPS_PER_SLICE } from '../../../core'
import { jsonReplacer } from '../../../util/json'
import { SlicingCriteria } from '../../../slicing'

export class FlowRServer {
	private readonly server:    net.Server
	private readonly shell:     RShell
	private readonly tokenMap:  TokenMap
	private versionInformation: VersionInformation | undefined
	// TODO: manually shut down everything?
	private connections = new Set<FlowRServerConnection>()

	constructor(shell: RShell, tokenMap: TokenMap) {
		this.server = net.createServer(c => this.onHello(c))
		this.shell = shell
		this.tokenMap = tokenMap
	}

	public async start(port: number) {
		this.versionInformation = await retrieveVersionInformation(this.shell)
		this.server.listen(port)
		console.log(`Server listening on port ${port}`)
	}

	private onHello(c: net.Socket) {
		console.log(`Client connected: ${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`)
		if(!this.versionInformation) {
			sendMessage<FlowrHelloErrorMessage>(c, {
				type:   'error',
				reason: 'Server not initialized yet'
			})
			// in theory, they can say hello again :D
		} else {
			sendMessage<FlowrHelloResponseMessage>(c, {
				type:     'hello',
				versions: this.versionInformation
			})
			const connection = new FlowRServerConnection(c, this.shell, this.tokenMap)
			this.connections.add(connection)
			c.on('close', () => {
				this.connections.delete(connection)
				// TODO: unify connect and left output
				console.log(`Client disconnected: ${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`)
			})
		}
	}
}

function sendMessage<T>(c: net.Socket, message: T): void {
	c.write(JSON.stringify(message, jsonReplacer) + '\n')
}


interface FlowRFileInformation {
	filename: string,
	slicer: 	 SteppingSlicer
}

class FlowRServerConnection {
	private readonly socket:   net.Socket
	private readonly shell:    RShell
	private readonly tokenMap: TokenMap

	// maps token to information
	private readonly fileMap = new Map<string, FlowRFileInformation>()

	// we do not have to ensure synchronized shell-access as we are always running synchronized
	constructor(socket: net.Socket, shell: RShell, tokenMap: TokenMap) {
		this.socket = socket
		this.tokenMap = tokenMap
		this.shell = shell
		this.socket.on('data', data => this.handleData(String(data)))
	}

	// TODO: do we have to deal with partial messages?
	private handleData(message: string) {
		const hopefullyRequest = JSON.parse(message) as FlowrRequestMessage | Record<string, unknown>
		switch(hopefullyRequest.type) {
			case 'request-file-analysis':
				this.handleFileAnalysisRequest(hopefullyRequest as FileAnalysisRequestMessage)
				break
			case 'request-slice':
				this.handleSliceRequest(hopefullyRequest as SliceRequestMessage)
				break
			default:
				sendMessage<FlowrHelloErrorMessage>(this.socket, {
					type:   'error',
					reason: `The message type ${JSON.stringify(hopefullyRequest.type ?? 'undefined')} is not supported.`
				})
				this.socket.end()
		}
	}


	// TODO: do not crash with errors!

	// TODO: add name to clients?
	// TODO: integrate this with lsp?
	private handleFileAnalysisRequest(request: FileAnalysisRequestMessage) {
		console.log(`[${request.filetoken}] Received file analysis request for ${request.filename}`)
		// TODO: guard with json schema so that all are correctly keys given
		if(this.fileMap.has(request.filetoken)) {
			console.log(`File token ${request.filetoken} already exists. Overwriting.`)
		}
		const slicer = new SteppingSlicer({
			stepOfInterest: LAST_STEP,
			shell:          this.shell,
			tokenMap:       this.tokenMap,
			request:        {
				request:                 'text',
				content:                 request.content,
				attachSourceInformation: true,
				ensurePackageInstalled:  true
			},
			criterion: [] // currently unknown
			// TODO: allow to configure the rest?
		})
		this.fileMap.set(request.filetoken, {
			filename: request.filename,
			slicer
		})

		void slicer.allRemainingSteps(false).then(results => {
			sendMessage(this.socket, {
				type:    'response-file-analysis',
				success: true,
				results
			})
		})
	}

	private handleSliceRequest(request: SliceRequestMessage) {
		console.log(`[${request.filetoken}] Received slice request with criteria ${request.criterion}`)

		const fileInformation = this.fileMap.get(request.filetoken)
		if(!fileInformation) {
			sendMessage<FlowrHelloErrorMessage>(this.socket, {
				type:   'error',
				reason: `The file token ${request.filetoken} has never been analyzed.`
			})
			return
		}
		// TODO: remove failed messages as they are part of error?
		// TODO: ensure correct criteria
		// TODO: cache slices?
		// TODO: unique message ids in requests and answsers to link them?
		fileInformation.slicer.updateCriterion(request.criterion)
		void fileInformation.slicer.allRemainingSteps(true).then(results => {
			sendMessage(this.socket, {
				type:    'response-slice',
				success: true,
				// TODO: is there a better way?
				results: Object.fromEntries(Object.entries(results).filter(([k,]) => Object.hasOwn(STEPS_PER_SLICE, k)))
			})
		})
	}

}
