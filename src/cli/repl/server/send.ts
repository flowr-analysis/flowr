import { jsonReplacer } from '../../../util/json'
import { FlowrBaseMessage } from './messages/messages'
import { Socket } from './net'

export function getUnnamedSocketName(c: Socket): string {
	return `${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`
}

export function sendMessage<T extends FlowrBaseMessage>(c: Socket, message: T): void {
	const msg = JSON.stringify(message, jsonReplacer)
	console.log(`[${getUnnamedSocketName(c)}] sending message: ${msg}`)
	c.write(`${msg}\n`)
}
