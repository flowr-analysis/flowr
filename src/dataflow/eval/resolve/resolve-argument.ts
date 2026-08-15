import { type DataflowGraph, FunctionArgument } from '../../graph/graph';
import { RValue } from '../values/r-value';
import type { DataflowGraphVertexFunctionCall } from '../../graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isNotUndefined } from '../../../util/assert';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { Constant, Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from '../../environments/environment';
import { valueSetGuard } from '../values/general';
import { resolveIdToValue } from './alias-tracking';
import { isValue, type Value } from '../values/r-value';
import { RFalse, RTrue } from '../../../r-bridge/lang-4.x/convert-values';
import { collectStrings } from '../values/string/string-constants';
import type { VariableResolve } from '../../../config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';

/**
 * Get the values of all arguments matching the criteria.
 */
export function getArgumentStringValue(
	variableResolve: VariableResolve,
	graph: DataflowGraph,
	vertex: DataflowGraphVertexFunctionCall,
	argumentIndex: number | 'unnamed' | undefined,
	argumentName: string | undefined,
	resolveValue: boolean | 'library' | undefined,
	ctx: ReadOnlyFlowrAnalyzerContext
): Map<NodeId, Set<string | undefined>> | undefined {
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
		const references = vertex.args.filter(arg => arg !== EmptyArgument && !arg.name).map(FunctionArgument.getReference).filter(isNotUndefined);

		const map = new Map<NodeId, Set<string | undefined>>();
		for(const ref of references) {
			let valueNode = graph.idMap?.get(ref);
			if(valueNode?.type === RType.Argument) {
				valueNode = valueNode.value;
			}
			if(valueNode) {
				// this should be evaluated in the callee-context
				const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue, ctx) ?? [Unknown];
				map.set(ref, new Set(values));
			}
		}
		return map;
	}
	if(argumentIndex < vertex.args.length) {
		const arg = FunctionArgument.getReference(vertex.args[argumentIndex]);
		if(!arg) {
			return undefined;
		}
		let valueNode = graph.idMap?.get(arg);
		if(valueNode?.type === RType.Argument) {
			valueNode = valueNode.value;
		}

		if(valueNode) {
			const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue, ctx) ?? [Unknown];
			return new Map([[arg, new Set(values)]]);
		}
	}
	return undefined;
}


function hasCharacterOnly(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, idMap: Map<NodeId, RNode> | undefined, ctx: ReadOnlyFlowrAnalyzerContext): boolean | 'maybe' {
	if(!vertex.args || vertex.args.length === 0 || !idMap) {
		return false;
	}
	const treatAsChar = getArgumentStringValue(variableResolve, graph, vertex, 5, 'character.only', true, ctx);
	if(!treatAsChar) {
		return false;
	}
	const hasTrue = treatAsChar.values().some(set => set?.has('TRUE'));
	const hasFalse = hasTrue ? treatAsChar.values().some(set => set === undefined || set.has('FALSE')) : false;
	if(hasTrue && hasFalse) {
		return 'maybe';
	} else {
		return hasTrue;
	}
}

function resolveBasedOnConfig(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argument: RNodeWithParent, environment: REnvironmentInformation | undefined, idMap: Map<NodeId, RNode> | undefined, resolveValue: boolean | 'library' | undefined, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	let full = true;
	if(!resolveValue) {
		full = false;
	}

	if(resolveValue === 'library') {
		const hasChar = hasCharacterOnly(variableResolve, graph, vertex, idMap, ctx);
		if(hasChar === false) {
			if(argument.type === RType.Symbol) {
				return [argument.lexeme];
			}
			full = false;
		}
	}

	const resolved = valueSetGuard(resolveIdToValue(argument, { environment, graph, full, resolve: variableResolve, ctx }));
	if(resolved) {
		const values: string[] = [];
		for(const value of resolved.elements) {
			const strings = isValue(value) ? stringsOfValue(value, full) : undefined;
			if(strings === undefined) {
				return undefined;
			}
			values.push(...strings);
		}
		return values;
	}
}

/**
 * The strings a resolved value stands for. A value that is no string is data given inline and hence reported as
 * {@link Constant}, so that a consumer can tell it apart from a value we failed to resolve ({@link Unknown}).
 */
function stringsOfValue(value: Value, full: boolean): string[] | undefined {
	switch(value.type) {
		case 'string': {
			const str = RValue.stringOf(value);
			return str !== undefined ? [str] : undefined;
		}
		case 'logical':
			return isValue(value.value) ? [value.value.valueOf() ? RTrue : RFalse] : undefined;
		case 'vector':
			return isValue(value.elements)
				? collectStrings(value.elements, !full) ?? (value.elements.every(isValue) ? [Constant] : undefined)
				: undefined;
		case 'number':
		case 'interval':
		case 'null':
			return [Constant];
		default:
			return undefined;
	}
}
