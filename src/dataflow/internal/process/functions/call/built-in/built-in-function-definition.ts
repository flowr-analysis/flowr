import { MatchArgs } from '../../../../../graph/match-args';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { ControlFlow } from '../../../../control-flow';
import {
	type DataflowInformation,
	ExitPointType,
	overwriteExitPoints
} from '../../../../../info';
import {
	getAllFunctionCallTargets,
	getAllLinkedFunctionDefinitions,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackNonameArg } from '../argument/unpack-argument';
import { guard } from '../../../../../../util/assert';
import { dataflowLogger } from '../../../../../logger';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { type DataflowFunctionFlowInformation, DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import {
	Identifier,
	type InGraphIdentifierDefinition,
	type IdentifierReference,
	isReferenceType,
	ReferenceType
} from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import { FunctionCallVertex, VertexType, FunctionDefinitionVertex, UseVertex, VariableDefinitionVertex } from '../../../../../graph/vertex';
import { createFreshEnvState } from './built-in-new-env';
import { cleanEnvOf, popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import type { Environment, IEnvironment, REnvironmentInformation } from '../../../../../environments/environment';
import { DfEdge, EdgeType } from '../../../../../graph/edge';
import { expensiveTrace } from '../../../../../../util/log';
import type { ReadOnlyFlowrAnalyzerContext, FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { attachExportVertex } from './built-in-library';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { compactHookStates, getHookInformation, KnownHooks } from '../../../../../hooks';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { queryFnProps } from '../../../../../environments/query-fn-props';
import { CallProp } from '../../../../../environments/built-in-props';
import { arraysGroupBy } from '../../../../../../util/collections/arrays';

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
	// within a function def we do not pass on the outer binds as they could be overwritten when called
	data = prepareFunctionEnvironment(data, rootId);

	const subgraph = new DataflowGraph(data.completeAst.idMap);

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
		subgraph.mergeWith(processed.graph);
		const read = processed.in.concat(processed.unknownReferences);
		allParameterReads.push(...read);
		linkInputs(read, data.environment, readInParameters, subgraph, false);
		(data as { environment: REnvironmentInformation }).environment = overwriteEnvironment(data.environment, processed.environment);
	}
	const paramsEnvironments = data.environment;

	const body = processDataflowFor(bodyArg, data);
	for(const [, v] of body.graph.verticesOfType(VertexType.FunctionCall)) {
		if(!v.origin.includes(BuiltInProcName.Rm)) {
			continue;
		}
		const ea = v.args.find(a => a !== EmptyArgument && FunctionArgument.isNamed(a) && a.name === 'envir');
		if(!ea || !FunctionArgument.isNamed(ea)) {
			continue;
		}
		const offset = parseSysFrameOffset(data.completeAst.idMap.get(ea.valueId ?? ea.nodeId));
		if(offset === undefined || offset > 0) {
			continue;
		}
		const names: Identifier[] = [];
		for(const a of v.args) {
			if(a === EmptyArgument || (FunctionArgument.isNamed(a) && a.name === 'envir')) {
				continue;
			}
			const node = data.completeAst.idMap.get(FunctionArgument.isNamed(a) ? (a.valueId ?? a.nodeId) : a.nodeId);
			if(RString.is(node)) {
				names.push(node.content.str);
			} else if(RSymbol.is(node)) {
				names.push(node.content);
			}
		}
		const targetLevel = offset === 0 ? 0 : originalEnvironment.level + 1 + offset;
		let targetEnv = originalEnvironment;
		while(targetEnv.level > targetLevel && targetEnv.level > 0) {
			targetEnv = popLocalEnvironment(targetEnv);
		}
		if(targetEnv.level === targetLevel) {
			for(const n of names) {
				targetEnv.current.remove(n);
			}
		}
	}
	// parameter names are unique, so overwriting their environments here is correct even with non-`=` arguments
	const bodyEnvironment = body.environment;

	// a default read (e.g. `function(x, y = x)`) may also see a later body reassignment, as the default is a promise
	const writesByName = groupBodyWrites(body.out);
	const unresolvedParamReads = new Set(readInParameters);
	for(const read of allParameterReads) {
		if(read.name && !unresolvedParamReads.has(read)) {
			linkParameterReadToBodyWrites(subgraph, read, writesByName);
		}
	}

	readInParameters = findPromiseLinkagesForParameters(subgraph, readInParameters, paramsEnvironments, writesByName);

	const readInBody = body.in.concat(body.unknownReferences);

	// there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
	const remainingRead = linkInputs(readInBody, paramsEnvironments, readInParameters.slice(), body.graph, true /* functions do not have to be called */);

	// functions can be called multiple times, so a global effect must link as if executed in a loop
	/* theoretically, we should just check if there is a global effect-write somewhere within */
	if(remainingRead.length > 0) {
		const nameIdShares = produceNameSharedIdMap(remainingRead);
		const definedInLocalEnvironment = new Set(bodyEnvironment.current.memory.values().flatMap(defs => defs.map(d => d.nodeId)));

		// everything in body.out but not within the local environment populated for the function scope is a potential escape (global definition)
		const globalBodyOut = body.out.filter(d => !definedInLocalEnvironment.has(d.nodeId));

		linkCircularRedefinitionsWithinALoop(body.graph, nameIdShares, globalBodyOut);
	}

	subgraph.mergeWith(body.graph);

	let outEnvironment = overwriteEnvironment(paramsEnvironments, bodyEnvironment);

	for(const read of remainingRead) {
		if(read.name) {
			subgraph.addVertex({
				tag:         VertexType.Use,
				id:          read.nodeId,
				environment: undefined,
				cds:         undefined
			}, data.ctx.env.makeCleanEnv());
		}
	}

	const compactedHooks = compactHookStates(body.hooks);
	const exitHooks = getHookInformation(compactedHooks, KnownHooks.OnFnExit);
	// an on.exit hook's `<<-` escapes like a body `<<-`; fold its escaping writes into this function's subflow
	for(const hook of exitHooks) {
		const vert = subgraph.getVertex(hook.id);
		if(!FunctionDefinitionVertex.is(vert)) {
			continue;
		}
		let hookEnvironment = vert.subflow.environment;
		while(hookEnvironment.level > outEnvironment.level) {
			hookEnvironment = popLocalEnvironment(hookEnvironment);
		}
		outEnvironment = overwriteEnvironment(outEnvironment, hookEnvironment);
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
		} else if(!p.name && p.value && RParameter.is(p.value)) {
			return { type: ReferenceType.Argument, cds: data.cds, nodeId: p.value.name.info.id, name: p.value.name.content, valueId: p.value.defaultValue?.info.id };
		} else if(p.name) {
			return { type: ReferenceType.Argument, valueId: p.value?.info.id, cds: data.cds, nodeId: p.name.info.id, name: p.name.content };
		} else {
			return EmptyArgument;
		}
	}), data.completeAst.idMap);
	updateNestedFunctionClosures(subgraph, outEnvironment, name.info.id);
	const exitPoints = body.exitPoints;

	const readParams: Record<NodeId, boolean> = {};
	for(const paramId of paramIds) {
		const ingoing = subgraph.ingoingEdges(paramId);
		readParams[paramId] = ingoing?.values().some(e => DfEdge.includesType(e, EdgeType.Reads)) ?? false;
	}

	let afterHookExitPoints = exitPoints?.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Default || e.type === ExitPointType.Error) ?? [];
	for(const hook of exitHooks) {
		const vert = subgraph.getVertex(hook.id);
		if(!FunctionDefinitionVertex.is(vert)) {
			continue;
		}
		// call all hooks
		subgraph.addEdge(rootId, hook.id, EdgeType.Calls);
		const hookExitPoints = vert.exitPoints.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Error);
		if(hookExitPoints.length > 0) {
			afterHookExitPoints = overwriteExitPoints(afterHookExitPoints, hookExitPoints);
		}
	}

	let returnEnvState: REnvironmentInformation | undefined;
	if(data.ctx.config.solver.trackEnvironments) {
		for(const ep of afterHookExitPoints) {
			const epVertex = subgraph.getVertex(ep.nodeId);
			if(FunctionCallVertex.hasOrigin(epVertex, BuiltInProcName.NewEnv)) {
				returnEnvState = createFreshEnvState(data, { graph: subgraph, entryPoint: ep.nodeId });
				break;
			}
			const epNode = subgraph.idMap?.get(ep.nodeId);
			if(RSymbol.is(epNode)) {
				const defs = Resolve.byNameAndType(epNode.content, outEnvironment, ReferenceType.Variable);
				const def = defs?.find((d): d is InGraphIdentifierDefinition => (d as InGraphIdentifierDefinition).envState !== undefined);
				if(def?.envState) {
					returnEnvState = def.envState;
					break;
				}
			}
		}
	}

	const graph = new DataflowGraph(data.completeAst.idMap).mergeWith(subgraph, false);
	graph.addVertex({
		tag:         VertexType.FunctionDefinition,
		id:          name.info.id,
		environment: popLocalEnvironment(outEnvironment),
		cds:         data.cds,
		params:      readParams,
		subflow:     flow,
		exitPoints:  afterHookExitPoints,
		returnEnvState
	}, data.ctx.env.makeCleanEnv());

	return {
		/* nothing escapes a function definition, but the function itself, will be forced in assignment: { nodeId: functionDefinition.info.id, scope: data.activeScope, used: 'always', name: functionDefinition.info.id as string } */
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

/** Retrieve the active environment when entering a function definition or call. */
export function retrieveActiveEnvironment(callerEnvironment: REnvironmentInformation | undefined, baseEnvironment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext): REnvironmentInformation {
	callerEnvironment ??= ctx.env.makeCleanEnv();
	let level = callerEnvironment.level ?? 0;

	if(baseEnvironment.level !== level) {
		while(baseEnvironment.level < level) {
			baseEnvironment = pushLocalEnvironment(baseEnvironment);
		}
		while(baseEnvironment.level > level) {
			callerEnvironment = pushLocalEnvironment(callerEnvironment);
			level = callerEnvironment.level;
		}
	}

	return overwriteEnvironment(baseEnvironment, callerEnvironment);
}

/**
 * Whether the dispatch takes its object from the first formal, which is what R does unless the call names
 * the object itself (`UseMethod("f", y)`), in which case that argument carries the read already.
 */
function dispatchesOnFirstParameter<Info>(id: NodeId, idMap: AstIdMap<Info & ParentInformation>): boolean {
	let node = idMap.get(id);
	while(node !== undefined && !RFunctionCall.is(node)) {
		node = node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
	}
	return node === undefined || (node.arguments?.length ?? 0) <= 1;
}

function updateDispatches<Info>(graph: DataflowGraph, myArgs: FunctionArgument[], idMap: AstIdMap<Info & ParentInformation>): void {
	for(const [, info] of graph.vertices(false)) {
		if(!FunctionCallVertex.is(info) || (!info.origin.includes(BuiltInProcName.S3Dispatch) && !info.origin.includes(BuiltInProcName.S7Dispatch))) {
			continue;
		}
		if(info.args.length === 0) {
			info.args = myArgs;
			/* dispatch evaluates the object to know its class, whatever the method it picks does with it */
			let dispatchesOn = dispatchesOnFirstParameter(info.id, idMap);
			for(const arg of myArgs) {
				// add argument edges
				if(arg !== EmptyArgument) {
					graph.addEdge(info.id, arg.nodeId, dispatchesOn ? EdgeType.Argument | EdgeType.Reads : EdgeType.Argument);
					dispatchesOn = false;
				}
			}
		}
	}
}

/**
 * Resolves `refs` (open reads of a nested definition/call `openRefId`, closing over `closureId`) against `environment`;
 * `onResolved` handles each resolved reference and says whether it should stay in the returned "still open" list.
 */
function resolveIngoingRefs(
	refs: readonly IdentifierReference[],
	environment: REnvironmentInformation,
	openRefId: NodeId,
	closureId: NodeId,
	onResolved: (ingoing: IdentifierReference, resolved: readonly IdentifierReference[]) => boolean
): IdentifierReference[] {
	const remainingIn: IdentifierReference[] = [];
	for(const ingoing of refs) {
		const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, environment, ingoing.type) : undefined;
		if(resolved === undefined) {
			remainingIn.push(ingoing);
			continue;
		}
		expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${openRefId} in closure of function definition ${closureId}`);
		if(onResolved(ingoing, resolved)) {
			remainingIn.push(ingoing);
		}
	}
	expensiveTrace(dataflowLogger, () => `Keeping ${remainingIn.length} references to open ref ${openRefId} in closure of function definition ${closureId}`);
	return remainingIn;
}

/** Update the closure links of all nested function definitions. */
function updateNestedFunctionClosures(
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation,
	fnId: NodeId
) {
	// track *all* function definitions, including those nested within, resolving their 'in' via the lowest scope (popped after this definition)
	for(const [id, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		subflow.in = resolveIngoingRefs(subflow.in, outEnvironment, id, fnId, (ingoing, resolved) => {
			let allBuiltIn = true;
			for(const ref of resolved) {
				graph.addEdge(ingoing.nodeId, ref.nodeId, EdgeType.Reads);
				if(!isReferenceType(ref.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) {
					allBuiltIn = false;
				}
			}
			return allBuiltIn;
		});

		linkSuperAssignmentsToOuterDefinitions(graph, subflow.graph, outEnvironment);
	}
}

function linkSuperAssignmentsToOuterDefinitions(
	parentGraph: DataflowGraph,
	nestedGraphNodeIds: Set<NodeId>,
	parentEnvironment: REnvironmentInformation
): void {
	for(const nodeId of nestedGraphNodeIds) {
		const vertex = parentGraph.getVertex(nodeId);
		if(!FunctionCallVertex.hasOrigin(vertex, BuiltInProcName.SuperAssignment)) {
			continue;
		}

		const outgoingReturns = parentGraph.outgoingEdges(nodeId);
		if(!outgoingReturns) {
			continue;
		}

		for(const [targetId, edge] of outgoingReturns) {
			if(!DfEdge.includesType(edge, EdgeType.Returns)) {
				continue;
			}

			const targetVertex = parentGraph.getVertex(targetId);
			if(!VariableDefinitionVertex.is(targetVertex)) {
				continue;
			}

			const targetNode = parentGraph.idMap?.get(targetId);
			if(!RSymbol.is(targetNode)) {
				continue;
			}

			const varName = targetNode.content;
			const resolved = Resolve.byNameAndType(varName, parentEnvironment, ReferenceType.Variable);
			if(resolved) {
				for(const ref of resolved) {
					if(ref.nodeId !== targetId && !NodeId.isBuiltIn(ref.nodeId)) {
						parentGraph.addEdge(targetId, ref.nodeId, EdgeType.Reads);
					}
				}
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
			if(!definitions.some(d => !NodeId.isBuiltIn(d.nodeId))) {
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

/** Whether `name` resolves to a built-in that dispatches, so the methods the code writes for it are reachable. */
function dispatchesOnClass(name: Identifier, environment: REnvironmentInformation): boolean {
	return ((queryFnProps(name, { environment })?.props ?? 0) & CallProp.Generic) !== 0;
}

/**
 * Links `call` to the S3 methods the analyzed code binds as `<name>.<class>`, returning their definition vertices.
 * flowR does not track the object's class, so every such method counts, same as the {@link BuiltInProcName.S3Dispatch} path.
 */
function linkOwnS3Methods(call: NodeId, name: Identifier, graph: DataflowGraph, environment: REnvironmentInformation): readonly NodeId[] {
	const defs = Resolve.byNameAndType(name, environment, ReferenceType.S3MethodPrefix)
		?.filter(d => !NodeId.isBuiltIn(d.nodeId));
	if(defs === undefined || defs.length === 0) {
		return [];
	}
	for(const def of defs) {
		/* the dispatch looks the method up by name, just like a call written out would */
		graph.addEdge(call, def.nodeId, EdgeType.Reads);
	}
	const [definitions] = getAllLinkedFunctionDefinitions(new Set(defs.map(d => d.nodeId)), graph);
	return definitions.values().map(d => d.id).toArray();
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
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const { onlyBuiltin, environment, name, args, origin } = vertex;
		if(name === undefined) {
			continue;
		}
		/* the code writes a `<name>.<class>`, so a built-in `name` that dispatches may reach it */
		const mayDispatch = generics.has(Identifier.getName(name));
		if(onlyBuiltin && !mayDispatch && !(!graph.isRoot(id) && shadowing.has(Identifier.getName(name)))) {
			continue;
		}

		const effectiveEnvironment = environment ? overwriteEnvironment(outEnvironment, environment) : outEnvironment;

		const targets = new Set(getAllFunctionCallTargets(id, graph, effectiveEnvironment));
		const collectedNextMethods: Set<NodeId> = new Set();
		let treatAsS3 = origin.includes(BuiltInProcName.S3Dispatch);
		if(mayDispatch && !treatAsS3 && dispatchesOnClass(name, effectiveEnvironment)) {
			for(const method of linkOwnS3Methods(id, name, graph, effectiveEnvironment)) {
				targets.add(method);
			}
			treatAsS3 = true;
		}
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
			// support reads on symbols
			if(!FunctionDefinitionVertex.is(targetVertex)) {
				if(UseVertex.is(targetVertex)) {
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
				for(const s of targetVertex.subflow.graph) {
					const v = graph.getVertex(s);
					if(FunctionCallVertex.is(v) && v.origin.includes(BuiltInProcName.S3DispatchNext)) {
						collectedNextMethods.add(v.id);
					}
				}
			}
			targetVertex.subflow.in = resolveIngoingRefs(targetVertex.subflow.in, effectiveEnvironment, id, id, (ingoing, resolved) => {
				for(const { nodeId } of resolved) {
					if(!NodeId.isBuiltIn(nodeId)) {
						graph.addEdge(ingoing.nodeId, nodeId, EdgeType.DefinedByOnCall);
						graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					}
				}
				return false;
			});
			const linkedParameters = graph.idMap?.get(target);
			if(RFunctionDefinition.is(linkedParameters)) {
				MatchArgs.onCallAndLink(args, linkedParameters.parameters, graph);
			}
		}
		for(const nextMethodId of collectedNextMethods) {
			for(const target of targets) {
				const targetVertex = graph.getVertex(target);
				if(UseVertex.is(targetVertex)) {
					graph.addEdge(nextMethodId, target, EdgeType.Reads);
				} else if(FunctionDefinitionVertex.is(targetVertex)) {
					graph.addEdge(nextMethodId, target, EdgeType.Calls);
				}
			}
		}
	}
}

function parseSysFrameOffset(node: RNode<ParentInformation> | undefined): number | undefined {
	if(!node || !RFunctionCall.is(node) || !node.named || Identifier.getName(node.functionName.content) !== 'sys.frame' || node.arguments.length !== 1) {
		return undefined;
	}
	const arg = node.arguments[0];
	if(RArgument.isEmpty(arg) || !arg.value) {
		return undefined;
	}
	return RNumber.literalValueOf(arg.value);
}

function prepareFunctionEnvironment<OtherInfo>(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, rootId: NodeId) {
	const level = data.environment.level;
	/* the enclosing frames are emptied, but a `<<-` binds lexically, so each stand-in keeps what its original held */
	const enclosing: Environment[] = [];
	for(let frame = data.environment.current; enclosing.length < level; frame = frame.parent) {
		enclosing.push(frame);
	}
	let env = cleanEnvOf(data.environment);
	for(let i = 0; i < level + 1 /* add another env */; i++) {
		env = pushLocalEnvironment(env);
		if(i === level) {
			env.current.setClosureNodeId(rootId);
		} else {
			env.current.standsInFor(enclosing[level - 1 - i].memory);
		}
	}
	return { ...data, environment: env };
}

/** Groups body writes by name, each list sorted by descending id (so the lowest id is last), for `linkParameterReadToBodyWrites`. */
function groupBodyWrites(out: readonly IdentifierReference[]): Map<Identifier, IdentifierReference[]> {
	const named = out.filter((o): o is IdentifierReference & { name: Identifier } => o.name !== undefined);
	const byName = arraysGroupBy(named, o => o.name);
	for(const writes of byName.values()) {
		writes.sort((a, b) => String(b.nodeId).localeCompare(String(a.nodeId)));
	}
	return byName;
}

/**
 * Links a parameter default read (e.g. `function(a=b)`) to the body write(s) of the same name it could see as a promise,
 * e.g. in `f <- function(a=b) { b <- 1; a; b <- 5 }`, `a` links to `b <- 1`; may not narrow this down precisely in every case.
 */
function linkParameterReadToBodyWrites(graph: DataflowGraph, read: IdentifierReference, writesByName: ReadonlyMap<Identifier, IdentifierReference[]>): boolean {
	const writingOuts = read.name === undefined ? undefined : writesByName.get(read.name);
	if(writingOuts === undefined) {
		return false;
	}
	if(writingOuts[0].cds === undefined) {
		graph.addEdge(read.nodeId, writingOuts[0].nodeId, EdgeType.Reads);
	} else {
		for(const { nodeId } of writingOuts) {
			graph.addEdge(read.nodeId, nodeId, EdgeType.Reads);
		}
	}
	return true;
}

function findPromiseLinkagesForParameters(parameters: DataflowGraph, readInParameters: readonly IdentifierReference[], parameterEnvs: REnvironmentInformation, writesByName: ReadonlyMap<Identifier, IdentifierReference[]>): IdentifierReference[] {
	// first, we try to bind again within parameters - if we have it, fine
	const remainingRead: IdentifierReference[] = [];
	for(const read of readInParameters) {
		const resolved = read.name ? Resolve.byNameAndType(read.name, parameterEnvs, read.type) : undefined;
		const rid = read.nodeId;
		if(resolved !== undefined) {
			for(const { nodeId } of resolved) {
				parameters.addEdge(rid, nodeId, EdgeType.Reads);
			}
			continue;
		}
		// If not resolved, link all outs within the body as potential reads.
		if(!linkParameterReadToBodyWrites(parameters, read, writesByName)) {
			remainingRead.push(read);
		}
	}
	return remainingRead;
}
