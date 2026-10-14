import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { ControlFlow } from '../../../../control-flow';
import { type DataflowInformation, ExitPointType, overwriteExitPoints } from '../../../../../info';
import { bindAccessedField, getAllFunctionCallTargets, getAllLinkedFunctionDefinitions, linkCircularRedefinitionsWithinALoop, linkInputs, produceNameSharedIdMap } from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackNonameArg } from '../argument/unpack-argument';
import { guard, isNotUndefined } from '../../../../../../util/assert';
import { dataflowLogger } from '../../../../../logger';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { resolveListToEnvState } from './built-in-list';
import { resolveClassMethodsToEnvState } from './built-in-class-generator';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { ProgramOrder } from '../../../../program-order';
import { type DataflowFunctionFlowInformation, DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import { hasEnvState, Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition, type IdentifierReference, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../../../../graph/vertex';
import { s3DispatchClassesOf } from '../../../../../fn/class-declaration';
import { createFreshEnvState } from './built-in-new-env';
import { cleanEnvOf, popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import type { Environment, IEnvironment, REnvironmentInformation } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import type { ReadOnlyFlowrAnalyzerContext, FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachExportVertex } from './built-in-library';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { compactHookStates, getHookInformation, KnownHooks } from '../../../../../hooks';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Resolve } from '../../../../../environments/resolve-helper';
import { AmbientStateName } from './built-in-ambient-state';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { queryFnProps } from '../../../../../environments/query-fn-props';
import { CallProp, CallProps } from '../../../../../environments/built-in-props';
import { arraysGroupBy } from '../../../../../../util/collections/arrays';
import { groupGenericOf } from '../../../../../environments/group-generics';
import { DotsParameterName } from '../../../../../../util/arg-matching';
import { DefaultMap, memoize } from '../../../../../../util/collections/defaultmap';
import { callsIn, definitionsByName, edgeSources, edgeTargets } from '../../../../../fn/frame-reflection';

/**
 * Process a function definition, i.e., `function(a, b) { ... }`
 */
export function processFunctionDefinition<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length < 1) {
		dataflowLogger.warn(`Function Definition ${Identifier.toString(name.content)} does not have an argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* we remove the last argument, as it is the body */
	const parameters = args.slice(0, -1);
	const bodyArg = unpackNonameArg(args.at(-1));
	guard(bodyArg !== undefined, () => `Function Definition ${JSON.stringify(args)} has no body! This is bad!`);

	const originalEnvironment = data.environment;
	const idMap = data.completeAst.idMap;
	// within a function def we do not pass on the outer binds as they could be overwritten when called
	data = prepareFunctionEnvironment(data, rootId);

	const subgraph = new DataflowGraph(idMap);

	let readInParameters: IdentifierReference[] = [];
	const allParameterReads: IdentifierReference[] = [];
	const paramIds: NodeId[] = [];
	const processedParameters: DataflowInformation[] = [];
	for(const param of parameters) {
		guard(param !== EmptyArgument, () => `Empty param arg in function definition ${Identifier.toString(name.content)}, ${JSON.stringify(args)}`);
		const processed = processDataflowFor(param, data);
		processedParameters.push(processed);
		if(RParameter.is(param.value)) {
			paramIds.push(param.value.name.info.id);
		}
		subgraph.mergeWith(processed.graph, true, true);
		const read = processed.in.concat(processed.unknownReferences);
		allParameterReads.push(...read);
		linkInputs(read, data.environment, readInParameters, subgraph, false);
		(data as { environment: REnvironmentInformation }).environment = overwriteEnvironment(data.environment, processed.environment);
	}
	const paramsEnvironments = data.environment;

	const body = processDataflowFor(bodyArg, data);
	for(const [, v] of body.graph.verticesOfType(VertexType.FunctionCall)) {
		const envir = v.origin.includes(BuiltInProcName.Rm) ? v.args.find(a => FunctionArgument.hasName(a, 'envir')) : undefined;
		const offset = envir && parseSysFrameOffset(idMap.get(envir.valueId ?? envir.nodeId));
		if(offset === undefined || offset > 0) {
			continue;
		}
		const targetLevel = offset === 0 ? 0 : originalEnvironment.level + 1 + offset;
		let targetEnv = originalEnvironment;
		while(targetEnv.level > targetLevel && targetEnv.level > 0) {
			targetEnv = popLocalEnvironment(targetEnv);
		}
		if(targetEnv.level !== targetLevel) {
			continue;
		}
		for(const removed of namesRemovedBy(v, idMap)) {
			targetEnv.current.remove(removed);
		}
	}

	// a default read (e.g. `function(x, y = x)`) may also see a later body reassignment, as the default is a promise
	const writesByName = groupBodyWrites(body.out);
	const unresolvedParamReads = new Set(readInParameters);
	for(const read of allParameterReads) {
		if(!unresolvedParamReads.has(read)) {
			linkParameterReadToBodyWrites(subgraph, read, writesByName);
		}
	}
	readInParameters = findPromiseLinkagesForParameters(subgraph, readInParameters, paramsEnvironments, writesByName);

	const readInBody = body.in.concat(body.unknownReferences);

	// there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
	const remainingRead = linkInputs(readInBody, paramsEnvironments, readInParameters.slice(), body.graph, true /* functions do not have to be called */);

	// functions can be called multiple times, so a global effect must link as if executed in a loop
	if(remainingRead.length > 0) {
		const nameIdShares = produceNameSharedIdMap(remainingRead);
		const definedInLocalEnvironment = new Set(body.environment.current.memory.values().flatMap(defs => defs.map(d => d.nodeId)));

		// everything in body.out but not within the local environment populated for the function scope is a potential escape (global definition)
		const globalBodyOut = body.out.filter(d => !definedInLocalEnvironment.has(d.nodeId));

		linkCircularRedefinitionsWithinALoop(body.graph, nameIdShares, globalBodyOut);
	}

	subgraph.mergeWith(body.graph, true, true);

	for(const param of parameters) {
		const parameter = param !== EmptyArgument && RParameter.is(param.value) ? param.value : undefined;
		if(parameter?.defaultValue === undefined) {
			continue;
		}
		const forcedAt = edgeSources(subgraph, parameter.name.info.id, EdgeType.Reads);
		RNode.visitAst<OtherInfo & ParentInformation>(parameter.defaultValue, inner => {
			if(RSymbol.is(inner) && DfgVertex.isUse(subgraph.getVertex(inner.info.id))
				&& linkParameterReadToBodyWrites(subgraph, { nodeId: inner.info.id, name: inner.content, cds: undefined, type: ReferenceType.Variable }, writesByName)) {
				for(const reader of forcedAt) {
					subgraph.addEdge(inner.info.id, reader, EdgeType.Reads);
				}
			}
			return false;
		});
	}

	// parameter names are unique, so overwriting their environments here is correct even with non-`=` arguments
	let outEnvironment = overwriteEnvironment(paramsEnvironments, body.environment);

	for(const read of remainingRead) {
		if(read.name) {
			subgraph.addVertex({
				tag:         VertexType.Use,
				id:          read.nodeId,
				environment: undefined,
				cds:         undefined
			}, data.ctx.env.cleanEnv);
		}
	}

	const compactedHooks = compactHookStates(body.hooks);
	/* a jump in a default leaves the function from where the parameter is first used */
	const exitPoints = body.exitPoints.concat(processedParameters.flatMap(p => p.exitPoints.filter(e => e.type !== ExitPointType.Default)));
	let afterHookExitPoints = exitPoints.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Default || e.type === ExitPointType.Error);
	for(const hook of getHookInformation(compactedHooks, KnownHooks.OnFnExit)) {
		const vert = subgraph.getVertex(hook.id);
		if(!DfgVertex.isFunctionDefinition(vert)) {
			continue;
		}
		/* an on.exit hook's `<<-` escapes like a body `<<-` */
		for(const read of vert.subflow.in) {
			for(const { nodeId } of Resolve.byName(read.name as string, outEnvironment) ?? []) {
				if(subgraph.hasVertex(nodeId)) {
					subgraph.addEdge(read.nodeId, nodeId, EdgeType.Reads);
				}
			}
			if(AmbientStateName.is(read.name)) {
				remainingRead.push(read);
			}
		}
		let hookEnvironment = vert.subflow.environment;
		while(hookEnvironment.level > outEnvironment.level) {
			hookEnvironment = popLocalEnvironment(hookEnvironment);
		}
		outEnvironment = overwriteEnvironment(outEnvironment, hookEnvironment);
		/* the jumps and errors of an exit hook overrule the exit points of the body */
		subgraph.addEdge(rootId, hook.id, EdgeType.Calls);
		const hookExitPoints = vert.exitPoints.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Error);
		if(hookExitPoints.length > 0) {
			afterHookExitPoints = overwriteExitPoints(afterHookExitPoints, hookExitPoints);
		}
	}
	const flowEntry = ControlFlow.inSequence(subgraph, processedParameters, ControlFlow.entryOf(body)) ?? ControlFlow.entryOf(body);

	const flow: DataflowFunctionFlowInformation = {
		unknownReferences: [],
		in:                remainingRead,
		out:               [],
		entryPoint:        body.entryPoint,
		cfgEntry:          flowEntry === body.entryPoint ? undefined : flowEntry,
		graph:             new Set(subgraph.rootIds()),
		environment:       outEnvironment,
		hooks:             compactedHooks
	};

	updateDispatches(subgraph, parameters.map<FunctionArgument>(p => {
		if(RArgument.isEmpty(p)) {
			return EmptyArgument;
		} else if(!p.name && RParameter.is(p.value)) {
			return { type: ReferenceType.Argument, cds: data.cds, nodeId: p.value.name.info.id, name: p.value.name.content, valueId: p.value.defaultValue?.info.id };
		} else if(p.name) {
			return { type: ReferenceType.Argument, valueId: p.value?.info.id, cds: data.cds, nodeId: p.name.info.id, name: p.name.content };
		} else {
			return EmptyArgument;
		}
	}), idMap);
	updateNestedFunctionClosures(subgraph, outEnvironment, remainingRead);

	const readParams: Record<NodeId, boolean> = {};
	for(const paramId of paramIds) {
		readParams[paramId] = edgeSources(subgraph, paramId, EdgeType.Reads).length > 0;
	}

	const returnEnvState = data.ctx.config.solver.trackEnvironments
		? afterHookExitPoints.values().map(({ nodeId }) => envStateReturnedAt(nodeId, subgraph, outEnvironment, data)).find(isNotUndefined)
		: undefined;

	const graph = new DataflowGraph(idMap).mergeWith(subgraph, false, true);
	graph.addVertex({
		tag:         VertexType.FunctionDefinition,
		id:          name.info.id,
		environment: popLocalEnvironment(outEnvironment),
		cds:         data.cds,
		params:      readParams,
		subflow:     flow,
		exitPoints:  afterHookExitPoints,
		returnEnvState
	}, data.ctx.env.cleanEnv);

	return {
		unknownReferences: [],
		in:                [],
		out:               [],
		exitPoints:        [],
		entryPoint:        name.info.id,
		/* evaluating a function definition produces the closure, it does not run the body */
		cfgExit:           name.info.id,
		graph,
		environment:       originalEnvironment,
		hooks:             []
	};
}

/** The tracked environment state returned at `nodeId`: a fresh `new.env()`, a list or class generator of methods, or a variable holding one. */
function envStateReturnedAt<OtherInfo>(
	nodeId: NodeId,
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): REnvironmentInformation | undefined {
	const vertex = graph.getVertex(nodeId);
	if(DfgVertex.hasOrigin(vertex, BuiltInProcName.NewEnv)) {
		return createFreshEnvState(data, { graph, entryPoint: nodeId });
	}
	const node = graph.idMap?.get(nodeId);
	if(node === undefined) {
		return undefined;
	}
	const environment = { environment: outEnvironment };
	const fromList = DfgVertex.hasOrigin(vertex, BuiltInProcName.List) ? resolveListToEnvState(node, environment) : undefined;
	if(fromList) {
		return fromList;
	}
	const fromClass = DfgVertex.hasOrigin(vertex, BuiltInProcName.ClassGenerator) ? resolveClassMethodsToEnvState(node, environment) : undefined;
	if(fromClass) {
		return fromClass;
	}
	return RSymbol.is(node) ? Resolve.byNameAndType(node.content, outEnvironment, ReferenceType.Variable)?.find(hasEnvState)?.envState : undefined;
}

/** Retrieve the active environment when entering a function definition or call. */
export function retrieveActiveEnvironment(callerEnvironment: REnvironmentInformation | undefined, baseEnvironment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext): REnvironmentInformation {
	callerEnvironment ??= ctx.env.makeCleanEnv();
	while(baseEnvironment.level < callerEnvironment.level) {
		baseEnvironment = pushLocalEnvironment(baseEnvironment);
	}
	while(baseEnvironment.level > callerEnvironment.level) {
		callerEnvironment = pushLocalEnvironment(callerEnvironment);
	}
	return overwriteEnvironment(baseEnvironment, callerEnvironment);
}

/**
 * Whether the dispatch takes its object from the first formal, which is what R does unless the call names
 * the object itself (`UseMethod("f", y)`), in which case that argument carries the read already.
 */
function dispatchesOnFirstParameter<Info>(id: NodeId, idMap: AstIdMap<Info & ParentInformation>): boolean {
	const enclosing = RNode.findEnclosing(id, idMap, RFunctionCall.is);
	const call = enclosing === undefined ? undefined : idMap.get(enclosing);
	return !RFunctionCall.is(call) || call.arguments.length <= 1;
}

function updateDispatches<Info>(graph: DataflowGraph, myArgs: FunctionArgument[], idMap: AstIdMap<Info & ParentInformation>): void {
	for(const [, info] of graph.vertices(false)) {
		const isDispatch = DfgVertex.isFunctionCall(info)
			&& (info.origin.includes(BuiltInProcName.S3Dispatch) || info.origin.includes(BuiltInProcName.S7Dispatch));
		if(!isDispatch || info.args.length > 0) {
			continue;
		}
		info.args = myArgs;
		/* dispatch evaluates the object to know its class, whatever the method it picks does with it */
		let dispatchesOn = dispatchesOnFirstParameter(info.id, idMap);
		for(const arg of myArgs) {
			if(arg !== EmptyArgument) {
				graph.addEdge(info.id, arg.nodeId, dispatchesOn ? EdgeType.Argument | EdgeType.Reads : EdgeType.Argument);
				dispatchesOn = false;
			}
		}
	}
}

/**
 * Resolves `refs` (open reads of a nested definition or call) against `environment`;
 * `onResolved` handles each resolved reference and says whether it should stay in the returned "still open" list.
 */
function resolveIngoingRefs(
	refs: readonly IdentifierReference[],
	environment: REnvironmentInformation,
	onResolved: (ingoing: IdentifierReference, resolved: readonly IdentifierReference[]) => boolean
): IdentifierReference[] {
	return refs.filter(ingoing => {
		const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, environment, ingoing.type) : undefined;
		return resolved === undefined || onResolved(ingoing, resolved);
	});
}

function updateNestedFunctionClosures(graph: DataflowGraph, outEnvironment: REnvironmentInformation, openReads: IdentifierReference[]) {
	const open = new Set(openReads.map(r => r.nodeId));
	const settled = new Set<NodeId>();
	const superWrites = new DefaultMap<Identifier, NodeId[]>(() => []);
	for(const [, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		for(const [target, name] of superAssignedTargets(graph, subflow.graph)) {
			superWrites.get(name).push(target);
		}
	}
	// track *all* function definitions, including those nested within, resolving their 'in' via the lowest scope (popped after this definition)
	for(const [, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		subflow.in = resolveIngoingRefs(subflow.in, outEnvironment, (ingoing, resolved) => {
			const writes = superWrites.get(ingoing.name as Identifier);
			for(const ref of resolved) {
				graph.addEdge(ingoing.nodeId, ref.nodeId, EdgeType.Reads);
			}
			for(const write of writes) {
				if(write !== ingoing.nodeId) {
					graph.addEdge(ingoing.nodeId, write, EdgeType.Reads);
				}
			}
			const allBuiltIn = resolved.every(ref => isReferenceType(ref.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction));
			const allClosureWrites = resolved.every(ref => writes.includes(ref.nodeId));
			if(allBuiltIn && resolved.length > 0 && !allClosureWrites) {
				settled.add(ingoing.nodeId);
			}
			return allBuiltIn || allClosureWrites;
		});
		for(const ref of subflow.in) {
			if(ref.name !== undefined && !settled.has(ref.nodeId) && !open.has(ref.nodeId)) {
				open.add(ref.nodeId);
				openReads.push(ref);
			}
		}
		for(const [target, name] of superAssignedTargets(graph, subflow.graph)) {
			for(const { nodeId } of Resolve.byNameAndType(name, outEnvironment, ReferenceType.Variable) ?? []) {
				if(nodeId !== target && !NodeId.isBuiltIn(nodeId)) {
					graph.addEdge(target, nodeId, EdgeType.Reads);
				}
			}
		}
	}
}

function* superAssignedTargets(graph: DataflowGraph, nodes: Iterable<NodeId>): Generator<[NodeId, Identifier]> {
	for(const nodeId of nodes) {
		if(!DfgVertex.hasOrigin(graph.getVertex(nodeId), BuiltInProcName.SuperAssignment)) {
			continue;
		}
		for(const target of edgeTargets(graph, nodeId, EdgeType.Returns)) {
			const node = graph.idMap?.get(target);
			if(DfgVertex.isVariableDefinition(graph.getVertex(target)) && RSymbol.is(node)) {
				yield [target, node.content];
			}
		}
	}
}

/** What one walk over the environments the analyzed code populates yields, see {@link namesShadowingBuiltIns}. */
interface NamesOfInterest {
	/** the names the code binds itself, so a call within a body may land on one of them */
	readonly shadowing: ReadonlySet<string>
	/** the generic halves of every `<generic>.<class>` the code binds, so a dispatch on one may reach a method */
	readonly generics:  ReadonlySet<string>
}

/**
 * The names the analyzed code binds that a built-in also goes by, so a call that resolved to only that built-in
 * may still land on one of them: a body looks its callee up when it runs, not when it is written.
 */
function namesShadowingBuiltIns(environment: REnvironmentInformation): NamesOfInterest {
	const shadowing = new Set<string>();
	const generics = new Set<string>();
	for(let env: IEnvironment | undefined = environment.current; env !== undefined && !env.builtInEnv; env = env.parent) {
		for(const [identifier, definitions] of env.memory) {
			if(definitions.every(d => NodeId.isBuiltIn(d.nodeId))) {
				continue;
			}
			const name = Identifier.getName(identifier);
			shadowing.add(name);
			/* `as.character.zz` may be a method of `as` or of `as.character`, so every prefix is a candidate */
			for(let dot = name.indexOf('.', 1); dot > 0; dot = name.indexOf('.', dot + 1)) {
				generics.add(name.slice(0, dot));
			}
		}
	}
	return { shadowing, generics };
}

function fnPropsOf(name: Identifier, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext) {
	return queryFnProps(name, { environment }) ?? ctx.functionInfo(name);
}

/** Whether `name` resolves to a built-in that dispatches, so the methods the code writes for it are reachable. */
function dispatchesOnClass(name: Identifier, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext): boolean {
	/* a generic only the signature database knows (`toString`) dispatches as well */
	const props = fnPropsOf(name, environment, ctx);
	return props === undefined ? Resolve.byNameAndType(name, environment, ReferenceType.Function) === undefined : CallProps.hasAny(props, CallProp.Generic);
}

/**
 * Links `call` to the S3 methods the analyzed code binds as `<name>.<class>`, returning their definition vertices.
 * Unless {@link dispatchedS3Methods} knows the class, every such method counts, same as the {@link BuiltInProcName.S3Dispatch} path.
 */
function linkOwnS3Methods(call: DataflowGraphVertexFunctionCall, name: Identifier, graph: DataflowGraph, environment: REnvironmentInformation, statement: RNode<ParentInformation> | undefined, ctx: FlowrAnalyzerContext): readonly NodeId[] {
	const defs = Resolve.byNameAndType(name, environment, ReferenceType.S3MethodPrefix)
		?.filter(d => !NodeId.isBuiltIn(d.nodeId) && !ProgramOrder.definedLater(d.nodeId, statement, graph));
	if(defs === undefined || defs.length === 0) {
		return [];
	}
	const dispatched = dispatchedS3Methods(call, name, defs, graph, environment, statement, ctx) ?? defs;
	for(const def of dispatched) {
		/* the dispatch looks the method up by name, just like a call written out would */
		graph.addEdge(call.id, def.nodeId, EdgeType.Reads);
	}
	return linkedDefinitions(dispatched, graph);
}

function linkedDefinitions(defs: readonly IdentifierDefinition[], graph: DataflowGraph): NodeId[] {
	return getAllLinkedFunctionDefinitions(new Set(defs.map(d => d.nodeId)), graph)[0].values().map(d => d.id).toArray();
}

/**
 * The `methods` a call dispatches to per known class of its dispatch object (then `default`), stopping for a top-level call at one surely bound before it;
 * `undefined` if the class is unknown or a method may `NextMethod()`.
 */
function dispatchedS3Methods(call: DataflowGraphVertexFunctionCall, name: Identifier, methods: readonly IdentifierDefinition[], graph: DataflowGraph, environment: REnvironmentInformation, statement: RNode<ParentInformation> | undefined, ctx: FlowrAnalyzerContext): IdentifierDefinition[] | undefined {
	const generic = Identifier.getName(name);
	const node = graph.idMap?.get(call.id);
	const first = call.args[0];
	if(graph.idMap === undefined || !RFunctionCall.is(node) || first === EmptyArgument || first === undefined || (call.args.length > 1 && groupGenericOf(generic) !== undefined)) {
		return undefined;
	}
	const formals = FunctionSemantics.call.match.formalsOf(node, graph, ctx);
	const bound = formals === undefined || formals[0] === DotsParameterName ? undefined : FunctionSemantics.call.match.toSpec(call.args, Object.fromEntries(formals.map(f => [f, f]))).get(formals[0]);
	if(call.args.length > 1 && bound?.length !== 1) {
		return undefined;
	}
	/* a closure dispatches on what binds its first formal, a primitive (or anything else) may on the first argument given */
	const props = fnPropsOf(name, environment, ctx);
	const closure = bound !== undefined && props !== undefined && !CallProps.hasAny(props, CallProp.Primitive);
	const classes = new Set(closure ? bound : [first.nodeId, ...bound ?? []]).values().map(a => s3DispatchClassesOf(a, { graph, idMap: graph.idMap as AstIdMap, ctx })).toArray();
	if(!classes.every(isNotUndefined)) {
		return undefined;
	}
	const picked = new Set<IdentifierDefinition>();
	for(const cls of classes.flat()) {
		for(const c of [...cls, 'default']) {
			const found = methods.filter(m => m.name === undefined || Identifier.getName(m.name) === `${generic}.${c}`);
			found.forEach(m => picked.add(m));
			if(statement !== undefined && found.some(m => m.name !== undefined && m.cds === undefined && ProgramOrder.offset(m.nodeId, statement, graph) < 0)) {
				break;
			}
		}
	}
	const callsNext = linkedDefinitions([...picked], graph).some(d => {
		const v = graph.getVertex(d);
		return DfgVertex.isFunctionDefinition(v) && callsIn(v, graph).some(([, c]) => c.origin.includes(BuiltInProcName.S3DispatchNext));
	});
	return callsNext ? undefined : [...picked];
}

/**
 * Update the closure links of all nested function calls, done once at the end of the script.
 * @lintIgnore vertex-has-origin
 */
export function updateNestedFunctionCalls(
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation,
	ctx: FlowrAnalyzerContext
) {
	const { shadowing, generics } = namesShadowingBuiltIns(outEnvironment);
	let rootDefinitions: DefaultMap<string, NodeId[]> | undefined;
	const calls = graph.verticesOfType(VertexType.FunctionCall).toArray();
	const deferred = new Set<NodeId>();
	const lifted: [NodeId, IdentifierReference, NodeId][] = [];
	const enclosingOf = memoize((id: NodeId) => graph.idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(id, graph.idMap));
	const runsOnceAt = memoize((id: NodeId) => ProgramOrder.runsOnceAt(id, graph));
	const environmentAt = memoize((id: NodeId) => {
		const environment = (graph.getVertex(id) as DataflowGraphVertexFunctionCall).environment;
		return environment ? overwriteEnvironment(outEnvironment, environment) : outEnvironment;
	});
	for(let i = 0; i < calls.length; i++) {
		const [id, vertex] = calls[i];
		const { onlyBuiltin, name, args, origin } = vertex;
		if(name === undefined) {
			continue;
		}
		/* the code writes a `<name>.<class>`, so a built-in `name` that dispatches may reach it */
		const mayDispatch = generics.has(Identifier.getName(name));
		if(onlyBuiltin && !mayDispatch && !(!graph.isRoot(id) && shadowing.has(Identifier.getName(name)))) {
			continue;
		}

		const effectiveEnvironment = environmentAt(id);
		/* a call the program runs once, at the top and outside any loop, cannot see what is defined after it */
		const definedLater = (definition: NodeId) => ProgramOrder.definedLater(definition, runsOnceAt(id), graph);

		const targets = new Set(getAllFunctionCallTargets(id, graph, effectiveEnvironment));
		/* a call of a parameter sees what it is bound to only once the calls handing it down are linked */
		if(!deferred.has(id) && targets.size > 0 && targets.values().every(t => !NodeId.isBuiltIn(t) && DfgVertex.isVariableDefinition(graph.getVertex(t)))) {
			deferred.add(id);
			calls.push(calls[i]);
			continue;
		}
		const collectedNextMethods = new Set<NodeId>();
		let treatAsS3 = origin.includes(BuiltInProcName.S3Dispatch);
		if(treatAsS3 && !graph.isRoot(id)) {
			/* a body dispatches where it is called, which may see a method the end of the script has replaced */
			rootDefinitions ??= definitionsByName(graph);
			const prefix = Identifier.getName(name) + '.';
			for(const [defined, ids] of rootDefinitions.entries()) {
				if(defined.startsWith(prefix)) {
					getAllLinkedFunctionDefinitions(new Set(ids.filter(d => graph.isRoot(d))), graph)[0].forEach(t => targets.add(t.id));
				}
			}
		}
		if(mayDispatch && !treatAsS3 && dispatchesOnClass(name, effectiveEnvironment, ctx)) {
			for(const method of linkOwnS3Methods(vertex, name, graph, effectiveEnvironment, runsOnceAt(id), ctx)) {
				targets.add(method);
			}
			treatAsS3 = true;
		}
		const enclosing = graph.isRoot(id) ? undefined : enclosingOf(id);
		for(const target of targets) {
			if(NodeId.isBuiltIn(target)) {
				// a package export resolved lazily here (nested), so materialize it and link to its loader
				const loader = (Resolve.byNameAndType(name, effectiveEnvironment, ReferenceType.Function)?.find(r => r.nodeId === target) as InGraphIdentifierDefinition | undefined)?.definedAt;
				if(loader !== undefined && !NodeId.isBuiltIn(loader)) {
					attachExportVertex(graph, target, effectiveEnvironment, ctx);
					graph.addEdge(target, loader, EdgeType.Reads | EdgeType.Calls);
				}
				graph.addEdge(id, target, EdgeType.Calls);
				continue;
			}
			const targetVertex = graph.getVertex(target);
			if(!DfgVertex.isFunctionDefinition(targetVertex)) {
				if(DfgVertex.isUse(targetVertex)) {
					graph.addEdge(id, target, EdgeType.Reads);
				}
				continue;
			}
			graph.addEdge(id, target, EdgeType.Calls);
			/* the call reaches user code, so everything downstream has to stop treating it as built-in only */
			vertex.onlyBuiltin = false;
			for(const exitPoint of targetVertex.exitPoints) {
				graph.addEdge(id, exitPoint.nodeId, EdgeType.Returns);
			}
			if(treatAsS3) {
				targetVertex.mode ??= [];
				if(!targetVertex.mode.includes('s3')) {
					targetVertex.mode.push('s3');
				}
				// collect all next method calls to link them to the same targets!
				for(const [next, v] of callsIn(targetVertex, graph)) {
					if(v.origin.includes(BuiltInProcName.S3DispatchNext)) {
						collectedNextMethods.add(next);
					}
				}
			}
			const global = enclosingOf(target) === undefined;
			targetVertex.subflow.in = resolveIngoingRefs(targetVertex.subflow.in, effectiveEnvironment, (ingoing, resolved) => {
				if(enclosing !== undefined && resolved.some(d => !NodeId.isBuiltIn(d.nodeId)) && (global || resolved.every(d => NodeId.isBuiltIn(d.nodeId) || graph.isRoot(d.nodeId)))) {
					lifted.push([enclosing, ingoing, target]);
					return false;
				}
				/* only writes from within functions (`<<-`) are left, and the call may run before them, seeing what they replace */
				if(resolved.every(d => !graph.isRoot(d.nodeId)) && ingoing.name !== undefined) {
					rootDefinitions ??= definitionsByName(graph);
					for(const def of rootDefinitions.get(Identifier.getName(ingoing.name)).filter(d => graph.isRoot(d))) {
						graph.addEdge(ingoing.nodeId, def, EdgeType.Reads);
					}
				}
				for(const { nodeId, envState } of resolved as InGraphIdentifierDefinition[]) {
					if(!NodeId.isBuiltIn(nodeId) && !definedLater(nodeId)) {
						graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
						graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
						if(envState !== undefined && graph.idMap !== undefined) {
							bindAccessedField(graph, ingoing.nodeId, envState, graph.idMap);
						}
					}
				}
				return false;
			});
			const linkedParameters = graph.idMap?.get(target);
			if(RFunctionDefinition.is(linkedParameters)) {
				FunctionSemantics.call.match.onCallAndLink(args, linkedParameters.parameters, graph);
			}
		}
		for(const nextMethodId of collectedNextMethods) {
			for(const target of targets) {
				const targetVertex = graph.getVertex(target);
				if(DfgVertex.isUse(targetVertex)) {
					graph.addEdge(nextMethodId, target, EdgeType.Reads);
				} else if(DfgVertex.isFunctionDefinition(targetVertex)) {
					graph.addEdge(nextMethodId, target, EdgeType.Calls);
				}
			}
		}
	}
	linkLiftedReads(graph, lifted, enclosingOf, environmentAt, runsOnceAt);
	const called = new Set(graph.verticesOfType(VertexType.FunctionCall).flatMap(([id]) => edgeTargets(graph, id, EdgeType.Calls)));
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		if(called.has(id)) {
			continue;
		}
		resolveIngoingRefs(vertex.subflow.in, outEnvironment, (ingoing, resolved) => {
			for(const { nodeId } of resolved) {
				if(!NodeId.isBuiltIn(nodeId)) {
					graph.addEdge(ingoing.nodeId, nodeId, EdgeType.Reads);
				}
			}
			return true;
		});
	}
}

/** Resolves each global read of a nested call where the enclosing function is called. */
function linkLiftedReads(
	graph: DataflowGraph,
	lifted: [NodeId, IdentifierReference, NodeId][],
	enclosingOf: (id: NodeId) => NodeId | undefined,
	environmentAt: (call: NodeId) => REnvironmentInformation,
	runsOnceAt: (call: NodeId) => RNode<ParentInformation> | undefined
): void {
	const seen = new DefaultMap<NodeId, Set<NodeId>>(() => new Set());
	while(lifted.length > 0) {
		const [definition, read, holder] = lifted.pop() as [NodeId, IdentifierReference, NodeId];
		const known = seen.get(definition);
		if(known.has(read.nodeId) || read.name === undefined) {
			continue;
		}
		known.add(read.nodeId);
		for(const call of edgeSources(graph, definition, EdgeType.Calls)) {
			if(!DfgVertex.isFunctionCall(graph.getVertex(call))) {
				continue;
			}
			const outer = graph.isRoot(call) ? undefined : enclosingOf(call);
			if(outer !== undefined) {
				lifted.push([outer, read, holder]);
				continue;
			}
			const resolved = Resolve.byNameAndType(read.name, environmentAt(call), read.type);
			const target = graph.getVertex(holder);
			if(resolved === undefined && DfgVertex.isFunctionDefinition(target) && !target.subflow.in.some(r => r.nodeId === read.nodeId)) {
				target.subflow.in = [...target.subflow.in, read];
			}
			for(const { nodeId } of resolved ?? []) {
				if(!NodeId.isBuiltIn(nodeId) && !ProgramOrder.definedLater(nodeId, runsOnceAt(call), graph)) {
					graph.addEdge(read.nodeId, nodeId, EdgeType.Reads);
					graph.addEdge(call, nodeId, EdgeType.DefinesOnCall);
				}
			}
		}
	}
}

function parseSysFrameOffset(node: RNode<ParentInformation> | undefined): number | undefined {
	if(!RFunctionCall.isNamed(node) || Identifier.getName(node.functionName.content) !== 'sys.frame' || node.arguments.length !== 1) {
		return undefined;
	}
	return RNumber.literalValueOf(RArgument.valueOf(node.arguments[0]));
}

function namesRemovedBy(call: DataflowGraphVertexFunctionCall, idMap: AstIdMap<ParentInformation>): Identifier[] {
	const names: Identifier[] = [];
	for(const a of call.args) {
		if(a === EmptyArgument || FunctionArgument.hasName(a, 'envir')) {
			continue;
		}
		const node = idMap.get(FunctionArgument.getReference(a) ?? a.nodeId);
		if(RString.is(node)) {
			names.push(node.content.str);
		} else if(RSymbol.is(node)) {
			names.push(node.content);
		}
	}
	return names;
}

function prepareFunctionEnvironment<OtherInfo>(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, rootId: NodeId) {
	const level = data.environment.level;
	/* the enclosing frames are emptied, but a `<<-` binds lexically, so each stand-in keeps what its original held */
	const enclosing: Environment[] = [];
	for(let frame = data.environment.current; enclosing.length < level; frame = frame.parent) {
		enclosing.push(frame);
	}
	let env = cleanEnvOf(data.environment);
	for(let i = 0; i < level + 1; i++) {
		env = pushLocalEnvironment(env);
		if(i === level) {
			env.current.setClosureNodeId(rootId);
		} else {
			env.current.standsInFor(enclosing[level - 1 - i].memory);
		}
	}
	return { ...data, environment: env };
}

function groupBodyWrites(out: readonly IdentifierReference[]): Map<Identifier, IdentifierReference[]> {
	const named = out.filter((o): o is IdentifierReference & { name: Identifier } => o.name !== undefined);
	const byName = arraysGroupBy(named, o => o.name);
	for(const writes of byName.values()) {
		writes.sort((a, b) => NodeId.compare(a.nodeId, b.nodeId));
	}
	return byName;
}

/**
 * Links a parameter default read (e.g. `function(a=b)`) to the body write(s) of the same name it could see as a promise,
 * e.g. in `f <- function(a=b) { b <- 1; a; b <- 5 }`, `a` links to `b <- 1`; may not narrow this down precisely in every case.
 */
function linkParameterReadToBodyWrites(graph: DataflowGraph, read: IdentifierReference, writesByName: ReadonlyMap<Identifier, IdentifierReference[]>): boolean {
	const writes = read.name === undefined ? undefined : writesByName.get(read.name);
	if(writes === undefined) {
		return false;
	}
	for(const { nodeId } of writes[0].cds === undefined ? writes.slice(0, 1) : writes) {
		graph.addEdge(read.nodeId, nodeId, EdgeType.Reads);
	}
	return true;
}

/** Binds the parameter reads `readInParameters` within the parameters, else to the body writes they may see; returns those still unresolved. */
function findPromiseLinkagesForParameters(parameters: DataflowGraph, readInParameters: readonly IdentifierReference[], parameterEnvs: REnvironmentInformation, writesByName: ReadonlyMap<Identifier, IdentifierReference[]>): IdentifierReference[] {
	return readInParameters.filter(read => {
		const resolved = read.name ? Resolve.byNameAndType(read.name, parameterEnvs, read.type) : undefined;
		for(const { nodeId } of resolved ?? []) {
			parameters.addEdge(read.nodeId, nodeId, EdgeType.Reads);
		}
		return resolved === undefined && !linkParameterReadToBodyWrites(parameters, read, writesByName);
	});
}
