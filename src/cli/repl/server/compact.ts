import { jsonReplacer } from '../../../util/json';
import { encode, decode } from '@msgpack/msgpack';

export function compact(obj: unknown): Buffer {
	return Buffer.from(encode(JSON.parse(JSON.stringify(obj, jsonReplacer))));
}

export function uncompact(buf: Buffer | Uint8Array): unknown {
	return decode(new Uint8Array(Buffer.from(buf)));
}