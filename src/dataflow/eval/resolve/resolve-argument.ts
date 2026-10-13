import { type DataflowGraph, FunctionArgument } from '../../graph/graph';
import { RValue } from '../values/r-value';
import type { DataflowGraphVertexFunctionCall } from '../../graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { MatchArgs } from '../../graph/match-args';
import { isNotUndefined } from '../../../util/assert';
import { DfgVertex } from '../../graph/vertex';
import { EdgeType } from '../../graph/edge';
import { Dataflow } from '../../graph/df-helper';
import { callFnProps } from '../../environments/query-fn-props';
import { ArgProp, SemanticCallTag } from '../../environments/built-in-props';
import { FunctionSemantics } from '../../fn/function-semantics';
import { Constant, Unknown } from '../../../queries/catalog/dependencies-query/dependencies-query-format';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { valueSetGuard } from '../values/general';
import { isValue, type Value } from '../values/r-value';
import { RFalse, RTrue } from '../../../r-bridge/lang-4.x/convert-values';
import { collectStrings } from '../values/string/string-constants';
import type { VariableResolve } from '../../../config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { Resolve } from '../../environments/resolve-helper';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

/** The index of the argument of `vertex` that binds the formal `argumentName`, R's matching when the formals are known and the `argumentIndex`-th unnamed argument otherwise. */
export function boundArgumentIndex<Idx extends number | 'unnamed' | undefined>(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argumentIndex: Idx, argumentName: string, ctx: ReadOnlyFlowrAnalyzerContext): Idx | number {
	const call = graph.idMap?.get(vertex.id);
	const formals = RFunctionCall.is(call) ? MatchArgs.formalsOf(call, graph, ctx) : undefined;
	if(formals?.includes(argumentName)) {
		const bound = MatchArgs.toSpec(vertex.args, Object.fromEntries(formals.map(f => [f, f]))).get(argumentName)?.[0];
		return bound === undefined ? vertex.args.length : vertex.args.findIndex(a => a !== EmptyArgument && a.nodeId === bound);
	}
	const arg = vertex.args.findIndex(arg => arg !== EmptyArgument && arg.name === argumentName);
	if(arg >= 0) {
		return arg;
	} else if(typeof argumentIndex === 'number') {
		/* a named argument takes no position, so the parameter binds the matching unnamed one */
		const unnamed = vertex.args.flatMap((a, i) => a === EmptyArgument || !a.name ? [i] : []);
		return unnamed[argumentIndex] ?? vertex.args.length;
	}
	return argumentIndex;
}

/**
 * Get the values of all arguments matching the criteria, keyed by the id of the argument.
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
	if(argumentName && argumentIndex !== 'unnamed') {
		argumentIndex = boundArgumentIndex(graph, vertex, argumentIndex, argumentName, ctx);
	}
	if(argumentIndex === undefined) {
		return undefined;
	}
	if(argumentIndex === 'unnamed') {
		const map = new Map<NodeId, Set<string | undefined>>();
		/* all unnamed arguments, and the one named `argumentName`, which is evaluated rather than taken as a name */
		for(const arg of vertex.args) {
			if(arg === EmptyArgument || (arg.name && arg.name !== argumentName)) {
				continue;
			}
			const ref = FunctionArgument.getReference(arg);
			const resolveAs = FunctionArgument.isNamed(arg) && resolveValue === 'library' ? true : resolveValue;
			const values = argumentValues(variableResolve, graph, vertex, ref, resolveAs, ctx);
			if(ref !== undefined && values !== undefined) {
				map.set(ref, values);
			}
		}
		return map;
	}
	const ref = argumentIndex < vertex.args.length ? FunctionArgument.getReference(vertex.args[argumentIndex]) : undefined;
	const values = argumentValues(variableResolve, graph, vertex, ref, resolveValue, ctx);
	return ref === undefined || values === undefined ? undefined : new Map([[ref, values]]);
}

/** The values of the argument `ref` passes to `vertex`, falling back to the resource a call it reads from opens, and to {@link Unknown}. */
function argumentValues(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, ref: NodeId | undefined, resolveValue: boolean | 'library' | undefined, ctx: ReadOnlyFlowrAnalyzerContext): Set<string | undefined> | undefined {
	const valueNode = ref === undefined ? undefined : RArgument.valueOf(graph.idMap?.get(ref));
	if(valueNode === undefined) {
		return undefined;
	}
	const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, resolveValue, ctx)
		?? openedResourceOf(variableResolve, graph, valueNode.info.id, ctx)
		?? [Unknown];
	return new Set(values);
}

function openedResourceOf(variableResolve: VariableResolve, graph: DataflowGraph, argument: NodeId, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	for(const id of Dataflow.provenance(argument, graph, undefined, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall)) {
		const vertex = graph.getVertex(id);
		const info = DfgVertex.isFunctionCall(vertex) ? callFnProps(id, { graph, environment: ctx.env.cleanEnv() }) : undefined;
		const resource = info?.sig?.findIndex(([, p]) => (p & ArgProp.Resource) !== 0) ?? -1;
		if(vertex === undefined || resource < 0 || !FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.Opens])) {
			continue;
		}
		const values = getArgumentStringValue(variableResolve, graph, vertex as DataflowGraphVertexFunctionCall, resource, info?.sig?.[resource][0], true, ctx);
		return values === undefined ? undefined : [...values.values()].flatMap(v => [...v]).filter(isNotUndefined);
	}
	return undefined;
}

function hasCharacterOnly(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, ctx: ReadOnlyFlowrAnalyzerContext): boolean | 'maybe' {
	if(vertex.args.length === 0 || !graph.idMap) {
		return false;
	}
	const treatAsChar = getArgumentStringValue(variableResolve, graph, vertex, 5, 'character.only', true, ctx);
	if(!treatAsChar) {
		return false;
	}
	const hasTrue = treatAsChar.values().some(set => set?.has('TRUE'));
	const hasFalse = hasTrue && treatAsChar.values().some(set => set === undefined || set.has('FALSE'));
	return hasTrue && hasFalse ? 'maybe' : hasTrue;
}

function resolveBasedOnConfig(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argument: RNodeWithParent, resolveValue: boolean | 'library' | undefined, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	let full = !!resolveValue;
	if(resolveValue === 'library' && hasCharacterOnly(variableResolve, graph, vertex, ctx) === false) {
		if(RSymbol.is(argument)) {
			return [argument.lexeme];
		}
		full = false;
	}
	// this should be evaluated in the callee-context
	const resolved = valueSetGuard(Resolve.toValue(argument, { environment: vertex.environment, graph, full, resolve: variableResolve, ctx }));
	const strings = resolved?.elements.map(value => isValue(value) ? stringsOfValue(value, full) : undefined);
	return strings?.every(isNotUndefined) ? strings.flat() : undefined;
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
