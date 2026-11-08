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
import { type BrandedIdentifier, Identifier } from '../../environments/identifier';
import { Constant, Unknown } from '../../../queries/catalog/dependencies-query/dependency-values';
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
import { appliedArguments } from '../../graph/applied-arguments';
import type { CallContext } from './alias-tracking';

/** Which argument a value is read from: by index, all unnamed ones, or `undefined` for all. */
export type ArgumentPosition = number | 'unnamed' | undefined;
/** How the value of an argument is read: as it stands, resolved along the dataflow, or as a package name that may be given bare. */
export type ResolveMode = boolean | 'library';

/** The index of the argument of `vertex` that binds the formal `argumentName`, R's matching when the formals are known and the `argumentIndex`-th unnamed argument otherwise. */
export function boundArgumentIndex<Idx extends ArgumentPosition>(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argumentIndex: Idx, argumentName: BrandedIdentifier, ctx: ReadOnlyFlowrAnalyzerContext, formals?: readonly BrandedIdentifier[]): Idx | number {
	/* an exact name binds its formal whatever else the call does, so this needs no formals */
	const exact = vertex.args.findIndex(arg => arg !== EmptyArgument && arg.name === argumentName);
	if(exact >= 0) {
		return exact;
	}
	const call = formals === undefined ? graph.idMap?.get(vertex.id) : undefined;
	formals ??= RFunctionCall.is(call) ? MatchArgs.formalsOf(call, graph, ctx) : undefined;
	if(formals?.includes(argumentName)) {
		const bound = MatchArgs.toSpec(vertex.args, Object.fromEntries(formals.map(f => [f, f]))).get(argumentName)?.[0];
		return bound === undefined ? vertex.args.length : vertex.args.findIndex(a => a !== EmptyArgument && a.nodeId === bound);
	}
	if(typeof argumentIndex === 'number') {
		/* a named argument takes no position, so the parameter binds the matching unnamed one */
		const unnamed = vertex.args.flatMap((a, i) => a === EmptyArgument || !a.name ? [i] : []);
		return unnamed[argumentIndex] ?? vertex.args.length;
	}
	return argumentIndex;
}

/** The resource each argument reads from, see {@link openedResourceOf}, which does not depend on the call context. */
export type OpenedResources = Map<NodeId, BrandedIdentifier[] | undefined>;

/** Get the values of all arguments matching the criteria, keyed by the id of the argument. */
export function getArgumentStringValue(
	variableResolve: VariableResolve,
	graph: DataflowGraph,
	vertex: DataflowGraphVertexFunctionCall,
	argumentIndex: ArgumentPosition,
	argumentName: BrandedIdentifier | undefined,
	resolveValue: ResolveMode | undefined,
	ctx: ReadOnlyFlowrAnalyzerContext,
	formals?: readonly BrandedIdentifier[],
	callContext?: CallContext,
	opened?: OpenedResources
): Map<NodeId, Set<string | undefined>> | undefined {
	return argumentStringValues(variableResolve, graph, vertex, argumentIndex, argumentName, resolveValue, ctx, formals, callContext, new Set(), opened);
}

/** {@link getArgumentStringValue}, where `opening` are the calls whose resource is being resolved already, see {@link openedResourceOf} */
function argumentStringValues(
	variableResolve: VariableResolve,
	graph: DataflowGraph,
	vertex: DataflowGraphVertexFunctionCall,
	argumentIndex: ArgumentPosition,
	argumentName: BrandedIdentifier | undefined,
	resolveValue: ResolveMode | undefined,
	ctx: ReadOnlyFlowrAnalyzerContext,
	formals: readonly BrandedIdentifier[] | undefined,
	callContext: CallContext | undefined,
	opening: ReadonlySet<NodeId>,
	opened?: OpenedResources
): Map<NodeId, Set<string | undefined>> | undefined {
	vertex = appliedArguments(graph, vertex);
	if(argumentName && argumentIndex !== 'unnamed') {
		argumentIndex = boundArgumentIndex(graph, vertex, argumentIndex, argumentName, ctx, formals);
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
			const values = argumentValues(variableResolve, graph, vertex, ref, resolveAs, ctx, formals, callContext, opening, opened);
			if(ref !== undefined && values !== undefined) {
				map.set(ref, values);
			}
		}
		return map;
	}
	const ref = argumentIndex < vertex.args.length ? FunctionArgument.getReference(vertex.args[argumentIndex]) : undefined;
	const values = argumentValues(variableResolve, graph, vertex, ref, resolveValue, ctx, formals, callContext, opening, opened);
	return ref === undefined || values === undefined ? undefined : new Map([[ref, values]]);
}

