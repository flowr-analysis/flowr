import { type DataflowProcessorInformation, processDataflowFor } from '../../../../../processor';
import {
	type ControlDependency,
	type ExitPoint,
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
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowFunctionFlowInformation, DataflowGraph, type FunctionArgument } from '../../../../../graph/graph';
import { type IdentifierReference, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../../environments/overwrite';
import type { ContainerIndicesCollection, DataflowGraphVertexArgument, DataflowGraphVertexAstLink, DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { VertexType } from '../../../../../graph/vertex';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../../environments/scoping';
import { type REnvironmentInformation } from '../../../../../environments/environment';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import { edgeIncludesType, EdgeType } from '../../../../../graph/edge';
import { expensiveTrace } from '../../../../../../util/log';
import { BuiltInProcName, isBuiltIn } from '../../../../../environments/built-in';
import type { FlowrAnalyzerContext, ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { compactHookStates, getHookInformation, KnownHooks } from '../../../../../hooks';

export class DataflowGraphVertexLazyFunctionDefinition<OtherInfo = unknown> implements DataflowGraphVertexFunctionDefinition {
	readonly tag = VertexType.FunctionDefinition;
	readonly lazy = true;
	readonly id:                    NodeId;
	private readonly processorData: DataflowProcessorInformation<OtherInfo & ParentInformation>;
	private readonly astNode:       RSymbol<OtherInfo & ParentInformation>;
	private readonly args:          readonly RFunctionArgument<OtherInfo & ParentInformation>[];
	private readonly rootId:        NodeId;
	private _subflow?:              DataflowFunctionFlowInformation;
	private _exitPoints?:           readonly ExitPoint[];
	private _params?:               Record<NodeId, boolean>;
	private _environment?:          REnvironmentInformation;
	private _cds?:                  ControlDependency[];
	private _indicesCollection?:    ContainerIndicesCollection;
	private _link?:                 DataflowGraphVertexAstLink;

	private _materialized = false;
	/**
	 * Store pending closure update information to be applied when the function materializes.
	 * Maps from parent function ID to its closure update. This ensures each parent function's
	 * environment is used exactly once to resolve closures, even if multiple deference calls occur.
	 */
	private _pendingClosureUpdates: Map<NodeId, { outEnvironment: REnvironmentInformation; fnId: NodeId }> = new Map();
	/**
	 * A getter callback that returns the current unified graph.
	 * This is called explicitly when the lazy vertex needs the graph.
	 * When the graph is merged into a parent, this callback automatically returns the unified graph.
	 */
	private _getCurrentGraph:       () => DataflowGraph;
	[x: string]:                    unknown;

	constructor(
		id: NodeId,
		astNode: RSymbol<OtherInfo & ParentInformation>,
		args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
		rootId: NodeId,
		data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
		graph: DataflowGraph
	) {
		this.id = id;
		this.astNode = astNode;
		this.args = args;
		this.rootId = rootId;
		this.processorData = data;
		this._graph = graph;

		// Create a getter callback that will return the current graph.
		// When this graph is merged into a parent, the callback automatically
		// returns the unified graph instead, without explicit updates needed.
		this._getCurrentGraph = graph.createGraphCallback();
	}

	/**
	 * Materialize the lazy function definition by calling processFunctionDefinitionEagerly
	 * and copying all properties from the materialized vertex.
	 */
	public materialize(): void {
		if(this._materialized) {
			return;
		}

		const settings = this.processorData.ctx.config.optimizations.deferredFunctionEvaluation;
		const originalSetting = settings.enabled;
		if(settings.onlyTopLevel) {
			settings.enabled = false;
		}

		const info = processFunctionDefinitionEagerly(this.astNode, this.args, this.rootId, this.processorData);

		settings.enabled = originalSetting;
		/** vertex must have same id */
		const materialized = info.graph.getVertex(this.id);
		guard(
			materialized !== undefined && materialized.tag === VertexType.FunctionDefinition,
			() => `Failed to materialize lazy function definition for id=${this.id}`
		);

		// Copy all properties from the materialized vertex
		this._subflow = materialized.subflow;
		this._exitPoints = materialized.exitPoints;
		this._params = materialized.params;
		this._environment = materialized.environment;
		this._cds = materialized.cds;
		this._indicesCollection = materialized.indicesCollection;
		this._link = materialized.link;
		this._materialized = true;

		// Get the current unified graph by calling the callback.
		// The callback automatically returns the latest graph (updated by merges).
		const currentGraph = this._getCurrentGraph();

		// merge the materialized vertex graph into the current unified graph
		currentGraph.mergeWith(info.graph, false);
		currentGraph.moveVertexToEnd(this.id);

		// The materialized function has been processed by processFunctionDefinitionEagerly which calls
		// updateNestedFunctionClosures at line ~420. That already attempted to resolve closures but deferred
		// this lazy function. Now that we've materialized, we need to try closure resolution again in the
		// unified graph context with all parent environments that deferred this function.
		if(this._pendingClosureUpdates.size > 0) {
			// Apply each pending closure update from unique parent functions
			for(const { outEnvironment, fnId } of this._pendingClosureUpdates.values()) {
				updateFunctionAndNestedClosures(
					currentGraph,
					this.id,
					outEnvironment,
					fnId,
					this.processorData.ctx
				);
			}

			updateParentParameterTracking(currentGraph, this.id);

			// Update parameter tracking for all parent functions
			const parentFnIds = new Set<NodeId>(this._pendingClosureUpdates.keys());
			for(const fnId of parentFnIds) {
				updateParentParameterTracking(currentGraph, fnId);
			}
		}
	}

	public get materialized(): boolean {
		return this._materialized;
	}

	/**
	 * Materialize this lazy function only if the given node is part of its AST subtree.
	 * @param nodeId - node id to check for materialization
	 * @param idMap - AST id map to check for parent relationships
	 * @returns true if this call materialized the function definition, false otherwise.
	 */
	public materializeIfContainsNode(nodeId: NodeId, idMap: AstIdMap | undefined): boolean {
		return this.materializeIfContainsAnyNode([nodeId], idMap);
	}

	/**
	 * Materialize this lazy function if any given node is part of its AST subtree.
	 * Stops on first hit.
	 * @param nodeIds - node ids to check for materialization
	 * @param idMap - AST id map to check for parent relationships. If undefined, no materialization will occur
	 * @returns true if this call materialized the function definition, false otherwise.
	 */
	public materializeIfContainsAnyNode(nodeIds: Iterable<NodeId>, idMap: AstIdMap | undefined): boolean {
		if(this._materialized || idMap === undefined) {
			return false;
		}

		for(const nodeId of nodeIds) {
			let current = idMap.get(nodeId);
			while(current?.info?.parent !== undefined) {
				if(current.info.parent === this.id) {
					this.materialize();
					return true;
				}
				current = idMap.get(current.info.parent);
			}
		}

		return false;
	}

	get subflow(): DataflowFunctionFlowInformation {
		if(!this._materialized) {
			this.materialize();
		}
		guard(this._subflow !== undefined, `Lazy function definition ${this.id} failed to materialize subflow`);
		return this._subflow;
	}

	get exitPoints(): readonly ExitPoint[] {
		if(!this._materialized) {
			this.materialize();
		}
		guard(this._exitPoints !== undefined, `Lazy function definition ${this.id} failed to materialize exitPoints`);
		return this._exitPoints;
	}

	get params(): Record<NodeId, boolean> {
		if(!this._materialized) {
			this.materialize();
		}
		guard(this._params !== undefined, `Lazy function definition ${this.id} failed to materialize params`);
		return this._params;
	}

	get environment(): REnvironmentInformation | undefined {
		if(!this._materialized) {
			this.materialize();
		}
		return this._environment;
	}

	get cds(): ControlDependency[] | undefined {
		if(!this._materialized) {
			this.materialize();
		}
		return this._cds;
	}

	get indicesCollection(): ContainerIndicesCollection | undefined {
		if(!this._materialized) {
			this.materialize();
		}
		return this._indicesCollection;
	}

	get link(): DataflowGraphVertexAstLink | undefined {
		if(!this._materialized) {
			this.materialize();
		}
		return this._link;
	}

	get name(): string {
		return this.astNode.content;
	}

	// Setters to allow property updates during materialization and merging
	set subflow(value: DataflowFunctionFlowInformation) {
		this._subflow = value;
	}

	set exitPoints(value: readonly ExitPoint[]) {
		this._exitPoints = value;
	}

	set params(value: Record<NodeId, boolean>) {
		this._params = value;
	}

	set environment(value: REnvironmentInformation) {
		this._environment = value;
	}

	set cds(value: ControlDependency[]) {
		this._cds = value;
	}

	set indicesCollection(value: ContainerIndicesCollection) {
		this._indicesCollection = value;
	}

	set link(value: DataflowGraphVertexAstLink) {
		this._link = value;
	}
}

/**
 *
 */
export function isLazyFunctionDefinitionVertex(
	vertex: DataflowGraphVertexFunctionDefinition
): vertex is DataflowGraphVertexLazyFunctionDefinition {
	return vertex instanceof DataflowGraphVertexLazyFunctionDefinition;
}

/**
 * Materializes all lazy function definitions in the graph that contain any of the given node ids in their AST subtree.
 * @param graph - dataflow graph
 * @param nodeIds - node ids to check for materialization
 * @param idMap - AST id map to check for parent relationships
 */
export function materializeLazyFunctionDefinitionsContainingNodes(
	graph: DataflowGraph,
	nodeIds: Iterable<NodeId>,
	idMap: AstIdMap | undefined
): void {
	if(idMap === undefined) {
		return;
	}

	const targets = Array.from(nodeIds);
	if(targets.length === 0) {
		return;
	}

	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		const fnVertex = vertex as DataflowGraphVertexFunctionDefinition;
		if(!isLazyFunctionDefinitionVertex(fnVertex) || fnVertex.materialized) {
			continue;
		}
		fnVertex.materializeIfContainsAnyNode(targets, idMap);
	}
}

/**
 * Process a function definition, i.e., `function(a, b) { ... }`
 * If `deferredFunctionEvaluation` is enabled in the config, a lazy function definition vertex is created instead of eagerly analyzing the function body.
 */
export function processFunctionDefinition<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(data.ctx.config.optimizations.deferredFunctionEvaluation.enabled) {
		/** create lazy vertex stub */
		const graph = new DataflowGraph(data.completeAst.idMap);

		/** get function body and guard against existence */
		const functionBody = args.at(-1);
		guard(functionBody !== undefined, () => `Function Definition ${name.content} has no body! This is bad!`);

		const lazyVertex = new DataflowGraphVertexLazyFunctionDefinition<OtherInfo>(name.info.id, name, args, rootId, data, graph);

		graph.addVertex(lazyVertex as unknown as DataflowGraphVertexArgument, data.ctx.env.makeCleanEnv());

		return {
			unknownReferences: [],
			in:                [],
			out:               [],
			exitPoints:        [],
			entryPoint:        name.info.id,
			graph,
			environment:       data.environment,
			hooks:             []
		};

	} else {
		/** analyze eagerly */
		return processFunctionDefinitionEagerly(name, args, rootId, data);
	}
}


/**
 * Process a function definition, i.e., `function(a, b) { ... }`
 */
export function processFunctionDefinitionEagerly<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
) {
	if(args.length < 1) {
		dataflowLogger.warn(`Function Definition ${name.content} does not have an argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* we remove the last argument, as it is the body */
	const parameters = args.slice(0, -1);
	const bodyArg = unpackNonameArg(args.at(-1));
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
		(data as { environment: REnvironmentInformation }).environment = overwriteEnvironment(data.environment, processed.environment);
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
	/* theoretically, we should just check if there is a g


    lobal effect-write somewhere within */
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
				tag:         VertexType.Use,
				id:          read.nodeId,
				environment: undefined,
				cds:         undefined
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

	updateS3Dispatches(subgraph, parameters.map<FunctionArgument>(p => {
		if(p === EmptyArgument) {
			return EmptyArgument;
		} else if(!p.name && p.value && p.value.type === RType.Parameter) {
			return { type: ReferenceType.Argument, cds: data.cds, nodeId: p.value.name.info.id, name: p.value.name.content };
		} else if(p.name) {
			return { type: ReferenceType.Argument, cds: data.cds, nodeId: p.name.info.id, name: p.name.content };
		} else {
			return EmptyArgument;
		}
	}));
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
		tag:         VertexType.FunctionDefinition,
		id:          name.info.id,
		environment: popLocalEnvironment(outEnvironment),
		cds:         data.cds,
		params:      readParams,
		subflow:     flow,
		exitPoints:  afterHookExitPoints
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

function updateS3Dispatches(graph: DataflowGraph, myArgs: FunctionArgument[]): void {
	for(const [, info] of graph.vertices(false)) {
		if(info.tag !== VertexType.FunctionCall || !info.origin.includes(BuiltInProcName.S3Dispatch)) {
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
 * Update parent function parameter tracking after nested functions have been resolved.
 * When nested functions reference parent parameters, we need to:
 * 1. Mark those parameters as read in the parent function
 * 2. Add Reads edges from call sites to arguments for those parameters
 * @param graph - dataflow graph containing the functions
 * @param fnId  - id of the parent function definition
 */
function updateParentParameterTracking(
	graph: DataflowGraph,
	fnId: NodeId
) {
	const parentVertex = graph.getVertex(fnId);
	if(!parentVertex || parentVertex.tag !== VertexType.FunctionDefinition) {
		return;
	}

	// Check each parameter to see if it now has Reads edges (from nested functions)
	for(const paramId in parentVertex.params) {
		const ingoing = graph.ingoingEdges(Number(paramId));
		const isRead = ingoing?.values().some(({ types }) => edgeIncludesType(types, EdgeType.Reads)) ?? false;

		if(isRead && !parentVertex.params[paramId]) {
			// Parameter is now read, update tracking
			parentVertex.params[paramId] = true;

			// Find call sites that use this parameter and add Reads edges
			const outgoing = graph.outgoingEdges(Number(paramId));
			if(outgoing) {
				for(const [argId, argEdgeInfo] of outgoing) {
					if(edgeIncludesType(argEdgeInfo.types, EdgeType.DefinedByOnCall)) {
						// Found an argument linked to this parameter
						const argIncoming = graph.ingoingEdges(argId);
						if(argIncoming) {
							for(const [callId, callEdgeInfo] of argIncoming) {
								if(edgeIncludesType(callEdgeInfo.types, EdgeType.Argument)) {
									// Add Reads edge from call to argument
									graph.addEdge(callId, argId, EdgeType.Reads);
								}
							}
						}
					}
				}
			}
		}
	}
}

/**
 * Process closure references for a single function definition vertex
 * @param graph          - dataflow graph containing the function
 * @param id             - node ID of the function to process
 * @param vertex         - the function definition vertex
 * @param outEnvironment - environment to resolve closures against
 * @param fnId           - id of the parent function definition (for logging)
 * @returns true if processed, false if deferred (lazy unmaterialized)
 */
function processFunctionClosures(
	graph: DataflowGraph,
	id: NodeId,
	vertex: DataflowGraphVertexFunctionDefinition,
	outEnvironment: REnvironmentInformation,
	fnId: NodeId
): boolean {
	// For unmaterialized lazy functions, store the closure environment for later
	if(isLazyFunctionDefinitionVertex(vertex) && !vertex.materialized) {
		// Store in map keyed by parent fnId - this ensures we keep the latest environment from each unique parent
		// In the normal flow, each parent should contribute exactly once, but this handles edge cases
		vertex['_pendingClosureUpdates'].set(fnId, { outEnvironment, fnId });
		return false;
	}

	const { subflow } = vertex;
	const ingoingRefs = subflow.in;
	const remainingIn: IdentifierReference[] = [];

	for(const ingoing of ingoingRefs) {
		const resolved = ingoing.name ? resolveByName(ingoing.name, outEnvironment, ingoing.type) : undefined;
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
	return true;
}

/**
 * Update closure links for a specific function and its nested functions (optimization to avoid iterating all vertices)
 * @param graph          - dataflow graph containing the function
 * @param functionId     - ID of the function to process (and its nested functions)
 * @param outEnvironment - active environment on resolving closures
 * @param fnId           - id of the parent function definition
 */
function updateFunctionAndNestedClosures(
	graph: DataflowGraph,
	functionId: NodeId,
	outEnvironment: REnvironmentInformation,
	fnId: NodeId,
	ctx: FlowrAnalyzerContext
) {
	const rootVertex = graph.getVertex(functionId);
	if(!rootVertex || rootVertex.tag !== VertexType.FunctionDefinition) {
		return;
	}

	const nestedOutEnvironment = rootVertex.subflow.environment
		? retrieveActiveEnvironment(outEnvironment, rootVertex.subflow.environment, ctx)
		: outEnvironment;

	// Process the function itself and collect nested function IDs from its subflow graph
	const functionsToProcess = new Set<NodeId>([functionId]);
	if(rootVertex.subflow?.graph) {
		for(const nestedId of rootVertex.subflow.graph) {
			const nestedVertex = graph.getVertex(nestedId);
			if(nestedVertex?.tag === VertexType.FunctionDefinition) {
				functionsToProcess.add(nestedId);
			}
		}
	}

	// Process each function
	for(const id of functionsToProcess) {
		const vertex = graph.getVertex(id);
		if(vertex?.tag === VertexType.FunctionDefinition) {
			processFunctionClosures(
				graph,
				id,
				vertex,
				id === functionId ? outEnvironment : nestedOutEnvironment,
				id === functionId ? fnId : functionId
			);
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
	// Track *all* function definitions - including those nested within the current graph
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionDefinition)) {
		processFunctionClosures(graph, id, vertex, outEnvironment, fnId);
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
	// Track remaining refs for lazy functions to avoid mutating shared vertices during iteration
	const lazyFunctionRemainingRefs = new Map<NodeId, Set<IdentifierReference>>();

	// track *all* function definitions - including those nested within the current graph,
	// try to resolve their 'in' by only using the lowest scope which will be popped after this definition
	for(const [id, { onlyBuiltin, environment, name, args }] of graph.verticesOfType(VertexType.FunctionCall)) {

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
			for(const exitPoint of targetVertex.exitPoints) {
				graph.addEdge(id, exitPoint.nodeId, EdgeType.Returns);
			}
			const ingoingRefs = targetVertex.subflow.in;
			const remainingIn: IdentifierReference[] = [];
			for(const ingoing of ingoingRefs) {
				const resolved = ingoing.name ? resolveByName(ingoing.name, effectiveEnvironment, ingoing.type) : undefined;
				if(resolved === undefined) {
					remainingIn.push(ingoing);
					continue;
				}
				const inId = ingoing.nodeId;
				expensiveTrace(dataflowLogger, () => `Found ${resolved.length} references to open ref ${id} in closure of function definition ${id}`);

				for(const { nodeId } of resolved) {
					if(!isBuiltIn(nodeId)) {
						graph.addEdge(inId, nodeId, EdgeType.DefinedByOnCall);
						graph.addEdge(id, nodeId, EdgeType.DefinesOnCall);
					}
				}
			}
			expensiveTrace(dataflowLogger, () => `Keeping ${remainingIn.length} references to open ref ${id} in closure of function definition ${id}`);

			// Lazy vertices are shared across calls - don't mutate during iteration
			if(isLazyFunctionDefinitionVertex(targetVertex)) {
				const existing = lazyFunctionRemainingRefs.get(target);
				if(!existing) {
					lazyFunctionRemainingRefs.set(target, new Set(remainingIn));
				} else {
					// Keep intersection: refs that remain unresolved in all calls
					const intersection = new Set<IdentifierReference>();
					for(const ref of remainingIn) {
						for(const e of existing) {
							if(e.nodeId === ref.nodeId) {
								intersection.add(ref);
								break;
							}
						}
					}
					lazyFunctionRemainingRefs.set(target, intersection);
				}
			} else {
				targetVertex.subflow.in = remainingIn;
			}

			const linkedParameters = graph.idMap?.get(target);
			if(linkedParameters?.type === RType.FunctionDefinition) {
				linkArgumentsOnCall(args, linkedParameters.parameters, graph);
			}
		}
	}

	// Update lazy functions with final remaining refs after all calls processed
	for(const [targetId, remainingRefs] of lazyFunctionRemainingRefs) {
		const vertex = graph.getVertex(targetId) as DataflowGraphVertexFunctionDefinition;
		vertex.subflow.in = Array.from(remainingRefs);
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
		const rid = read.nodeId;
		if(resolved !== undefined) {
			for(const { nodeId } of resolved) {
				parameters.addEdge(rid, nodeId, EdgeType.Reads);
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
		if(writingOuts[0].cds === undefined) {
			parameters.addEdge(rid, writingOuts[0].nodeId, EdgeType.Reads);
			continue;
		}
		for(const { nodeId } of writingOuts) {
			parameters.addEdge(rid, nodeId, EdgeType.Reads);
		}
	}
	return remainingRead;
}
