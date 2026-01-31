import type { IdMessageBase } from './messages/all-messages';
import type { Socket } from './net';
import { superBigJsonStringify } from '../../../util/json';

/**
 * Produce a new name for an unnamed socket connection
 */
export function getUnnamedSocketName(c: Socket): string {
	return `${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`;
}


/**
 * Sends a message to the given socket
 */
export function sendMessage<T extends IdMessageBase>(c: Socket, message: T): void {
	return superBigJsonStringify(message, '\n', msg => {
		c.write(msg);
	});
}
