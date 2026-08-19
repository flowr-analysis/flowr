import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import {
	type DataflowInformation,
	ExitPointType,
	overwriteExitPoints
} from '../../../../../info';
import {
	getAllFunctionCallTargets,
	linkArgumentsOnCall,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackNonameArg } from '../argument/unpack-argument';
import { guard } from '../../../../../../util/assert';
import { dataflowLogger } from '../../../../../logger';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
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
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import type { REnvironmentInformation } from '../../../../../environments/environment';
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
	for(const param of parameters) {
		guard(param !== EmptyArgument, () => `Empty param arg in function definition ${Identifier.toString(name.content)}, ${JSON.stringify(args)}`);
		const processed = processDataflowFor(param, data);
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
	// As we know, parameters cannot technically duplicate (i.e., their names are unique), we overwrite their environments.
	// This is the correct behavior, even if someone uses non-`=` arguments in functions.
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

	// functions can be called multiple times,
	// so if they have a global effect, we have to link them as if they would be executed a loop
	/* theoretically, we should just check if there is a global effect-write somewhere within */
	if(remainingRead.length > 0) {
		const nameIdShares = produceNameSharedIdMap(remainingRead);
		const definedInLocalEnvironment = new Set<NodeId>();
		for(const defs of bodyEnvironment.current.memory.values()) {
			for(const d of defs) {
				definedInLocalEnvironment.add(d.nodeId);
			}
		}

		// Everything that is in body.out but not within the local environment populated for the function scope is a potential escape ~> global definition
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
	const flow: DataflowFunctionFlowInformation = {
		unknownReferences: [],
		in:                remainingRead,
		out:               [],
		entryPoint:        body.entryPoint,
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
	}));
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
		graph,
		environment:       originalEnvironment,
		hooks:             []
	};
}

/**
 * Retrieve the active environment when entering a function definition or call
 * @param callerEnvironment - environment at the call site / function definition site
 * @param baseEnvironment   - base environment within the function definition / call
 * @param ctx               - analyzer context
 * @returns active environment within the function definition / call
 */
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

function updateDispatches(graph: DataflowGraph, myArgs: FunctionArgument[]): void {
	for(const [, info] of graph.vertices(false)) {
		if(!FunctionCallVertex.is(info) || (!info.origin.includes(BuiltInProcName.S3Dispatch) && !info.origin.includes(BuiltInProcName.S7Dispatch))) {
			continue;
		}
		if(info.args.length === 0) {
			info.args = myArgs;
			for(const arg of myArgs) {
				// add argument edges
				if(arg !== EmptyArgument) {
					graph.addEdge(info.id, arg.nodeId, EdgeType.Argument);
				}
			}
		}
	}
}

/**
 * Update the closure links of all nested function definitions
 * @param graph          - dataflow graph to collect the function definitions from and to update the closure links for
 * @param outEnvironment - active environment on resolving closures (i.e., exit of the function definition)
 * @param fnId           - id of the function definition to update the closure links for
 */
