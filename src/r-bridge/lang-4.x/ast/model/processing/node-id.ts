import type { AstIdMap } from './decorate';
import type { DataflowGraph } from '../../../../../dataflow/graph/graph';
import { VertexType } from '../../../../../dataflow/graph/vertex';
import { removeRQuotes } from '../../../../retriever';
import { Identifier } from '../../../../../dataflow/environments/identifier';
import { RNode } from '../model';

/** The type of the id assigned to each node. Branded to avoid problematic usages with other string or numeric types. */
export type NodeId<T extends string | number = string | number> = T & { __brand?: 'node-id' };

/**
 * A variant of {@link NodeId} that represents built-in functions or operators. The string is prefixed with `built-in:` to avoid confusion with other node ids.
 */
export type BuiltIn<T extends string = string> = `built-in:${T}`;

/**
 * The type of the id assigned to each node. Branded to avoid problematic usages with other string or numeric types.
 * The default ids are numeric, but we use a branded type to avoid confusion with other numeric types.
 * Custom ids or scoped ids can be strings, but they will be normalized to numbers if they are numeric strings.
 */
export const NodeId = {
	name: 'NodeId',
	/**
	 * Normalizes a node id by converting numeric strings to numbers.
	 * This allows us to use numeric ids without storing them as strings, while still allowing custom string ids if needed.
	 */
	normalize(this: void, id: NodeId): NodeId {
		// check if string is number
		if(typeof id === 'string') {
			/* typescript is a beautiful converter */
			const num = +id;
			if(!Number.isNaN(num)) {
				return num as NodeId;
			}
		}
		return id;
	},
	/**
	 * The prefix used for built-in function or operator ids.
	 */
	builtInPrefix: 'built-in:',
	/**
	 * Checks if a given node id is a built-in function or operator id by checking if it is a string that starts with the built-in prefix.
	 * @see {@link toBuiltIn} - to convert a built-in function or operator name to a built-in id
	 * @see {@link fromBuiltIn} - to recover the built-in function or operator name from a built-in id
	 */
	isBuiltIn(this: void, id: BuiltIn | NodeId | undefined): id is BuiltIn {
		return typeof id === 'string' && id.startsWith(NodeId.builtInPrefix);
	},
	/**
	 * Converts a built-in function or operator name to a built-in id by prefixing it with the built-in prefix.
	 * @see {@link isBuiltIn} - to check if a given node id is a built-in function or operator id
	 * @see {@link fromBuiltIn} - to recover the built-in function or operator name from a built-in id
	 */
	toBuiltIn<T extends string>(this: void, name: T): BuiltIn<T> {
		return `built-in:${name}`;
	},
	/**
	 * Recovers the built-in function or operator name from a built-in id by removing the built-in prefix.
	 * @see {@link isBuiltIn} - to check if a given node id is a built-in function or operator id
	 * @see {@link toBuiltIn} - to convert a built-in function or operator name to a built-in id
	 */
	fromBuiltIn<T extends string>(this: void, id: BuiltIn<T>): T {
		return id.slice(builtInPrefixLength) as T;
	}
} as const;

const builtInPrefixLength = NodeId.builtInPrefix.length;


/**
 * Recovers the lexeme of a {@link RNode|node} from its id in the {@link AstIdMap|id map}.
 * @see {@link recoverContent} - to recover the content of a node
 */
export function recoverName(id: NodeId, idMap?: AstIdMap): string | undefined {
	return idMap?.get(id)?.lexeme;
}

/**
 * Recovers the content of a {@link RNode|node} from its id in the {@link DataflowGraph|dataflow graph}.
 */
export function recoverContent(id: NodeId, graph: DataflowGraph): string | undefined {
	const vertex = graph.getVertex(id);
	if(vertex && vertex.tag === VertexType.FunctionCall && vertex.name) {
		return Identifier.toString(vertex.name);
	}
	const node = graph.idMap?.get(id);
	if(node === undefined) {
		return undefined;
	}
	const lexeme = node.lexeme ?? node.info.fullLexeme ?? '';
	if(vertex?.tag === VertexType.Use) {
		return removeRQuotes(lexeme);
	}
	return lexeme;
}
