import { DefaultMap } from '../../util/defaultmap';
import { guard } from '../../util/assert';
import { expensiveTrace, log } from '../../util/log';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierReference } from '../environments/identifier';
import { ReferenceType } from '../environments/identifier';
import type { DataflowGraph, FunctionArgument } from '../graph/graph';
import { isNamedArgument } from '../graph/graph';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowLogger } from '../logger';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { edgeDoesNotIncludeType, edgeIncludesType, EdgeType } from '../graph/edge';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type {
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexInfo
} from '../graph/vertex';
import { VertexType } from '../graph/vertex';
import { resolveByName } from '../environments/resolve-by-name';
import { BuiltIn } from '../environments/built-in';
import { slicerLogger } from '../../slicing/static/static-slicer';
import type { REnvironmentInformation } from '../environments/environment';
import { findByPrefixIfUnique } from '../../util/prefix';

export type NameIdMap = DefaultMap<string, IdentifierReference[]>

export function findNonLocalReads(graph: DataflowGraph, ignore: readonly IdentifierReference[]): IdentifierReference[] {
	const ignores = new Set(ignore.map(i => i.nodeId));
	const ids = new Set(
		[...graph.vertices(true)]
			.filter(([_, info]) => info.tag === VertexType.Use || info.tag === VertexType.FunctionCall)
			.map(([id, _]) => id)
	);
	/* find all variable use ids which do not link to a given id */
	const nonLocalReads: IdentifierReference[] = [];
	for(const id of ids) {
		if(ignores.has(id)) {
			continue;
		}
		const outgoing = graph.outgoingEdges(id);
		const name = recoverName(id, graph.idMap);
		const origin = graph.getVertex(id, true);

		if(outgoing === undefined) {
			nonLocalReads.push({
				name:                recoverName(id, graph.idMap),
				nodeId:              id,
				controlDependencies: undefined,
				type:                origin?.tag === VertexType.FunctionCall ? ReferenceType.Function : ReferenceType.Variable
			});
			continue;
		}
		for(const [target, { types }] of outgoing) {
			if(edgeIncludesType(types, EdgeType.Reads) && !ids.has(target)) {
				if(!name) {
					dataflowLogger.warn('found non-local read without name for id ' + id);
				}
				nonLocalReads.push({
					name:                recoverName(id, graph.idMap),
					nodeId:              id,
					controlDependencies: undefined,
					type:                origin?.tag === VertexType.FunctionCall ? ReferenceType.Function : ReferenceType.Variable
				});
				break;
			}
		}
	}
	return nonLocalReads;
}

export function produceNameSharedIdMap(references: IdentifierReference[]): NameIdMap {
	const nameIdShares = new DefaultMap<string, IdentifierReference[]>(() => []);
	for(const reference of references) {
		if(reference.name) {
			nameIdShares.get(reference.name).push(reference);
		}
	}
	return nameIdShares;
}

