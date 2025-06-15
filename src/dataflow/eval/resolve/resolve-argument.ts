import type { DataflowGraph } from '../../graph/graph';
import { getReferenceOfArgument } from '../../graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isNotUndefined } from '../../../util/assert';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from '../../environments/environment';
import { valueSetGuard } from '../values/general';
import { resolveIdToValue } from './alias-tracking';
import { isValue } from '../values/r-value';
import { RFalse, RTrue } from '../../../r-bridge/lang-4.x/convert-values';
import { collectStrings } from '../values/string/string-constants';

/**
 * Get the values of all arguments matching the criteria.
 */
export function getArgumentStringValue(
	graph: DataflowGraph,
	vertex: DataflowGraphVertexFunctionCall,
	argumentIndex: number | 'unnamed' | undefined,
	argumentName: string | undefined,
	resolveValue : boolean | 'library' | undefined
): Map<NodeId, Set<string|undefined>> | undefined {
	if(argumentName) {
		const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === argumentName);
		if(arg >= 0) {
			argumentIndex = arg;
		}
	}

	if(!vertex || argumentIndex === undefined) {
		return undefined;
	}
	if(argumentIndex === 'unnamed') {
		// return all unnamed arguments
		const references = vertex.args.filter(arg => arg !== EmptyArgument && !arg.name).map(getReferenceOfArgument).filter(isNotUndefined);

		const map = new Map<NodeId, Set<string|undefined>>();
		for(const ref of references) {
			let valueNode = graph.idMap?.get(ref);
			if(valueNode?.type === RType.Argument) {
				valueNode = valueNode.value;
			}
			if(valueNode) {
				// this should be evaluated in the callee-context
				const values = resolveBasedOnConfig(graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue) ?? [Unknown];
				map.set(ref, new Set(values));
			}
		}
		return map;
	}
	if(argumentIndex < vertex.args.length) {
		const arg = getReferenceOfArgument(vertex.args[argumentIndex]);
		if(!arg) {
			return undefined;
		}
		let valueNode = graph.idMap?.get(arg);
		if(valueNode?.type === RType.Argument) {
			valueNode = valueNode.value;
		}

		if(valueNode) {
			const values = resolveBasedOnConfig(graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue) ?? [Unknown];
			return new Map([[arg, new Set(values)]]);
		}
	}
	return undefined;
}


function hasCharacterOnly(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, idMap: Map<NodeId, RNode> | undefined): boolean | 'maybe' {
	if(!vertex.args || vertex.args.length === 0 || !idMap) {
		return false;
	}
	const treatAsChar = getArgumentStringValue(graph, vertex, 5, 'character.only', true);
	if(!treatAsChar) {
		return false;
	}
	const hasTrue = [...treatAsChar.values()].some(set => set?.has('TRUE'));
	const hasFalse = hasTrue ? [...treatAsChar.values()].some(set => set === undefined || set.has('FALSE')) : false;
	if(hasTrue && hasFalse) {
		return 'maybe';
	} else {
		return hasTrue;
	}
}
function resolveBasedOnConfig(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argument: RNodeWithParent, environment: REnvironmentInformation | undefined, idMap: Map<NodeId, RNode> | undefined, resolveValue : boolean | 'library' | undefined): string[] | undefined {
	let full = true;
	if(!resolveValue) {
		full = false;
	}

	if(resolveValue === 'library') {
		const hasChar = hasCharacterOnly(graph, vertex, idMap);
		if(hasChar === false) {
			if(argument.type === RType.Symbol) {
				return [argument.lexeme];
			}
			full = false;
		}
	}

	const resolved = valueSetGuard(resolveIdToValue(argument, { environment, graph, full }));
	if(resolved) {
		const values: string[] = [];
		for(const value of resolved.elements) {
			if(!isValue(value)) {
				return undefined;
			} else if(value.type === 'string' && isValue(value.value)) {
				values.push(value.value.str);
			} else if(value.type === 'logical' && isValue(value.value)) {
				values.push(value.value.valueOf() ? RTrue : RFalse);
			} else if(value.type === 'vector' && isValue(value.elements)) {
				const elements = collectStrings(value.elements, !full);
				if(elements === undefined) {
					return undefined;
				}
				values.push(...elements);

			} else {
				return undefined;
			}
		}
		return values;
	}
}