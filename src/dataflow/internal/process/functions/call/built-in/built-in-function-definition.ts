import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { ControlFlow } from '../../../../control-flow';
import { type DataflowInformation, ExitPointType, overwriteExitPoints } from '../../../../../info';
import { bindAccessedField, getAllLinkedFunctionDefinitions, linkCircularRedefinitionsWithinALoop, linkInputs, linkInstanceReads, produceNameSharedIdMap } from '../../../../linker';
import { deferredEnvOps } from './built-in-deferred-env-ops';
import { processKnownFunctionCall } from '../known-call-handling';
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
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../../../../graph/vertex';
import { s3DispatchClassesOf } from '../../../../../fn/dispatch';
import { instanceBindingsOfMethod } from '../../../../../fn/class-declaration';
import { DispatchNarrower, linkedFunctionIds, type NarrowedDispatch, unlinkExcludedMethods } from '../../../../dispatch-linking';
import { createFreshEnvState } from './built-in-new-env';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import { EnvType, REnvironment } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import type { ReadOnlyFlowrAnalyzerContext, FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachExportVertex } from './built-in-library';
import { isComputedLookup, linkComputedLookup } from './built-in-get';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { compactHookStates, getHookInformation, KnownHooks } from '../../../../../hooks';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Resolve } from '../../../../../environments/resolve-helper';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { queryFnProps } from '../../../../../environments/query-fn-props';
import { CallProp, CallProps } from '../../../../../environments/built-in-props';
import { arraysGroupBy, uniqueArray } from '../../../../../../util/collections/arrays';
import { groupGenericOf, s3GroupGenericOf, s4GroupGenericsOf } from '../../../../../environments/group-generics';
import { DotsParameterName } from '../../../../../../util/arg-matching';
import { DefaultMap, memoize } from '../../../../../../util/collections/defaultmap';
import { Dataflow } from '../../../../../graph/df-helper';

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
	const bodyArg = RArgument.unnamedValueOf(args.at(-1));
	guard(bodyArg !== undefined, () => `Function Definition ${JSON.stringify(args)} has no body! This is bad!`);

	const originalEnvironment = data.environment;
	const idMap = data.completeAst.idMap;
	// within a function def we do not pass on the outer binds as they could be overwritten when called
	data = prepareFunctionEnvironment(ControlFlow.outsidePromises(data), rootId);

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
		(data as { environment: REnvironmentInformation }).environment = REnvironment.overwrite(data.environment, processed.environment);
	}
	const paramsEnvironments = data.environment;

	const body = processDataflowFor(bodyArg, data);
	for(const [, v] of body.graph.verticesOfType(VertexType.FunctionCall)) {
		const envir = DfgVertex.hasOrigin(v, BuiltInProcName.Rm) ? v.args.find(a => FunctionArgument.hasName(a, 'envir')) : undefined;
		const offset = envir && parseSysFrameOffset(idMap.get(envir.valueId ?? envir.nodeId));
		if(offset === undefined || offset > 0) {
			continue;
		}
		const targetLevel = offset === 0 ? 0 : originalEnvironment.level + 1 + offset;
		let targetEnv = originalEnvironment;
		while(targetEnv.level > targetLevel && targetEnv.level > 0) {
			targetEnv = REnvironment.popLocal(targetEnv);
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
		const forcedAt = Dataflow.sourcesOf(subgraph, parameter.name.info.id, EdgeType.Reads);
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
	let outEnvironment = REnvironment.overwrite(paramsEnvironments, body.environment);

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
			hookEnvironment = REnvironment.popLocal(hookEnvironment);
		}
		outEnvironment = REnvironment.overwrite(outEnvironment, hookEnvironment);
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
		readParams[paramId] = Dataflow.sourcesOf(subgraph, paramId, EdgeType.Reads).length > 0;
	}

	const returnEnvState = data.ctx.config.solver.trackEnvironments
		? afterHookExitPoints.values().map(({ nodeId }) => envStateReturnedAt(nodeId, subgraph, outEnvironment, data)).find(isNotUndefined)
		: undefined;

	const envOps = deferredEnvOps(flow.graph, subgraph, data);
	const graph = new DataflowGraph(idMap).mergeWith(subgraph, false, true);
	graph.addVertex({
		tag:         VertexType.FunctionDefinition,
		id:          name.info.id,
		environment: REnvironment.popLocal(outEnvironment),
		cds:         data.cds,
		params:      readParams,
		subflow:     flow,
		exitPoints:  afterHookExitPoints,
		returnEnvState,
		...envOps === undefined ? {} : { envOps }
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
		baseEnvironment = REnvironment.pushLocal(baseEnvironment);
	}
	while(baseEnvironment.level > callerEnvironment.level) {
		callerEnvironment = REnvironment.pushLocal(callerEnvironment);
	}
	return REnvironment.overwrite(baseEnvironment, callerEnvironment);
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
			&& (DfgVertex.hasOrigin(info, BuiltInProcName.S3Dispatch) || DfgVertex.hasOrigin(info, BuiltInProcName.S7Dispatch));
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
 * The names a method sees its instance by (`self`) stay open, as only a call on an instance binds them, whatever the enclosing frames hold.
 */
function resolveIngoingRefs(
	refs: readonly IdentifierReference[],
	environment: REnvironmentInformation,
	onResolved: (ingoing: IdentifierReference, resolved: readonly IdentifierReference[]) => boolean,
	method?: { readonly fn: NodeId, readonly graph: DataflowGraph }
): IdentifierReference[] {
	let instance: readonly string[] | undefined | null = null;
	return refs.filter(ingoing => {
		instance ??= method?.graph.idMap === undefined ? undefined : instanceBindingsOfMethod(method.fn, method.graph, method.graph.idMap);
		if(instance !== undefined && ingoing.name !== undefined && instance.includes(Identifier.getName(ingoing.name))) {
			return true;
		}
		const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, environment, ingoing.type) : undefined;
		return resolved === undefined || onResolved(ingoing, resolved);
	});
}

