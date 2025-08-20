import type { IEnvironment } from '../../dataflow/environments/environment';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { VertexType } from '../../dataflow/graph/vertex';
import type { Identifier, IdentifierDefinition } from '../../dataflow/environments/identifier';
import { ReferenceType } from '../../dataflow/environments/identifier';
import sizeof from 'object-sizeof';
import { compactRecord } from '../../util/objects';

/* we have to kill all processors linked in the default environment as they cannot be serialized and they are shared anyway */
function killBuiltInEnv(env: IEnvironment | undefined): IEnvironment {

	if(env === undefined) {
		return undefined as unknown as IEnvironment;
	} else if(env.builtInEnv) {
		/* in this case, the reference would be shared for sure */
		return {
			id:         env.id,
			parent:     killBuiltInEnv(env.parent),
			memory:     new Map<Identifier, IdentifierDefinition[]>(),
			builtInEnv: true
		};
	}

	const memory = new Map<Identifier, IdentifierDefinition[]>();
	for(const [k, v] of env.memory) {
		memory.set(k, v.filter(v => v.type !== ReferenceType.BuiltInFunction && v.type !== ReferenceType.BuiltInConstant && !('processor' in v)));
	}

	return {
		id:     env.id,
		parent: killBuiltInEnv(env.parent),
		memory
	};
}

/** Returns the size of the given df graph in bytes (without sharing in-memory) */
export function getSizeOfDfGraph(df: DataflowGraph): number {
	const verts = [];
	for(const [, v] of df.vertices(true)) {
		let vertex: DataflowGraphVertexInfo = v;

		if(vertex.environment) {
			vertex = {
				...vertex,
				environment: {
					...vertex.environment,
					current: killBuiltInEnv(v.environment?.current)
				}
			} as DataflowGraphVertexInfo;
		}

		if(vertex.tag === VertexType.FunctionDefinition) {
			vertex = {
				...vertex,
				subflow: {
					...vertex.subflow,
					environment: {
						...vertex.subflow.environment,
						current: killBuiltInEnv(vertex.subflow.environment.current)
					}
				}
			} as DataflowGraphVertexInfo;
		}

		vertex = compactRecord({
			...vertex,
			/* shared anyway by using constants */
			tag: undefined
		}) as DataflowGraphVertexInfo;

		verts.push(vertex);
	}

	return safeSizeOf([...verts, ...df.edges()]);
}

/**
 * Calculates the size of an array in bytes.
 *
 * @param array - The array to calculate the size of.
 * @returns The size of the array in bytes.
 */
export function safeSizeOf<T>(array: T[]): number {
	const size = sizeof(array);

	if(typeof size === 'number') {
		return size;
	}

	// the sizeOf method returns an error object, when the size could not be calculated
	// in this case, we split the array in half and calculate the size of each half recursively
	const chunkSize = Math.ceil(array.length / 2);
	// subtract 1, because of the separate stringification of the array
	return safeSizeOf(array.slice(0, chunkSize)) + safeSizeOf(array.slice(chunkSize)) - 1;
}