function updateNestedFunctionClosures(
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation,
	fnId: NodeId
) {
	// track *all* function definitions - including those nested within the current graph,
	// try to resolve their 'in' by only using the lowest scope which will be popped after this definition
	for(const [id, { subflow }] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const ingoingRefs = subflow.in;
		const remainingIn: IdentifierReference[] = [];
		for(const ingoing of ingoingRefs) {
			const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, outEnvironment, ingoing.type) : undefined;
			if(resolved === undefined) {
				remainingIn.push(ingoing);
				continue;
			}
			const inId = ingoing.nodeId;
			expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${id} in closure of function definition ${fnId}`);
			let allBuiltIn = true;
			for(const ref of resolved) {
				graph.addEdge(inId, ref.nodeId, EdgeType.Reads);
				if(!isReferenceType(ref.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) {
					allBuiltIn = false;
				}
			}
			if(allBuiltIn) {
				remainingIn.push(ingoing);
			}
		}
		expensiveTrace(dataflowLogger, () => `Keeping ${remainingIn.length} references to open ref ${id} in closure of function definition ${fnId}`);
		subflow.in = remainingIn;

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


/**
 * Update the closure links of all nested function calls, this is probably to be done once at the end of the script
 * @param graph          - dataflow graph to collect the function calls from and to update the closure links for
 * @param outEnvironment - active environment on resolving closures (i.e., exit of the function definition)
 * @lintIgnore vertex-has-origin
 */
export function updateNestedFunctionCalls(
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation,
	ctx: FlowrAnalyzerContext
) {
	// track *all* function definitions - including those nested within the current graph,
	// try to resolve their 'in' by only using the lowest scope which will be popped after this definition
	for(const [id, { onlyBuiltin, environment, name, args, origin }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(onlyBuiltin || name === undefined) {
			continue;
		}

		const effectiveEnvironment = environment ? overwriteEnvironment(outEnvironment, environment) : outEnvironment;

		const targets = new Set(getAllFunctionCallTargets(id, graph, effectiveEnvironment));
		const collectedNextMethods: Set<NodeId> = new Set();
		const treatAsS3 = origin.includes(BuiltInProcName.S3Dispatch);
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
			const ingoingRefs = targetVertex.subflow.in;
			const remainingIn: IdentifierReference[] = [];
			for(const ingoing of ingoingRefs) {
				const resolved = ingoing.name ? Resolve.byNameAndType(ingoing.name, effectiveEnvironment, ingoing.type) : undefined;
				if(resolved === undefined) {
					remainingIn.push(ingoing);
					continue;
				}
				const inId = ingoing.nodeId;
				expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${id} in closure of function definition ${id}`);
				for(const { nodeId } of resolved) {
					if(!NodeId.isBuiltIn(nodeId)) {
						graph.addEdge(inId, nodeId, EdgeType.DefinedByOnCall);
						graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					}
				}
			}
			expensiveTrace(dataflowLogger, () => `Keeping ${remainingIn.length} references to open ref ${id} in closure of function definition ${id}`);
			targetVertex.subflow.in = remainingIn;
			const linkedParameters = graph.idMap?.get(target);
			if(RFunctionDefinition.is(linkedParameters)) {
				linkArgumentsOnCall(args, linkedParameters.parameters, graph);
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
	let env = data.ctx.env.makeCleanEnv();
	for(let i = 0; i < data.environment.level + 1 /* add another env */; i++) {
		env = pushLocalEnvironment(env);
		if(i === data.environment.level) {
			env.current.setClosureNodeId(rootId);
		}
	}
	return { ...data, environment: env };
}

/**
 * Within something like `f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }`
 * `a` will be defined by `b` and `b` will be a promise object bound by the first definition of b it can find.
 * This means that this function returns `2` due to the first `b <- 1` definition.
 * If the code is `f <- function(a=b, m=3) { if(m > 3) { b <- 1; }; a; b <- 5; a + 1 }`, we need a link to `b <- 1` and `b <- 6`
 * as `b` can be defined by either one of them.
 * <p>
 * <b>Currently we may be unable to narrow down every definition within the body as we have not implemented ways to track what covers the first definitions precisely</b>
 */
/** Links a parameter default read to the body writes of the same name (may), returning whether any was linked. */
/** Groups body writes by name, each list sorted by descending id (so the lowest id is last), for `linkParameterReadToBodyWrites`. */
function groupBodyWrites(out: readonly IdentifierReference[]): Map<Identifier, IdentifierReference[]> {
	const byName = new Map<Identifier, IdentifierReference[]>();
	for(const o of out) {
		if(o.name === undefined) {
			continue;
		}
		const writes = byName.get(o.name);
		if(writes === undefined) {
			byName.set(o.name, [o]);
		} else {
			writes.push(o);
		}
	}
	for(const writes of byName.values()) {
		writes.sort((a, b) => String(b.nodeId).localeCompare(String(a.nodeId)));
	}
	return byName;
}

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
