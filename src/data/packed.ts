import { decompressFromBase64 } from 'lz-string';

/**
 * A value packed by `scripts/pack-generated.ts`: a table of nodes in which every distinct string, number, array and object is
 * stored once, the last node being the value. An array node lists the indices of its elements, an object node starts with
 * `-1 - i` for the node `i` listing its keys, followed by the indices of their values. Any other node is the plain value.
 */
export type Packed = readonly (string | number | boolean | null | readonly number[])[];

/** The value of a {@link Packed} table. Equal parts are shared, do not change them. */
export function unpack<T>(nodes: Packed): T {
	const done: unknown[] = [];
	const at = (i: number): unknown => i in done ? done[i] : (done[i] = build(nodes[i]));
	const build = (node: Packed[number]): unknown => {
		if(!Array.isArray(node)) {
			return node;
		} else if(node.length === 0 || (node[0] as number) >= 0) {
			return node.map(at);
		}
		const keys = at(-1 - (node[0] as number)) as string[];
		return Object.fromEntries(keys.map((k, j) => [k, at(node[j + 1] as number)]));
	};
	return at(nodes.length - 1) as T;
}

/** Decompresses generated data on the first call. The data is the JSON of a {@link Packed} table (prefix `p`) or of the value (prefix `r`). */
export function unpacked<T>(data: string): () => T {
	let value: T | undefined;
	return () => {
		if(value === undefined) {
			const json = JSON.parse(decompressFromBase64(data.slice(1))) as unknown;
			value = data[0] === 'p' ? unpack<T>(json as Packed) : json as T;
		}
		return value;
	};
}
