import net from 'node:net'
import { jsonReplacer } from '../../../util/json'
import { FlowrBaseMessage } from './messages/messages'

export function getUnnamedSocketName(c: net.Socket): string {
	return `${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`
}

export function sendMessage<T extends FlowrBaseMessage>(c: net.Socket, message: T): void {
	const msg = JSON.stringify(message, jsonReplacer)
	console.log(`[${getUnnamedSocketName(c)}] sending message: ${msg}`)
	c.write(`${msg}\n`)
}