export function linkArgumentsOnCall(args: FunctionArgument[], params: RParameter<ParentInformation>[], graph: DataflowGraph): void {
	const nameArgMap = new Map<string, IdentifierReference>(args.filter(isNamedArgument).map(a => [a.name, a] as const));
	const nameParamMap = new Map<string, RParameter<ParentInformation>>(params.map(p => [p.name.content, p]));

	const specialDotParameter = params.find(p => p.special);

	// all parameters matched by name
	const matchedParameters = new Set<string>();


	// first map names
	for(const [name, arg] of nameArgMap) {
		const pmatchName = findByPrefixIfUnique(name, [...nameParamMap.keys()]) ?? name;
		const param = nameParamMap.get(pmatchName);
		if(param !== undefined) {
			dataflowLogger.trace(`mapping named argument "${name}" to parameter "${param.name.content}"`);
			graph.addEdge(arg.nodeId, param.name.info.id, EdgeType.DefinesOnCall);
			graph.addEdge(param.name.info.id, arg.nodeId, EdgeType.DefinedByOnCall);
			matchedParameters.add(name);
		} else if(specialDotParameter !== undefined) {
			dataflowLogger.trace(`mapping named argument "${name}" to dot-dot-dot parameter`);
			graph.addEdge(arg.nodeId, specialDotParameter.name.info.id, EdgeType.DefinesOnCall);
			graph.addEdge(specialDotParameter.name.info.id, arg.nodeId, EdgeType.DefinedByOnCall);
		}
	}

	const remainingParameter = params.filter(p => !matchedParameters.has(p.name.content));
	const remainingArguments = args.filter(a => !isNamedArgument(a));

	for(let i = 0; i < remainingArguments.length; i++) {
		const arg = remainingArguments[i];
		if(arg === EmptyArgument) {
			dataflowLogger.trace(`skipping value argument for ${i}`);
			continue;
		}
		if(remainingParameter.length <= i) {
			if(specialDotParameter !== undefined) {
				dataflowLogger.trace(`mapping unnamed argument ${i} (id: ${arg.nodeId}) to dot-dot-dot parameter`);
				graph.addEdge(arg.nodeId, specialDotParameter.name.info.id, EdgeType.DefinesOnCall);
				graph.addEdge(specialDotParameter.name.info.id, arg.nodeId, EdgeType.DefinedByOnCall);
			} else {
				dataflowLogger.warn(`skipping argument ${i} as there is no corresponding parameter - R should block that`);
			}
			continue;
		}
		const param = remainingParameter[i];
		dataflowLogger.trace(`mapping unnamed argument ${i} (id: ${arg.nodeId}) to parameter "${param.name.content}"`);
		graph.addEdge(arg.nodeId, param.name.info.id, EdgeType.DefinesOnCall);
		graph.addEdge(param.name.info.id, arg.nodeId, EdgeType.DefinedByOnCall);
	}
}


