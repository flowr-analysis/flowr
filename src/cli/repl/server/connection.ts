import { LAST_STEP, SteppingSlicer, STEPS_PER_SLICE } from '../../../core'
import net from 'node:net'
import { RShell, TokenMap } from '../../../r-bridge'
import {
	answerForValidationError, FileAnalysisRequestMessage, FileAnalysisResponseMessage,
	FlowrErrorMessage, FlowrHelloResponseMessage, requestAnalysisMessage,
	sendMessage,
	SliceRequestMessage, validateBaseMessageFormat, validateMessage
} from './messages'

export interface FlowRFileInformation {
	filename: string,
	slicer: 	 SteppingSlicer
}

export class FlowRServerConnection {
	private readonly socket:   net.Socket
	private readonly shell:    RShell
	private readonly tokenMap: TokenMap
	private readonly name:     string

	// maps token to information
	private readonly fileMap = new Map<string, FlowRFileInformation>()


	// we do not have to ensure synchronized shell-access as we are always running synchronized
	constructor(socket: net.Socket, name: string, shell: RShell, tokenMap: TokenMap) {
		this.socket = socket
		this.tokenMap = tokenMap
		this.shell = shell
		this.name = name
		this.socket.on('data', data => this.handleData(String(data)))
	}

	// TODO: do we have to deal with partial messages?
	private handleData(message: string) {
		const request = validateBaseMessageFormat(message)
		if(request.type === 'error') {
			answerForValidationError(this.socket, request)
			return
		}
		switch(request.message.type) {
			case 'request-file-analysis':
				this.handleFileAnalysisRequest(request.message as FileAnalysisRequestMessage)
				break
			case 'request-slice':
				this.handleSliceRequest(request.message as SliceRequestMessage)
				break
			default:
				sendMessage<FlowrErrorMessage>(this.socket, {
					type:   'error',
					fatal:  true,
					reason: `The message type ${JSON.stringify(request.type ?? 'undefined')} is not supported.`
				})
				this.socket.end()
		}
	}

	// TODO: do not crash with errors!

	// TODO: add name to clients?
	// TODO: integrate this with lsp?
	private handleFileAnalysisRequest(base: FileAnalysisRequestMessage) {
		const requestResult = validateMessage(base, requestAnalysisMessage)
		if(requestResult.type === 'error') {
			answerForValidationError(this.socket, requestResult)
			return
		}
		const message = requestResult.message
		console.log(`[${this.name}] Received file analysis request for ${message.filename} (token: ${message.filetoken})`)

		// TODO: guard with json schema so that all are correctly keys given
		if(this.fileMap.has(message.filetoken)) {
			console.log(`File token ${message.filetoken} already exists. Overwriting.`)
		}
		const slicer = new SteppingSlicer({
			stepOfInterest: LAST_STEP,
			shell:          this.shell,
			tokenMap:       this.tokenMap,
			request:        {
				request:                 'text',
				content:                 message.content,
				attachSourceInformation: true,
				ensurePackageInstalled:  true
			},
			criterion: [] // currently unknown
			// TODO: allow to configure the rest?
		})
		this.fileMap.set(message.filetoken, {
			filename: message.filename,
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
		console.log(`[${request.filetoken}] Received slice request with criteria ${JSON.stringify(request.criterion)}`)

		const fileInformation = this.fileMap.get(request.filetoken)
		if(!fileInformation) {
			sendMessage<FlowrErrorMessage>(this.socket, {
				type:   'error',
				fatal:  false,
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
