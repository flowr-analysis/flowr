import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import { type DataflowInformation, ExitPointType, overwriteExitPoints } from '../../../../../info';
import {
	getAllFunctionCallTargets,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackNonameArg } from '../argument/unpack-argument';
import { guard } from '../../../../../../util/assert';
import { dataflowLogger } from '../../../../../logger';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowFunctionFlowInformation, DataflowGraph } from '../../../../../graph/graph';
import { type IdentifierReference, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import { VertexType } from '../../../../../graph/vertex';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { type REnvironmentInformation } from '../../../../../environments/environment';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { edgeIncludesType, EdgeType } from '../../../../../graph/edge';
import { expensiveTrace } from '../../../../../../util/log';
import { isBuiltIn } from '../../../../../environments/built-in';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { compactHookStates, getHookInformation, KnownHooks } from '../../../../../hooks';

/**
 * Process a function definition, i.e., `function(a, b) { ... }`
 */
export function processFunctionDefinition<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length < 1) {
		dataflowLogger.warn(`Function Definition ${name.content} does not have an argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* we remove the last argument, as it is the body */
	const parameters = args.slice(0, -1);
	const bodyArg = unpackNonameArg(args[args.length - 1]);
	guard(bodyArg !== undefined, () => `Function Definition ${JSON.stringify(args)} has no body! This is bad!`);

	const originalEnvironment = data.environment;
	// within a function def we do not pass on the outer binds as they could be overwritten when called
	data = prepareFunctionEnvironment(data);

	const subgraph = new DataflowGraph(data.completeAst.idMap);

	let readInParameters: IdentifierReference[] = [];
	const paramIds: NodeId[] = [];
	for(const param of parameters) {
		guard(param !== EmptyArgument, () => `Empty param arg in function definition ${name.content}, ${JSON.stringify(args)}`);
		const processed = processDataflowFor(param, data);
		if(param.value?.type === RType.Parameter) {
			paramIds.push(param.value.name.info.id);
		}
		subgraph.mergeWith(processed.graph);
		const read = processed.in.concat(processed.unknownReferences);
		linkInputs(read, data.environment, readInParameters, subgraph, false);
		(data as { environment: REnvironmentInformation}).environment = overwriteEnvironment(data.environment, processed.environment);
	}
	const paramsEnvironments = data.environment;

	const body = processDataflowFor(bodyArg, data);
	// As we know, parameters cannot technically duplicate (i.e., their names are unique), we overwrite their environments.
	// This is the correct behavior, even if someone uses non-`=` arguments in functions.
	const bodyEnvironment = body.environment;

	readInParameters = findPromiseLinkagesForParameters(subgraph, readInParameters, paramsEnvironments, body);

	const readInBody = body.in.concat(body.unknownReferences);

	// there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
	const remainingRead = linkInputs(readInBody, paramsEnvironments, readInParameters.slice(), body.graph, true /* functions do not have to be called */);

	// functions can be called multiple times,
	// so if they have a global effect, we have to link them as if they would be executed a loop
	/* theoretically, we should just check if there is a global effect-write somewhere within */
	if(remainingRead.length > 0) {
		const nameIdShares = produceNameSharedIdMap(remainingRead);
		const definedInLocalEnvironment = new Set(Array.from(bodyEnvironment.current.memory.values()).flat().map(d => d.nodeId));

		// Everything that is in body.out but not within the local environment populated for the function scope is a potential escape ~> global definition
		const globalBodyOut = body.out.filter(d => !definedInLocalEnvironment.has(d.nodeId));

		linkCircularRedefinitionsWithinALoop(body.graph, nameIdShares, globalBodyOut);
	}

	subgraph.mergeWith(body.graph);

	const outEnvironment = overwriteEnvironment(paramsEnvironments, bodyEnvironment);

	for(const read of remainingRead) {
		if(read.name) {
			subgraph.addVertex({
				tag:                 VertexType.Use,
				id:                  read.nodeId,
				environment:         undefined,
				controlDependencies: undefined
			}, data.ctx.env.makeCleanEnv());
		}
	}

	const compactedHooks = compactHookStates(body.hooks);
	const exitHooks = getHookInformation(compactedHooks, KnownHooks.OnFnExit);


	const flow: DataflowFunctionFlowInformation = {
		unknownReferences: [],
		in:                remainingRead,
		out:               [],
		entryPoint:        body.entryPoint,
		graph:             new Set(subgraph.rootIds()),
		environment:       outEnvironment,
		hooks:             compactedHooks
	};

	updateNestedFunctionClosures(subgraph, outEnvironment, name.info.id);
	const exitPoints = body.exitPoints;

	const readParams: Record<NodeId, boolean> = {};
	for(const paramId of paramIds) {
		const ingoing = subgraph.ingoingEdges(paramId);
		readParams[paramId] = ingoing?.values().some(({ types }) => edgeIncludesType(types, EdgeType.Reads)) ?? false;
	}

	let afterHookExitPoints = exitPoints?.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Default || e.type === ExitPointType.Error) ?? [];
	for(const hook of exitHooks) {
		const vert = subgraph.getVertex(hook.id);
		if(vert?.tag !== VertexType.FunctionDefinition) {
			continue;
		}
		// call all hooks
		subgraph.addEdge(rootId, hook.id, EdgeType.Calls);
		const hookExitPoints = vert.exitPoints.filter(e => e.type === ExitPointType.Return || e.type === ExitPointType.Error);
		if(hookExitPoints.length > 0) {
			afterHookExitPoints = overwriteExitPoints(afterHookExitPoints, hookExitPoints);
		}
	}

	const graph = new DataflowGraph(data.completeAst.idMap).mergeWith(subgraph, false);
	graph.addVertex({
		tag:                 VertexType.FunctionDefinition,
		id:                  name.info.id,
		environment:         popLocalEnvironment(outEnvironment),
		controlDependencies: data.controlDependencies,
		params:              readParams,
		subflow:             flow,
		exitPoints:          afterHookExitPoints
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

/**
 * Update the closure links of all nested function definitions
 * @param graph          - dataflow graph to collect the function definitions from and to update the closure links for
 * @param outEnvironment - active environment on resolving closures (i.e., exit of the function definition)
 * @param fnId           - id of the function definition to update the closure links for
 */
export function updateNestedFunctionClosures(
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
			const resolved = ingoing.name ? resolveByName(ingoing.name, outEnvironment, ingoing.type) : undefined;
			if(resolved === undefined) {
				remainingIn.push(ingoing);
				continue;
			}
			expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${id} in closure of function definition ${fnId}`);
			let allBuiltIn = true;
			for(const ref of resolved) {
				graph.addEdge(ingoing, ref, EdgeType.Reads);
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
	}
}


