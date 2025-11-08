import type { IdMessageBase } from './messages/all-messages';
import type { Socket } from './net';
import { superBigJsonStringify } from '../../../util/json';

/**
 *
 */
export function getUnnamedSocketName(c: Socket): string {
	return `${c.remoteAddress ?? '?'}@${c.remotePort ?? '?'}`;
}


/**
 *
 */
export function sendMessage<T extends IdMessageBase>(c: Socket, message: T): void {
	return superBigJsonStringify(message, '\n', msg => {
		c.write(msg);
	});
}