function linkFunctionCallArguments(targetId: NodeId, idMap: AstIdMap, functionCallName: string | undefined, functionRootId: NodeId, callArgs: FunctionArgument[], finalGraph: DataflowGraph): void {
	// we get them by just choosing the rhs of the definition
	const linkedFunction = idMap.get(targetId);
	if(linkedFunction === undefined) {
		dataflowLogger.trace(`no function definition found for ${functionCallName} (${functionRootId})`);
		return;
	}

	if(linkedFunction.type !== RType.FunctionDefinition) {
		dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to a function definition (${functionRootId}) but got ${linkedFunction.type}`);
		return;
	}
	expensiveTrace(dataflowLogger, () => `linking arguments for ${functionCallName} (${functionRootId}) to ${JSON.stringify(linkedFunction.location)}`);
	linkArgumentsOnCall(callArgs, linkedFunction.parameters, finalGraph);
}

export function linkFunctionCallWithSingleTarget(
	graph: DataflowGraph,
	def: DataflowGraphVertexFunctionDefinition,
	info: DataflowGraphVertexFunctionCall,
	idMap: AstIdMap
) {
	const id = info.id;
	if(info.environment !== undefined) {
		// for each open ingoing reference, try to resolve it here, and if so, add a read edge from the call to signal that it reads it
		for(const ingoing of def.subflow.in) {
			const defs = ingoing.name ? resolveByName(ingoing.name, info.environment, ingoing.type) : undefined;
			if(defs === undefined) {
				continue;
			}
			for(const def of defs) {
				graph.addEdge(ingoing, def, EdgeType.DefinedByOnCall);
				graph.addEdge(id, def, EdgeType.DefinesOnCall);
			}
		}
	}

	const exitPoints = def.exitPoints;
	for(const exitPoint of exitPoints) {
		graph.addEdge(id, exitPoint, EdgeType.Returns);
	}

	const defName = recoverName(def.id, idMap);
	expensiveTrace(dataflowLogger, () => `recording expression-list-level call from ${recoverName(info.id, idMap)} to ${defName}`);
	graph.addEdge(id, def.id, EdgeType.Calls);
	linkFunctionCallArguments(def.id, idMap, defName, id, info.args, graph);
}

/* there is _a lot_ potential for optimization here */
function linkFunctionCall(
	graph: DataflowGraph,
	id: NodeId,
	info: DataflowGraphVertexFunctionCall,
	idMap: AstIdMap,
	thisGraph: DataflowGraph,
	calledFunctionDefinitions: {
		functionCall: NodeId;
		called:       readonly DataflowGraphVertexInfo[]
	}[]
) {
	const edges = graph.outgoingEdges(id);
	if(edges === undefined) {
		/* no outgoing edges */
		return;
	}

	const readBits = EdgeType.Reads | EdgeType.Calls;
	const functionDefinitionReadIds = [...edges].filter(([_, e]) =>
		edgeDoesNotIncludeType(e.types, EdgeType.Argument)
		&& edgeIncludesType(e.types, readBits)
	).map(([target, _]) => target);

	const functionDefs = getAllLinkedFunctionDefinitions(new Set(functionDefinitionReadIds), graph);
	for(const def of functionDefs.values()) {
		guard(def.tag === VertexType.FunctionDefinition, () => `expected function definition, but got ${def.tag}`);
		linkFunctionCallWithSingleTarget(graph, def, info, idMap);
	}
	if(thisGraph.isRoot(id)) {
		calledFunctionDefinitions.push({ functionCall: id, called: [...functionDefs.values()] });
	}
}

/**
 * Returns the called functions within the current graph, which can be used to merge the environments with the call.
 * Furthermore, it links the corresponding arguments.
 *
 * @param graph     - The graph to use for search and resolution traversals (ideally a superset of the `thisGraph`)
 * @param idMap     - The map to resolve ids to names
 * @param thisGraph - The graph to search for function calls in
 */
export function linkFunctionCalls(
	graph: DataflowGraph,
	idMap: AstIdMap,
	thisGraph: DataflowGraph
): { functionCall: NodeId, called: readonly DataflowGraphVertexInfo[] }[] {
	const functionCalls = [...thisGraph.vertices(true)]
		.filter(([_,info]) => info.tag === VertexType.FunctionCall);
	const calledFunctionDefinitions: { functionCall: NodeId, called: DataflowGraphVertexInfo[] }[] = [];
	for(const [id, info] of functionCalls) {
		linkFunctionCall(graph, id, info as DataflowGraphVertexFunctionCall, idMap, thisGraph, calledFunctionDefinitions);
	}
	return calledFunctionDefinitions;
}

/**
 * convenience function returning all known call targets, as well as the name source which defines them
 */
export function getAllFunctionCallTargets(call: NodeId, graph: DataflowGraph, environment?: REnvironmentInformation): NodeId[] {
	const found = [];
	const callVertex = graph.get(call, true);
	if(callVertex === undefined) {
		return [];
	}

	const [info, outgoingEdges] = callVertex;

	if(info.tag !== VertexType.FunctionCall) {
		return [];
	}

	if(info.name !== undefined && (environment !== undefined || info.environment !== undefined)) {
		const functionCallDefs = resolveByName(info.name, environment ?? info.environment as REnvironmentInformation, ReferenceType.Function)?.map(d => d.nodeId) ?? [];
		for(const [target, outgoingEdge] of outgoingEdges.entries()) {
			if(edgeIncludesType(outgoingEdge.types, EdgeType.Calls)) {
				functionCallDefs.push(target);
			}
		}
		const functionCallTargets = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), graph);
		for(const target of functionCallTargets) {
			found.push(target.id);
		}
		for(const def of functionCallDefs) {
			found.push(def);
		}
	}

	return found;
}

export function getAllLinkedFunctionDefinitions(
	functionDefinitionReadIds: ReadonlySet<NodeId>,
	dataflowGraph: DataflowGraph
): Set<DataflowGraphVertexInfo> {
	const potential: NodeId[] = [...functionDefinitionReadIds];
	const visited = new Set<NodeId>();
	const result = new Set<DataflowGraphVertexInfo>();
	while(potential.length > 0) {
		const currentId = potential.pop() as NodeId;

		// do not traverse builtins
		if(currentId === BuiltIn) {
			continue;
		}

		const currentInfo = dataflowGraph.get(currentId, true);
		if(currentInfo === undefined) {
			slicerLogger.trace('skipping unknown link');
			continue;
		}
		visited.add(currentId);

		const outgoingEdges = [...currentInfo[1]];

		const returnEdges = outgoingEdges.filter(([_, e]) => edgeIncludesType(e.types, EdgeType.Returns));
		if(returnEdges.length > 0) {
			// only traverse return edges and do not follow `calls` etc. as this indicates that we have a function call which returns a result, and not the function calls itself
			potential.push(...returnEdges.map(([target]) => target).filter(id => !visited.has(id)));
			continue;
		}

		const followBits = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
		const followEdges = outgoingEdges.filter(([_, e]) => edgeIncludesType(e.types, followBits));

		if(currentInfo[0].subflow !== undefined) {
			result.add(currentInfo[0]);
		}

		// trace all joined reads
		potential.push(...followEdges.map(([target]) => target).filter(id => !visited.has(id)));
	}
	return result;
}

/**
 * This method links a set of read variables to definitions in an environment.
 *
 * @param referencesToLinkAgainstEnvironment - The set of references to link against the environment
 * @param environmentInformation             - The environment information to link against
 * @param givenInputs                        - The existing list of inputs that might be extended
 * @param graph                              - The graph to enter the found links
 * @param maybeForRemaining                  - Each input that can not be linked, will be added to `givenInputs`. If this flag is `true`, it will be marked as `maybe`.
 *
 * @returns the given inputs, possibly extended with the remaining inputs (those of `referencesToLinkAgainstEnvironment` that could not be linked against the environment)
 */
export function linkInputs(referencesToLinkAgainstEnvironment: readonly IdentifierReference[], environmentInformation: REnvironmentInformation, givenInputs: IdentifierReference[], graph: DataflowGraph, maybeForRemaining: boolean): IdentifierReference[] {
	for(const bodyInput of referencesToLinkAgainstEnvironment) {
		const probableTarget = bodyInput.name ? resolveByName(bodyInput.name, environmentInformation, bodyInput.type) : undefined;
		if(probableTarget === undefined) {
			log.trace(`found no target for ${bodyInput.name}`);
			if(maybeForRemaining) {
				bodyInput.controlDependencies ??= [];
			}
			givenInputs.push(bodyInput);
		} else {
			for(const target of probableTarget) {
				// we can stick with maybe even if readId.attribute is always
				graph.addEdge(bodyInput, target, EdgeType.Reads);
			}
		}
	}
	// data.graph.get(node.id).definedAtPosition = false
	return givenInputs;
}

/** all loops variables which are open read (not already bound by a redefinition within the loop) get a maybe read marker to their last definition within the loop
 * e.g. with:
 * ```R
 * for(i in 1:10) {
 *  x_1 <- x_2 + 1
 * }
 * ```
 * `x_2` must get a read marker to `x_1` as `x_1` is the active redefinition in the second loop iteration.
 */
export function linkCircularRedefinitionsWithinALoop(graph: DataflowGraph, openIns: NameIdMap, outgoing: readonly IdentifierReference[]): void {
	// first, we preprocess out so that only the last definition of a given identifier survives
	// this implicitly assumes that the outgoing references are ordered
	const lastOutgoing = new Map<string, IdentifierReference>();
	for(const out of outgoing) {
		if(out.name) {
			lastOutgoing.set(out.name, out);
		}
	}

	for(const [name, targets] of openIns.entries()) {
		for(const out of lastOutgoing.values()) {
			if(out.name === name) {
				for(const target of targets) {
					graph.addEdge(target.nodeId, out.nodeId, EdgeType.Reads);
				}
			}
		}
	}
}
