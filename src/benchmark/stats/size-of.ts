import type { IEnvironment } from '../../dataflow/environments/environment';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ControlFlowGraph } from '../../control-flow/control-flow-graph';
import { Vertex, type DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { type BrandedIdentifier, type IdentifierDefinition, ReferenceType } from '../../dataflow/environments/identifier';
import sizeof from 'object-sizeof';
import { compactRecord } from '../../util/objects';

/** the stripped copy of a frame that {@link killBuiltInEnv} hands to `sizeof`; it holds a plain map, not a frame view */
interface SizedEnvironment {
	readonly id:          number;
	readonly parent:      SizedEnvironment;
	readonly memory:      ReadonlyMap<BrandedIdentifier, IdentifierDefinition[]>;
	readonly builtInEnv?: true;
}

/* we have to kill all processors linked in the default environment as they cannot be serialized and they are shared anyway */
function killBuiltInEnv(env: IEnvironment | undefined): SizedEnvironment {

	if(env === undefined) {
		return undefined as unknown as SizedEnvironment;
	} else if(env.builtInEnv) {
		/* in this case, the reference would be shared for sure */
		return {
			id:         env.id,
			parent:     killBuiltInEnv(env.parent),
			memory:     new Map<BrandedIdentifier, IdentifierDefinition[]>(),
			builtInEnv: true
		};
	}

	const memory = new Map<BrandedIdentifier, IdentifierDefinition[]>();
	for(const [k, v] of env.memory) {
		memory.set(k, v.filter(v => v.type !== ReferenceType.BuiltInFunction && v.type !== ReferenceType.BuiltInConstant && !('processor' in v)));
	}

	return {
		id:     env.id,
		parent: killBuiltInEnv(env.parent),
		memory
	};
}

/**
 * The memory the dataflow graph occupies, including the control flow it carries
 * (see {@link getSizeOfCfGraph} for what a separate control flow graph costs on top of that).
 */
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

		if(Vertex.isFunctionDefinition(vertex)) {
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
 * The memory the control flow graph occupies on top of the dataflow graph it is a view on.
 * Asking for it projects the view, so this is the cost of holding the control flow separately rather than
 * walking it on the dataflow graph.
 */
export function getSizeOfCfGraph(cfg: ControlFlowGraph): number {
	return safeSizeOf([...cfg.vertices(true).values(), ...cfg.edges()]);
}

/**
 * Calculates the size of an array in bytes.
 * @param array - The array to calculate the size of.
 * @returns     The size of the array in bytes.
 */
export function safeSizeOf<T>(array: T[]): number {
	const size = sizeof(array) as number | unknown;

	if(typeof size === 'number') {
		return size;
	}

	// the sizeOf method returns an error object, when the size could not be calculated
	// in this case, we split the array in half and calculate the size of each half recursively
	const chunkSize = Math.ceil(array.length / 2);
	// subtract 1, because of the separate stringification of the array
	return safeSizeOf(array.slice(0, chunkSize)) + safeSizeOf(array.slice(chunkSize)) - 1;
}