/**
 * Links the free variables of the functions defined in `graph` to their definitions in `outEnvironment`, the scope
 * the functions were defined in. Call it before that scope is popped, at the end of a function body or of `local`.
 * Reads that `outEnvironment` does not define are added to `openReads`.
 */
export function updateNestedFunctionClosures(graph: DataflowGraph, outEnvironment: REnvironmentInformation, openReads: IdentifierReference[]) {
	const open = new Set(openReads.map(r => r.nodeId));
	const settled = new Set<NodeId>();
	/* reads the scope binds before their closure exists, so they never reach past the scope */
	const bound = new Set<NodeId>();
	const superWrites = new DefaultMap<Identifier, NodeId[]>(() => []);
	for(const [, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		for(const [target, name] of superAssignedTargets(graph, subflow.graph)) {
			superWrites.get(name).push(target);
		}
	}
	// track *all* function definitions, including those nested within, resolving their 'in' via the lowest scope (popped after this definition)
	for(const [fn, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
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
			} else if(!AmbientStateName.is(ingoing.name) && resolved.some(ref => boundBeforeClosure(ref.nodeId, ingoing.nodeId, graph))) {
				bound.add(ingoing.nodeId);
			}
			/* the state of the session (options, files, the working directory) is what it is where the function is called, so it stays open for its calls */
			return allBuiltIn || allClosureWrites || AmbientStateName.is(ingoing.name);
		}, { fn, graph });
		for(const ref of subflow.in) {
			if(ref.name !== undefined && !settled.has(ref.nodeId) && !bound.has(ref.nodeId) && !open.has(ref.nodeId)) {
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
	if(bound.size > 0) {
		const kept = openReads.filter(r => !bound.has(r.nodeId));
		openReads.length = 0;
		openReads.push(...kept);
	}
}

/**
 * Whether an enclosing scope binds the name of a call within a closure before the closure exists, see
 * {@link boundBeforeClosure}: then the call reaches only what its reads do, and never looks further out,
 * whatever the end of the script binds there.
 */
export function callBoundInScope(call: NodeId, graph: DataflowGraph): boolean {
	return !graph.isRoot(call) && Dataflow.targetsOf(graph, call, EdgeType.Reads).some(r => boundBeforeClosure(r, call, graph));
}

function boundCallTargets(call: NodeId, graph: DataflowGraph): NodeId[] | undefined {
	return callBoundInScope(call, graph) ? [...getAllLinkedFunctionDefinitions(new Set(Dataflow.targetsOf(graph, call, EdgeType.Reads)), graph)[0]].map(d => d.id) : undefined;
}

/**
 * Whether the local definition `def` is made before the closure holding the read `read` is created, on every way
 * there: `h <- function() 2; g <- function() h()` binds `h` in the scope before `g` exists, so no call of `g`
 * looks past the scope for it. The definition has to be a statement of its own in a block that holds the closure
 * in a later statement.
 */
function boundBeforeClosure(def: NodeId, read: NodeId, graph: DataflowGraph): boolean {
	const idMap = graph.idMap;
	const node = idMap?.get(def);
	const assignment = node?.info.parent === undefined ? undefined : idMap?.get(node.info.parent);
	const block = assignment?.info.parent === undefined ? undefined : idMap?.get(assignment.info.parent);
	if(idMap === undefined || assignment === undefined || !RExpressionList.is(block)
		|| !DfgVertex.hasOrigin(graph.getVertex(assignment.info.id), BuiltInProcName.Assignment)) {
		return false;
	}
	const statement = [idMap.get(read), ...RNode.iterateParents(idMap.get(read), idMap)].find(p => p?.info.parent === block.info.id);
	return statement !== undefined && statement.info.index > assignment.info.index
		&& RNode.findEnclosing(read, idMap, RFunctionDefinition.is) !== RNode.findEnclosing(statement.info.id, idMap, RFunctionDefinition.is);
}

function* superAssignedTargets(graph: DataflowGraph, nodes: Iterable<NodeId>): Generator<[NodeId, Identifier]> {
	for(const nodeId of nodes) {
		if(!DfgVertex.hasOrigin(graph.getVertex(nodeId), BuiltInProcName.SuperAssignment)) {
			continue;
		}
		for(const target of Dataflow.targetsOf(graph, nodeId, EdgeType.Returns)) {
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
	for(const env of REnvironment.frames(environment.current)) {
		/* an attached package may shadow a built-in a function body bound to before it was attached; its keys
		 * suffice, building the definitions of every export would be costly */
		if(env.t === EnvType.Namespace) {
			for(const identifier of env.memory.keys()) {
				shadowing.add(Identifier.getName(identifier));
			}
			continue;
		}
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

/** What the signature database says about a name, asked once per name for a pass instead of once per call. */
type DatabaseInfoOf = (name: Identifier) => ReturnType<FlowrAnalyzerContext['functionInfo']>;

function fnPropsOf(name: Identifier, environment: REnvironmentInformation, infoOf: DatabaseInfoOf) {
	return queryFnProps(name, { environment }) ?? infoOf(name);
}

/** Whether `name` resolves to a built-in that dispatches, so the methods the code writes for it are reachable. */
function dispatchesOnClass(name: Identifier, environment: REnvironmentInformation, infoOf: DatabaseInfoOf): boolean {
	/* a generic only the signature database knows (`toString`) dispatches as well */
	const props = fnPropsOf(name, environment, infoOf);
	return props === undefined ? Resolve.byNameAndType(name, environment, ReferenceType.Function) === undefined : CallProps.hasAny(props, CallProp.Generic);
}

/**
 * Links `call` to the S3 methods the analyzed code binds as `<name>.<class>`, returning their definition vertices and the
 * class vectors of the dispatched object. Unless {@link dispatchedS3Methods} knows the class, every such method counts,
 * same as the {@link BuiltInProcName.S3Dispatch} path.
 */
function linkOwnS3Methods(call: DataflowGraphVertexFunctionCall, name: Identifier, graph: DataflowGraph, environment: REnvironmentInformation, statement: RNode<ParentInformation> | undefined, ctx: FlowrAnalyzerContext, infoOf: DatabaseInfoOf): { readonly methods: readonly NodeId[], readonly classes?: readonly (readonly string[])[] } {
	const defs = s3MethodPrefixesOf(name).flatMap(prefix => Resolve.byNameAndType(prefix, environment, ReferenceType.S3MethodPrefix) ?? [])
		.filter(d => !NodeId.isBuiltIn(d.nodeId) && !ProgramOrder.definedLater(d.nodeId, statement, graph));
	if(defs.length === 0) {
		return { methods: [] };
	}
	const dispatched = dispatchedS3Methods(call, name, defs, graph, environment, statement, ctx, infoOf);
	for(const def of dispatched?.methods ?? defs) {
		/* the dispatch looks the method up by name, just like a call written out would */
		graph.addEdge(call.id, def.nodeId, EdgeType.Reads);
	}
	return { methods: linkedFunctionIds(new Set((dispatched?.methods ?? defs).map(d => d.nodeId)), graph), classes: dispatched?.classes };
}

/** The names whose `<name>.<class>` methods a call of `name` may dispatch to: its own and that of the S3 group generic it is a member of. */
function s3MethodPrefixesOf(name: Identifier): readonly string[] {
	const plain = Identifier.getName(name);
	const group = s3GroupGenericOf(plain);
	return group === undefined ? [plain] : [plain, group];
}

/** The arguments the S3 dispatch of a call of a built-in generic looks at the class of, `undefined` if they are not clear. */
function dispatchedArgumentsOf(call: DataflowGraphVertexFunctionCall, node: RNode<ParentInformation> | undefined, name: Identifier, graph: DataflowGraph, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, infoOf: DatabaseInfoOf): NodeId[] | undefined {
	const args = call.args.filter(a => a !== EmptyArgument);
	if(groupGenericOf(Identifier.getName(name)) !== undefined && call.args.length > 1) {
		/* a group generic of two operands dispatches on the class of either */
		return call.args.length === 2 && args.length === 2 ? args.map(a => a.nodeId) : undefined;
	}
	const first = args[0];
	if(!RFunctionCall.is(node)) {
		return undefined;
	}
	const formals = FunctionSemantics.call.match.formalsOf(node, graph, ctx);
	const bound = formals === undefined || formals[0] === DotsParameterName ? undefined : FunctionSemantics.call.match.toSpec(call.args, Object.fromEntries(formals.map(f => [f, f]))).get(formals[0]);
	if(call.args.length > 1 && bound?.length !== 1) {
		return undefined;
	}
	/* a closure dispatches on what binds its first formal, a primitive (or anything else) may on the first argument given */
	const props = fnPropsOf(name, environment, infoOf);
	const closure = bound !== undefined && props !== undefined && !CallProps.hasAny(props, CallProp.Primitive);
	return uniqueArray(closure ? bound : [first.nodeId, ...bound ?? []]);
}

/**
 * The `methods` a call dispatches to per known class of its dispatch object (then `default`), stopping for a top-level call at one surely bound before it
 * unless a method may `NextMethod()`, with the class vectors of the object; `undefined` if the class is unknown.
 */
function dispatchedS3Methods(call: DataflowGraphVertexFunctionCall, name: Identifier, methods: readonly IdentifierDefinition[], graph: DataflowGraph, environment: REnvironmentInformation, statement: RNode<ParentInformation> | undefined, ctx: FlowrAnalyzerContext, infoOf: DatabaseInfoOf): { readonly methods: IdentifierDefinition[], readonly classes: readonly (readonly string[])[] } | undefined {
	const node = graph.idMap?.get(call.id);
	const first = call.args[0];
	if(graph.idMap === undefined || first === EmptyArgument || first === undefined) {
		return undefined;
	}
	const dispatched = dispatchedArgumentsOf(call, node, name, graph, environment, ctx, infoOf);
	const perArgument = dispatched?.map(a => s3DispatchClassesOf(a, { graph, idMap: graph.idMap as AstIdMap, ctx })) ?? [undefined];
	if(!perArgument.every(isNotUndefined)) {
		return undefined;
	}
	const classes = perArgument.flat();
	const prefixes = s3MethodPrefixesOf(name);
	const pick = (stopAt: RNode<ParentInformation> | undefined) => {
		const picked = new Set<IdentifierDefinition>();
		for(const cls of classes) {
			for(const c of [...cls, 'default']) {
				const found = methods.filter(m => m.name === undefined || prefixes.some(p => Identifier.getName(m.name as Identifier) === `${p}.${c}`));
				found.forEach(m => picked.add(m));
				if(stopAt !== undefined && found.some(m => m.name !== undefined && m.cds === undefined && ProgramOrder.offset(m.nodeId, stopAt, graph) < 0)) {
					break;
				}
			}
		}
		return picked;
	};
	const picked = pick(statement);
	const callsNext = linkedFunctionIds(new Set([...picked].map(d => d.nodeId)), graph).some(d => {
		const v = graph.getVertex(d);
		return DfgVertex.isFunctionDefinition(v) && Dataflow.callsIn(v, graph).some(([, c]) => DfgVertex.hasOrigin(c, BuiltInProcName.S3DispatchNext));
	});
	/* a next method continues along the class vector past where the dispatch stops */
	return { methods: [...callsNext ? pick(undefined) : picked], classes };
}

/** The definitions `ingoing` resolves to, without those binding only methods the dispatch reading them rules out. */
function withoutExcludedMethods(ingoing: IdentifierReference, resolved: readonly IdentifierReference[], graph: DataflowGraph): readonly IdentifierReference[] {
	const excludes = (graph.getVertex(ingoing.nodeId) as Partial<DataflowGraphVertexFunctionCall> | undefined)?.ruledOut;
	if(excludes === undefined) {
		return resolved;
	}
	return resolved.filter(d => {
		const methods = linkedFunctionIds(new Set([d.nodeId]), graph);
		return methods.length === 0 || methods.some(m => !excludes.includes(m));
	});
}

/** The object an S3 dispatch of a generic's body reads: the first argument it is handed, `undefined` if it names another. */
function dispatchedObjectOf(vertex: DataflowGraphVertexFunctionCall, graph: DataflowGraph): NodeId | undefined {
	const first = vertex.args[0];
	return first !== undefined && first !== EmptyArgument && Dataflow.hasEdge(graph, vertex.id, first.nodeId, EdgeType.Reads) ? first.nodeId : undefined;
}

/** What the dispatch of `vertex` among `targets` rules out, S3 on `s3Object` (its id or its class vectors) and S4 on the classes of its arguments. */
function narrowedDispatchOf(narrower: DispatchNarrower, vertex: DataflowGraphVertexFunctionCall, s3Object: NodeId | readonly (readonly string[])[] | undefined, targets: ReadonlySet<NodeId>, definedLater: (definition: NodeId) => boolean): NarrowedDispatch | undefined {
	const name = Identifier.getName(vertex.name);
	const s3 = s3Object === undefined ? undefined : narrower.s3(s3Object, s3MethodPrefixesOf(vertex.name), targets);
	const s4 = narrower.reachesS4Method(targets) ? narrower.s4(vertex, name, targets, definedLater) : undefined;
	if(s3 === undefined || s4 === undefined) {
		return s3 ?? s4;
	}
	return { excluded: new Set([...s3.excluded, ...s4.excluded]), next: new Map([...s3.next, ...s4.next]) };
}

/**
 * Links each next-method call to what it may run: the methods `next` names for the method it is in, and the methods
 * those run in turn, or else every target of the dispatching call.
 */
function linkNextMethods(graph: DataflowGraph, collected: ReadonlyMap<NodeId, NodeId>, targets: ReadonlySet<NodeId>, next: ReadonlyMap<NodeId, readonly NodeId[]> | undefined): void {
	const todo = [...collected];
	const visited = new Set(collected.values());
	for(let item = todo.pop(); item !== undefined; item = todo.pop()) {
		const [call, owner] = item;
		const runs = next?.get(owner);
		if(runs === undefined) {
			for(const target of targets) {
				const targetVertex = graph.getVertex(target);
				if(DfgVertex.isUse(targetVertex)) {
					graph.addEdge(call, target, EdgeType.Reads);
				} else if(DfgVertex.isFunctionDefinition(targetVertex)) {
					graph.addEdge(call, target, EdgeType.Calls);
				}
			}
			continue;
		}
		for(const method of runs) {
			const vertex = graph.getVertex(method);
			if(!DfgVertex.isFunctionDefinition(vertex)) {
				continue;
			}
			graph.addEdge(call, method, EdgeType.Calls);
			if(!visited.has(method)) {
				visited.add(method);
				for(const [inner, v] of Dataflow.callsIn(vertex, graph)) {
					if(DfgVertex.hasOrigin(v, BuiltInProcName.S3DispatchNext)) {
						todo.push([inner, method]);
					}
				}
			}
		}
	}
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
	/* the calls that wait for the parameters they call through to be bound, and whether a call was linked since they began to */
	let waiting: typeof calls = [];
	let linked = false;
	const lifted: [NodeId, IdentifierReference, NodeId][] = [];
	const enclosingOf = memoize((id: NodeId) => graph.idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(id, graph.idMap));
	const runsOnceAt = memoize((id: NodeId) => ProgramOrder.runsOnceAt(id, graph));
	const databaseInfoOf = memoize((name: Identifier) => ctx.functionInfo(name));
	const environmentAt = memoize((id: NodeId) => {
		const environment = (graph.getVertex(id) as DataflowGraphVertexFunctionCall).environment;
		return environment ? REnvironment.overwrite(outEnvironment, environment) : outEnvironment;
	});
	const narrower = new DispatchNarrower(graph, ctx);
	/* the dispatches, decided once the calls they may reach are linked */
	const deferred = new Set<NodeId>();
	let dispatching: typeof calls = [];
	for(let i = 0; ; i++) {
		if(i === calls.length) {
			/* a call linked since binds parameters, which may be what a waiting call calls, so they try again until nothing changes */
			if(linked && waiting.length > 0) {
				calls.push(...waiting);
				waiting = [];
			} else if(dispatching.length > 0) {
				calls.push(...dispatching);
				dispatching = [];
			} else {
				break;
			}
			linked = false;
		}
		const [id, vertex] = calls[i];
		const { onlyBuiltin, name, args, origin } = vertex;
		if(name === undefined) {
			continue;
		}
		if(isComputedLookup(vertex, graph)) {
			/* the parameters the name reads are bound only once the calls handing them down are linked */
			if(linkComputedLookup(graph, vertex, environmentAt(id), ctx, runsOnceAt(id))) {
				linked = true;
			} else {
				waiting.push(calls[i]);
			}
			continue;
		}
		/* the code writes a `<name>.<class>`, so a built-in `name` that dispatches may reach it */
		const mayDispatch = s3MethodPrefixesOf(name).some(p => generics.has(p));
		/* a `setMethod("Arith", ...)` claims every member of the S4 group, so a built-in member may reach its methods */
		const s4Groups = s4GroupGenericsOf(Identifier.getName(name)).filter(g => shadowing.has(g));
		if(onlyBuiltin && !mayDispatch && s4Groups.length === 0 && !(!graph.isRoot(id) && shadowing.has(Identifier.getName(name)))) {
			continue;
		}

		const effectiveEnvironment = environmentAt(id);
		/* a call the program runs once, at the top and outside any loop, cannot see what is defined after it */
		const definedLater = (definition: NodeId) => ProgramOrder.definedLater(definition, runsOnceAt(id), graph);

		/* the dispatch is decided anew, from every method the name may reach */
		delete (vertex as { ruledOut?: readonly NodeId[] }).ruledOut;
		const targets = new Set(boundCallTargets(id, graph) ?? Dataflow.callTargetsOf(id, graph, effectiveEnvironment));
		/* a dispatch depends on the classes of its arguments, so it waits for the value flow to be linked */
		const dispatches = origin.includes(BuiltInProcName.S3Dispatch) || narrower.reachesS4Method(targets) || mayDispatch && dispatchesOnClass(name, effectiveEnvironment, databaseInfoOf);
		if(dispatches && !deferred.has(id)) {
			deferred.add(id);
			dispatching.push(calls[i]);
			continue;
		}
		/* a call of a parameter sees what it is bound to only once the calls handing it down are linked */
		if(targets.size > 0 && targets.values().every(t => !NodeId.isBuiltIn(t) && DfgVertex.isVariableDefinition(graph.getVertex(t)))) {
			waiting.push(calls[i]);
			continue;
		}
		/* per next-method call, the method it is in */
		const collectedNextMethods = new Map<NodeId, NodeId>();
		let treatAsS3 = origin.includes(BuiltInProcName.S3Dispatch);
		if(treatAsS3 && !graph.isRoot(id)) {
			/* a body dispatches where it is called, which may see a method the end of the script has replaced */
			rootDefinitions ??= Dataflow.definitionsByName(graph);
			const prefix = Identifier.getName(name) + '.';
			for(const [defined, ids] of rootDefinitions.entries()) {
				if(defined.startsWith(prefix)) {
					getAllLinkedFunctionDefinitions(new Set(ids.filter(d => graph.isRoot(d))), graph)[0].forEach(t => targets.add(t.id));
				}
			}
		}
		for(const group of s4Groups) {
			const methods = Resolve.byNameAndType(group, effectiveEnvironment, ReferenceType.Function)?.filter(d => !NodeId.isBuiltIn(d.nodeId) && !definedLater(d.nodeId)) ?? [];
			for(const method of methods) {
				graph.addEdge(id, method.nodeId, EdgeType.Reads);
			}
			linkedFunctionIds(new Set(methods.map(m => m.nodeId)), graph).forEach(t => targets.add(t));
		}
		let s3Object: NodeId | readonly (readonly string[])[] | undefined = treatAsS3 ? dispatchedObjectOf(vertex, graph) : undefined;
		if(mayDispatch && !treatAsS3 && dispatchesOnClass(name, effectiveEnvironment, databaseInfoOf)) {
			const own = linkOwnS3Methods(vertex, name, graph, effectiveEnvironment, runsOnceAt(id), ctx, databaseInfoOf);
			own.methods.forEach(m => targets.add(m));
			s3Object = own.classes;
			treatAsS3 = true;
		}
		const narrowed = narrowedDispatchOf(narrower, vertex, s3Object, targets, definedLater);
		narrowed?.excluded.forEach(e => targets.delete(e));
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
			linked = true;
			for(const exitPoint of targetVertex.exitPoints) {
				graph.addEdge(id, exitPoint.nodeId, EdgeType.Returns);
			}
			if(treatAsS3 || targetVertex.mode?.includes('s4')) {
				targetVertex.mode ??= [];
				if(treatAsS3 && !targetVertex.mode.includes('s3')) {
					targetVertex.mode.push('s3');
				}
				for(const [next, v] of Dataflow.callsIn(targetVertex, graph)) {
					if(DfgVertex.hasOrigin(v, BuiltInProcName.S3DispatchNext)) {
						collectedNextMethods.set(next, target);
					}
				}
			}
			const global = enclosingOf(target) === undefined;
			if(graph.idMap !== undefined) {
				linkInstanceReads(graph, vertex, targetVertex, effectiveEnvironment, graph.idMap);
			}
			targetVertex.subflow.in = resolveIngoingRefs(targetVertex.subflow.in, effectiveEnvironment, (ingoing, found) => {
				const resolved = withoutExcludedMethods(ingoing, found, graph);
				/* the state of the session (options, files, the working directory) is what it is at this very call, and what it was before the calls of the enclosing function */
				if(AmbientStateName.is(ingoing.name)) {
					for(const { nodeId } of (vertex.environment && Resolve.byNameAndType(ingoing.name, vertex.environment, ingoing.type)) ?? []) {
						if(!NodeId.isBuiltIn(nodeId)) {
							graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
							graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
						}
					}
					if(enclosing !== undefined) {
						lifted.push([enclosing, ingoing, target]);
					}
					return false;
				}
				if(enclosing !== undefined && resolved.some(d => !NodeId.isBuiltIn(d.nodeId)) && (global || resolved.every(d => NodeId.isBuiltIn(d.nodeId) || graph.isRoot(d.nodeId)))) {
					lifted.push([enclosing, ingoing, target]);
					return false;
				}
				/* only writes from within functions (`<<-`) are left, and the call may run before them, seeing what they replace */
				if(resolved.every(d => !graph.isRoot(d.nodeId)) && ingoing.name !== undefined) {
					rootDefinitions ??= Dataflow.definitionsByName(graph);
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
			}, { fn: target, graph });
			const linkedParameters = graph.idMap?.get(target);
			if(RFunctionDefinition.is(linkedParameters)) {
				FunctionSemantics.call.match.onCallAndLink(args, linkedParameters.parameters, graph);
			}
		}
		if(narrowed !== undefined && narrowed.excluded.size > 0) {
			unlinkExcludedMethods(graph, vertex, narrowed.excluded);
			vertex.ruledOut = [...narrowed.excluded];
		}
		linkNextMethods(graph, collectedNextMethods, targets, narrowed?.next);
	}
	linkLiftedReads(graph, lifted, enclosingOf, environmentAt, runsOnceAt);
	const called = new Set(graph.verticesOfType(VertexType.FunctionCall).flatMap(([id]) => Dataflow.targetsOf(graph, id, EdgeType.Calls)));
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
		}, { fn: id, graph });
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
	/* the top-level calls that run a definition, through the calls of the functions that enclose its calls */
	const topLevelCallsOf = memoize((start: NodeId) => {
		const calls = new Set<NodeId>();
		const definitions = new Set<NodeId>([start]);
		for(const definition of definitions) {
			for(const call of Dataflow.sourcesOf(graph, definition, EdgeType.Calls)) {
				if(!DfgVertex.isFunctionCall(graph.getVertex(call))) {
					continue;
				}
				const outer = graph.isRoot(call) ? undefined : enclosingOf(call);
				if(outer === undefined) {
					calls.add(call);
				} else {
					definitions.add(outer);
				}
			}
		}
		return calls;
	});
	/* a call reads several states under its own id (`#wd`, `#file:f`), so a read is told apart by its name as well */
	const seen = new DefaultMap<NodeId, Set<string>>(() => new Set());
	while(lifted.length > 0) {
		const [definition, read, holder] = lifted.pop() as [NodeId, IdentifierReference, NodeId];
		const known = seen.get(definition);
		const key = `${String(read.nodeId)}|${read.name === undefined ? '' : Identifier.toString(read.name)}`;
		if(known.has(key) || read.name === undefined) {
			continue;
		}
		known.add(key);
		for(const call of topLevelCallsOf(definition)) {
			const found = Resolve.byNameAndType(read.name, environmentAt(call), read.type);
			const resolved = found && withoutExcludedMethods(read, found, graph);
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
	if(!RFunctionCall.isNamed(node, 'sys.frame') || node.arguments.length !== 1) {
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
	let env = REnvironment.cleanOf(data.environment);
	/* the global frame is emptied as well, but keeps its old bindings for {@link Environment#lookupLexically} */
	env.current.standsInFor(REnvironment.findGlobal(data.environment.current).memory);
	for(let i = 0; i < level + 1; i++) {
		env = REnvironment.pushLocal(env);
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
 * Links a parameter default read (e.g. `function(a=b)`) to the body writes of the same name it could see as a promise:
 * the default is evaluated where the parameter is first forced, after any of them. Which ones it surely sees is
 * settled once the reads of the parameter are known, see {@link linkPromisesToWritesOfCall}.
 */
function linkParameterReadToBodyWrites(graph: DataflowGraph, read: IdentifierReference, writesByName: ReadonlyMap<Identifier, IdentifierReference[]>): boolean {
	const writes = read.name === undefined ? undefined : writesByName.get(read.name);
	if(writes === undefined) {
		return false;
	}
	for(const { nodeId } of writes) {
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
