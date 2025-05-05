import { jsonReplacer } from '../../../util/json';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

export function compact(obj: unknown): string {
	return compressToUTF16(JSON.stringify(obj, jsonReplacer));
}

export function uncompact(buf: string): unknown {
	return JSON.parse(decompressFromUTF16(buf));
}