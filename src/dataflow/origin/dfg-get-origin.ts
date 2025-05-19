import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../graph/graph';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexUse,
	DataflowGraphVertexVariableDefinition
} from '../graph/vertex';
import { VertexType } from '../graph/vertex';
import type { EdgeTypeBits } from '../graph/edge';
import { edgeDoesNotIncludeType, edgeIncludesType, EdgeType } from '../graph/edge';
import { getAllFunctionCallTargets } from '../internal/linker';
import { isNotUndefined } from '../../util/assert';
import { isBuiltIn } from '../environments/built-in';


export const enum OriginType {
    ReadVariableOrigin = 0,
    WriteVariableOrigin = 1,
    FunctionCallOrigin = 2,
    BuiltInFunctionOrigin = 3,
    ConstantOrigin = 4
}

/**
 * An origin that indicates that the definition is read, written, or simply a constant.
 * These origins only reference the 'direct' dependencies. There is no transitivity.
 *
 * @example
 * ```r
 * x <- 2
 * print(x)
 * ```
 *
 * - Requesting the origins for the use of `x` in `print(x)` returns a {@link ReadVariableOrigin} for the definition of `x` in the first line.
 * - Asking for the origin of the `2` in `x <- 2` returns a {@link ConstantOrigin} for itself.
 * - Asking for the origin of `x` in `x <- 2` returns a {@link WriteVariableOrigin} for the variable `x`.
 */
export interface SimpleOrigin {
    readonly type: OriginType.ReadVariableOrigin | OriginType.WriteVariableOrigin | OriginType.ConstantOrigin;
    readonly id:   NodeId;
}

/**
 * Determines the (transitive) origin of a function call (i.e., all anonymous function definitions within the program that
 * can be called).
 *
 * @example
 * ```r
 * f <- function(x) {
 *  function(y) { y + x }
 * }
 * g <- f(2)
 * g(3)
 * ```
 *
 * - Requesting the origin of `g(3)` returns a {@link FunctionCallOrigin} for the anonymous function defined and returned within the body of `f`.
 * - Requesting the origin of `f(2)` returns a {@link FunctionCallOrigin} for the anonymous function bound to f.
 *
 * Either also return the {@link SimpleOrigin} for the read of the respective variable definition.
 */
export interface FunctionCallOrigin {
    readonly type: OriginType.FunctionCallOrigin;
    readonly id:   NodeId;
}

/**
 * This is similar to a {@link FunctionCallOrigin}, but used for built-in functions that have no direct correspondence in the dataflow graph.
 */
export interface BuiltInFunctionOrigin {
    readonly type: OriginType.BuiltInFunctionOrigin;
	/** processor that is used to process the built-in function */
    readonly id:   NodeId;
    readonly proc: string;
    readonly fn:   OriginIdentifier;
}


interface OriginIdentifier {
    readonly name:       string;
    readonly namespace?: string;
}

export type Origin = SimpleOrigin | FunctionCallOrigin | BuiltInFunctionOrigin;

/**
 * Obtain the (dataflow) origin of a given node in the dfg.
 * @example consider the following code:
 * ```r
 * x <- 2
 * if(u) {
 *   x <- 3
 * }
 * print(x)
 * ```
 * Requesting the origin of `x` in the `print(x)` node yields two {@link SimpleOriginOrigin|variable origins} for both
 * definitions of `x`.
 * Similarly, requesting the origin of `print` returns a {@link BuiltInFunctionOrigin|`BuiltInFunctionOrigin`}.
 *
 * This returns undefined only if there is no dataflow correspondence (e.g. in case of unevaluated non-standard eval).
 */
export function getOriginInDfg(dfg: DataflowGraph, id: NodeId): Origin[] | undefined {
	const vtx = dfg.getVertex(id);
	switch(vtx?.tag) {
		case undefined:
			return undefined;
		case VertexType.Value:
			return [{ type: OriginType.ConstantOrigin, id }];
		case VertexType.FunctionDefinition:
			return [{ type: OriginType.ConstantOrigin, id }];
		case VertexType.VariableDefinition:
			return getVariableDefinitionOrigin(dfg, vtx);
		case VertexType.Use:
			return getVariableUseOrigin(dfg, vtx);
		case VertexType.FunctionCall:
			return getCallTarget(dfg, vtx);
	}
}

const WantedVariableTypes: EdgeTypeBits = EdgeType.Reads | EdgeType.DefinedByOnCall;
const UnwantedVariableTypes: EdgeTypeBits = EdgeType.NonStandardEvaluation;
function getVariableUseOrigin(dfg: DataflowGraph, use: DataflowGraphVertexUse): Origin[] | undefined {
	// to identify the origins we have to track read edges and definitions on function calls
	const origins: Origin[] = [];
	for(const [target, { types }] of dfg.outgoingEdges(use.id) ?? []) {
		if(edgeDoesNotIncludeType(types, WantedVariableTypes) || edgeIncludesType(types, UnwantedVariableTypes)) {
			continue;
		}

		const targetVtx = dfg.getVertex(target);
		if(!targetVtx) {
			continue;
		}

		if(targetVtx.tag === VertexType.VariableDefinition) {
			origins.push({
				type: OriginType.ReadVariableOrigin,
				id:   target
			});
		}
	}
	return origins.length > 0 ? origins : undefined;
}

function getVariableDefinitionOrigin(dfg: DataflowGraph, vtx: DataflowGraphVertexVariableDefinition): Origin[] | undefined {
	const pool: Origin[] = [{ type: OriginType.WriteVariableOrigin, id: vtx.id }];

	const outgoingReads = dfg.outgoingEdges(vtx.id) ?? [];
	for(const [target, { types }] of outgoingReads) {
		if(edgeIncludesType(types, EdgeType.Reads)) {
			const targetVtx = dfg.getVertex(target);
			if(!targetVtx) {
				continue;
			}
			if(targetVtx.tag === VertexType.VariableDefinition) {
				pool.push({
					type: OriginType.ReadVariableOrigin,
					id:   target
				});
			}
		}
	}
	return pool;
}

function getCallTarget(dfg: DataflowGraph, call: DataflowGraphVertexFunctionCall): Origin[] | undefined {
	// check for built-ins:
	const builtInTarget = call.origin !== 'unnamed' && call.origin.filter(o => o.startsWith('builtin:'));

	let origins: Origin[] | undefined = builtInTarget ? builtInTarget.map(o => ({
		type: OriginType.BuiltInFunctionOrigin,
		fn:   { name: call.name },
		id:   call.id,
		proc: o
	})) : undefined;

	const targets = new Set(getAllFunctionCallTargets(call.id, dfg));
	if(targets.size === 0) {
		return origins;
	}
	origins = (origins ?? []).concat([...targets].map(target => {
		if(isBuiltIn(target)) {
			return {
				type: OriginType.BuiltInFunctionOrigin,
				fn:   { name: call.name },
				id:   call.id,
				proc: target
			};
		}
		const get = dfg.getVertex(target);
		if(get?.tag !== VertexType.FunctionDefinition && get?.tag !== VertexType.VariableDefinition) {
			return undefined;
		}
		return {
			type: get.tag === VertexType.FunctionDefinition ? (OriginType.FunctionCallOrigin as const) : (OriginType.ReadVariableOrigin as const),
			id:   target
		};
	}).filter(isNotUndefined));


	return origins;
}