/** The values of the argument `ref` passes to `vertex`, falling back to the resource a call it reads from opens, and to {@link Unknown}. */
function argumentValues(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, ref: NodeId | undefined, resolveValue: ResolveMode | undefined, ctx: ReadOnlyFlowrAnalyzerContext, formals: readonly BrandedIdentifier[] | undefined, callContext: CallContext | undefined, opening: ReadonlySet<NodeId>, opened: OpenedResources | undefined): Set<string | undefined> | undefined {
	const valueNode = ref === undefined ? undefined : RArgument.valueOf(graph.idMap?.get(ref));
	if(valueNode === undefined) {
		return undefined;
	}
	const values = resolveBasedOnConfig(variableResolve, graph, vertex, valueNode, resolveValue, ctx, formals, callContext)
		?? openedResourceOf(variableResolve, graph, valueNode.info.id, ctx, opening, opened)
		?? [Unknown];
	return new Set(values);
}

/** The resource a call that `argument` reads from opens, like the file of `gzfile(f)` in `read.csv(gzfile(f))`, or the console stream it names, like `stderr` for `stderr()`. */
function openedResourceOf(variableResolve: VariableResolve, graph: DataflowGraph, argument: NodeId, ctx: ReadOnlyFlowrAnalyzerContext, opening: ReadonlySet<NodeId>, opened: OpenedResources | undefined): BrandedIdentifier[] | undefined {
	if(opened?.has(argument)) {
		return opened.get(argument);
	}
	const resource = resourceOpenedBy(variableResolve, graph, argument, ctx, opening);
	opened?.set(argument, resource);
	return resource;
}

function resourceOpenedBy(variableResolve: VariableResolve, graph: DataflowGraph, argument: NodeId, ctx: ReadOnlyFlowrAnalyzerContext, opening: ReadonlySet<NodeId>): BrandedIdentifier[] | undefined {
	for(const id of Dataflow.provenance(argument, graph, undefined, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns)) {
		if(opening.has(id)) {
			continue;
		}
		const vertex = graph.getVertex(id);
		const info = DfgVertex.isFunctionCall(vertex) ? callFnProps(id, { graph, environment: ctx.env.cleanEnv() }) : undefined;
		if(info !== undefined && FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.Console])) {
			/* a console stream, named as the dependencies name it */
			return [Identifier.getName(info.name)];
		}
		const resource = info?.sig?.findIndex(([, p]) => (p & ArgProp.Resource) !== 0) ?? -1;
		if(vertex === undefined || !FunctionSemantics.call.props.hasAll(info, [SemanticCallTag.Opens]) || (resource < 0 && info?.sig === undefined)) {
			continue;
		} else if(resource < 0) {
			/* a handle on data in memory (`textConnection(x)`) names no resource at all */
			return [Constant];
		}
		const values = argumentStringValues(variableResolve, graph, vertex as DataflowGraphVertexFunctionCall, resource, info?.sig?.[resource][0], true, ctx, undefined, undefined, new Set([...opening, id]));
		return values === undefined ? undefined : [...values.values()].flatMap(v => [...v]).filter(isNotUndefined);
	}
	return undefined;
}

function hasCharacterOnly(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, ctx: ReadOnlyFlowrAnalyzerContext, formals: readonly BrandedIdentifier[] | undefined): boolean | 'maybe' {
	if(vertex.args.length === 0 || !graph.idMap) {
		return false;
	}
	const treatAsChar = getArgumentStringValue(variableResolve, graph, vertex, 5, 'character.only', true, ctx, formals);
	if(!treatAsChar) {
		return false;
	}
	const hasTrue = treatAsChar.values().some(set => set?.has('TRUE'));
	const hasFalse = hasTrue && treatAsChar.values().some(set => set === undefined || set.has('FALSE'));
	return hasTrue && hasFalse ? 'maybe' : hasTrue;
}

function resolveBasedOnConfig(variableResolve: VariableResolve, graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, argument: RNodeWithParent, resolveValue: ResolveMode | undefined, ctx: ReadOnlyFlowrAnalyzerContext, formals: readonly BrandedIdentifier[] | undefined, callContext: CallContext | undefined): string[] | undefined {
	let full = !!resolveValue;
	if(resolveValue === 'library' && hasCharacterOnly(variableResolve, graph, vertex, ctx, formals) === false) {
		if(RSymbol.is(argument)) {
			return [argument.lexeme];
		}
		full = false;
	}
	// this should be evaluated in the callee-context
	const resolved = valueSetGuard(Resolve.toValue(argument, { environment: vertex.environment, graph, full, resolve: variableResolve, ctx, callContext }));
	const strings = resolved?.elements.map(value => isValue(value) ? stringsOfValue(value, full) : undefined);
	return strings?.every(isNotUndefined) ? strings.flat() : undefined;
}

/** The strings a resolved value stands for. */
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