/**
 * Update the closure links of all nested function calls, this is probably to be done once at the end of the script
 * @param graph          - dataflow graph to collect the function calls from and to update the closure links for
 * @param outEnvironment - active environment on resolving closures (i.e., exit of the function definition)
 */
export function updateNestedFunctionCalls(
	graph: DataflowGraph,
	outEnvironment: REnvironmentInformation
) {
	// track *all* function definitions - including those nested within the current graph,
	// try to resolve their 'in' by only using the lowest scope which will be popped after this definition
	for(const [id, { onlyBuiltin, environment, name }] of graph.verticesOfType(VertexType.FunctionCall)) {
		if(onlyBuiltin || !name) {
			continue;
		}

		let effectiveEnvironment = outEnvironment;
		// only the call environment counts!
		if(environment) {
			while(outEnvironment.level > environment.level) {
				outEnvironment = popLocalEnvironment(outEnvironment);
			}
			while(outEnvironment.level < environment.level) {
				outEnvironment = pushLocalEnvironment(outEnvironment);
			}
			effectiveEnvironment = overwriteEnvironment(outEnvironment, environment);
		}

		const targets = new Set(getAllFunctionCallTargets(id, graph, effectiveEnvironment));
		for(const target of targets) {
			if(isBuiltIn(target)) {
				graph.addEdge(id, target, EdgeType.Calls);
				continue;
			}
			const targetVertex = graph.getVertex(target);
			// support reads on symbols
			if(targetVertex?.tag === VertexType.Use) {
				graph.addEdge(id, target, EdgeType.Reads);
				continue;
			} else if(targetVertex?.tag !== VertexType.FunctionDefinition) {
				continue;
			}
			graph.addEdge(id, target, EdgeType.Calls);
			const ingoingRefs = targetVertex.subflow.in;
			const remainingIn: IdentifierReference[] = [];
			for(const ingoing of ingoingRefs) {
				const resolved = ingoing.name ? resolveByName(ingoing.name, effectiveEnvironment, ingoing.type) : undefined;
				if(resolved === undefined) {
					remainingIn.push(ingoing);
					continue;
				}
				expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${id} in closure of function definition ${id}`);
				for(const def of resolved) {
					if(!isBuiltIn(def.nodeId)) {
						graph.addEdge(ingoing, def, EdgeType.DefinedByOnCall);
						graph.addEdge(id, def, EdgeType.DefinesOnCall);
					}
				}
			}
			expensiveTrace(dataflowLogger, () => `Keeping ${remainingIn.length} references to open ref ${id} in closure of function definition ${id}`);
			targetVertex.subflow.in = remainingIn;
		}
	}
}

function prepareFunctionEnvironment<OtherInfo>(data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	let env = data.ctx.env.makeCleanEnv();
	for(let i = 0; i < data.environment.level + 1 /* add another env */; i++) {
		env = pushLocalEnvironment(env);
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
function findPromiseLinkagesForParameters(parameters: DataflowGraph, readInParameters: readonly IdentifierReference[], parameterEnvs: REnvironmentInformation, body: DataflowInformation): IdentifierReference[] {
	// first, we try to bind again within parameters - if we have it, fine
	const remainingRead: IdentifierReference[] = [];
	for(const read of readInParameters) {
		const resolved = read.name ? resolveByName(read.name, parameterEnvs, read.type) : undefined;
		if(resolved !== undefined) {
			for(const ref of resolved) {
				parameters.addEdge(read, ref, EdgeType.Reads);
			}
			continue;
		}
		// If not resolved, link all outs within the body as potential reads.
		// Regarding the sort, we can ignore equality as nodeIds are unique.
		// We sort to get the lowest id - if it is an 'always' flag, we can safely use it instead of all of them.
		const writingOuts = body.out.filter(o => o.name === read.name).sort((a, b) => String(a.nodeId) < String(b.nodeId) ? 1 : -1);
		if(writingOuts.length === 0) {
			remainingRead.push(read);
			continue;
		}
		if(writingOuts[0].controlDependencies === undefined) {
			parameters.addEdge(read, writingOuts[0], EdgeType.Reads);
			continue;
		}
		for(const out of writingOuts) {
			parameters.addEdge(read, out, EdgeType.Reads);
		}
	}
	return remainingRead;
}
