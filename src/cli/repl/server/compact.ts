import { jsonReplacer } from '../../../util/json';
import msgpack from '@msgpack/msgpack';

export function compact(obj: unknown): Buffer {
	return Buffer.from(msgpack.encode(JSON.parse(JSON.stringify(obj, jsonReplacer))));
}

export function uncompact(buf: Buffer | Uint8Array): unknown {
	return msgpack.decode(new Uint8Array(Buffer.from(buf)));
}