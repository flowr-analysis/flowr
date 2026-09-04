import { type DataflowGraph, FunctionArgument } from '../../graph/graph';
import { RValue } from '../values/r-value';
import type { DataflowGraphVertexFunctionCall } from '../../graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isNotUndefined } from '../../../util/assert';
import { DfgVertex } from '../../graph/vertex';
import { DfEdge, EdgeType } from '../../graph/edge';
import { callFnProps } from '../../environments/query-fn-props';
import { ArgProp, SemanticCallTag } from '../../environments/built-in-props';
import { FunctionSemantics } from '../../fn/function-semantics';
import { Constant, Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from '../../environments/environment';
import { valueSetGuard } from '../values/general';
import { isValue, type Value } from '../values/r-value';
import { RFalse, RTrue } from '../../../r-bridge/lang-4.x/convert-values';
import { collectStrings } from '../values/string/string-constants';
import type { VariableResolve } from '../../../config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { Resolve } from '../../environments/resolve-helper';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

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
			if(RArgument.is(valueNode)) {
				valueNode = valueNode.value;
			}
			if(valueNode) {
				// this should be evaluated in the callee-context
				const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue, ctx) ?? openedResourceOf(variableResolve, graph, valueNode.info.id, ctx) ?? [Unknown];
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
		if(RArgument.is(valueNode)) {
			valueNode = valueNode.value;
		}

		if(valueNode) {
			const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, vertex.environment, graph.idMap, resolveValue, ctx) ?? openedResourceOf(variableResolve, graph, valueNode.info.id, ctx) ?? [Unknown];
			return new Map([[arg, new Set(values)]]);
		}
	}
	return undefined;
}

/** What the handle an argument holds was opened on: `readLines(con)` after `con <- file("a.txt")` reads `a.txt`. */
function openedResourceOf(variableResolve: VariableResolve, graph: DataflowGraph, argument: NodeId, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const seen = new Set<NodeId>([argument]);
	const pending = [argument];
	while(pending.length > 0) {
		const current = pending.pop() as NodeId;
		const vertex = graph.getVertex(current);
		if(DfgVertex.isFunctionCall(vertex)) {
			const info = callFnProps(current, { graph, environment: ctx.env.cleanEnv() });
			const resource = info?.sig?.findIndex(([, p]) => (p & ArgProp.Resource) !== 0) ?? -1;
			if(resource < 0 || !FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.Opens])) {
				continue;
			}
			const values = getArgumentStringValue(variableResolve, graph, vertex, resource, info?.sig?.[resource][0], true, ctx);
			return values === undefined ? undefined : [...values.values()].flatMap(v => [...v]).filter(isNotUndefined);
		}
		for(const [target, edge] of graph.edgesFrom(current)) {
			if(DfEdge.includesType(edge, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall) && !seen.has(target)) {
				seen.add(target);
				pending.push(target);
			}
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
			if(RSymbol.is(argument)) {
				return [argument.lexeme];
			}
			full = false;
		}
	}

	const resolved = valueSetGuard(Resolve.toValue(argument, { environment, graph, full, resolve: variableResolve, ctx }));
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
