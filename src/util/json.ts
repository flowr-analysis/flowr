// to get the types within JSON.stringify


import { builtInEnvJsonReplacer, isDefaultBuiltInEnvironment } from '../dataflow/environments/environment';

export function jsonReplacer(key: unknown, value: unknown): unknown {
	if(key === 'fullLexeme') {
		return undefined;
	} else if(value instanceof Map || value instanceof Set) {
		return [...value];
	} else if(typeof value === 'bigint') {
		return `${value.toString()}n`;
	} else {
		return value;
	}
}

export function jsonBigIntRetriever(key: string, value: unknown): unknown {
	if(typeof value === 'string' && value.endsWith('n')) {
		return BigInt(value.slice(0, -1));
	} else {
		return value;
	}
}


export function superBigJsonStringify(obj: unknown, end: string, send: (s: string) => void): void {
	try {
		const tryOut = JSON.stringify(obj, jsonReplacer) + end;
		send(tryOut);
	} catch{
		/* let's try the sad path! */
		const remainder = bigStringify(obj, '', send);
		send(remainder + end);
	}
}

function bigStringify(obj: unknown, current: string, send: (s: string) => void): string {
	if(current.length > 20_000) {
		send(current);
		current = '';
	}
	if(obj === undefined || obj === null) {
		return current + 'null';
	} else if(isDefaultBuiltInEnvironment(obj)) {
		return current + '<BuiltInEnvironment>';
	// TODO TSchoeller Is this case important?
	//} else if(obj === EmptyBuiltInEnvironment) {
	//	return current + '<EmptyBuiltInEnvironment>';
	} else if(Array.isArray(obj)) {
		let str = current + '[';
		for(let i = 0; i < obj.length; i++) {
			if(i > 0) {
				str += ',';
			}
			str = bigStringify(obj[i], str, send);
			if(str.length > 20_000) {
				send(str);
				str = '';
			}
		}
		return str + ']';
	} else if(obj instanceof Map || obj instanceof Set) {
		let str = current + '[';
		let i = 0;
		for(const value of obj) {
			if(i++ > 0) {
				str += ',';
			}
			str = bigStringify(value, str, send);
			if(str.length > 20_000) {
				send(str);
				str = '';
			}
		}
		return str + ']';
	} else if(typeof obj === 'bigint') {
		return current + `${obj.toString()}n`;
	} else if(obj instanceof Date) {
		return current + `"${obj.toISOString()}"`;
	} else if(obj instanceof RegExp) {
		return current + `"${obj.toString()}"`;
	} else if(typeof obj === 'object') {
		let str = current + '{';
		let i = 0;
		for(const key in obj) {
			if(Object.hasOwn(obj, key)) {
				// @ts-expect-error - We know that obj[key] is not undefined, it its own property
				const value: unknown = obj[key];
				if(value === undefined || typeof value === 'function' || typeof value === 'symbol' || key === 'info') {
					continue;
				}
				if(i++ > 0) {
					str += ',';
				}
				str += `"${key}":`;
				str = bigStringify(value, str, send);
				if(str.length > 20_000) {
					send(str);
					str = '';
				}
			}
		}
		return str + '}';
	} else if(typeof obj === 'function' || typeof obj === 'symbol') {
		return current + 'null'; // Optionally skip functions and symbols
	} else {
		return current + JSON.stringify(obj, builtInEnvJsonReplacer);
	}
}


