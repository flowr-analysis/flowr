import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { guard } from '../../../util/assert';
import { BuiltInEvalHandlerMapper } from '../../environments/built-in';
import type { REnvironmentInformation } from '../../environments/environment';
import type { DataflowGraph } from '../../graph/graph';
import { getOriginInDfg, OriginType } from '../../origin/dfg-get-origin';
import { intervalFrom } from '../values/intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import type { Value } from '../values/r-value';
import { isTop, Top } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import { resolveIdToValue } from './alias-tracking';

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if 
 * you want to resolve the value of an identifier / node
 * 
 * This function converts an RNode to its Value, but also recursively resolves
 * aliases and vectors (in case of a vector). 
 * 
 * @param a     - Ast node to resolve
 * @param env   - Environment to use
 * @param graph - Dataflow Graph to use
 * @param map   - Idmap of Dataflow Graph
 * @returns resolved value or top/bottom
 */
export function resolveNode(a: RNodeWithParent, env?: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap): Value {
	if(a.type === RType.String) {
		return stringFrom(a.content.str);
	} else if(a.type === RType.Number) {
		return intervalFrom(a.content.num, a.content.num);	
	} else if(a.type === RType.Logical) {
		return a.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(a.type === RType.FunctionCall && env && graph) {
		const origin = getOriginInDfg(graph, a.info.id)?.[0];
		if(origin === undefined || origin.type !== OriginType.BuiltInFunctionOrigin) {
			return Top;
		}

		if(origin.proc in BuiltInEvalHandlerMapper) {
			const handler = BuiltInEvalHandlerMapper[origin.proc as keyof typeof BuiltInEvalHandlerMapper];
			return handler(a, env, graph, map);
		}
	}
	return Top;
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if 
 * you want to resolve the value of an identifier / node
 * 
 * This function converts an r-node to a Value Vector {@link vectorFrom}
 * It also recursively resolves any symbols, values, function calls (only c), in
 * order to construct the value of the vector to resolve by calling {@link resolveIdToValue}
 * or {@link resolveNode}
 * 
 * @param a     - Node of the vector to resolve
 * @param env   - Environment to use
 * @param graph - Dataflow graph
 * @param map   - Idmap of Dataflow Graph
 * @returns ValueVector or Top
 */
export function resolveAsVector(a: RNodeWithParent, env: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap): Value {
	guard(a.type === RType.FunctionCall);

	const values: Value[] = [];
	for(const arg of a.arguments) {
		if(arg === EmptyArgument) {
			continue;
		}
		
		if(arg.value === undefined) {
			return Top;
		}


		if(arg.value.type === RType.Symbol) {
			const value = resolveIdToValue(arg.info.id, { environment: env, idMap: map, graph: graph, full: true });
			if(isTop(value)) {
				return Top;
			}

			values.push(value);
		} else {
			const val = resolveNode(arg.value, env, graph, map);
			if(isTop(val)) {
				return Top;
			}
	
			values.push(val);
		}
	}

	return vectorFrom(flattenVectorElements(values));
}