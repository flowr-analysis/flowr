import { jsonReplacer } from '../../../util/json';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';


/**
 * Compacts an object into a UTF-16 compressed string.
 * @see {@link uncompact}
 */
export function compact(obj: unknown): string {
	return compressToUTF16(JSON.stringify(obj, jsonReplacer));
}


/**
 * Uncompacts a UTF-16 compressed string into an object.
 * @see {@link compact}
 */
export function uncompact(buf: string): unknown {
	return JSON.parse(decompressFromUTF16(buf));
}