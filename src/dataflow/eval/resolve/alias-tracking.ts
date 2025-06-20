import { getConfig, VariableResolve } from '../../../config';
import type { LinkTo } from '../../../queries/catalog/call-context-query/call-context-query-format';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { envFingerprint } from '../../../slicing/static/fingerprint';
import { VisitingQueue } from '../../../slicing/static/visiting-queue';
import { guard } from '../../../util/assert';
import type { BuiltInIdentifierConstant } from '../../environments/built-in';
import type { REnvironmentInformation } from '../../environments/environment';
import { initializeCleanEnvironments } from '../../environments/environment';
import type { Identifier } from '../../environments/identifier';
import { ReferenceType } from '../../environments/identifier';
import { resolveByName } from '../../environments/resolve-by-name';
import { EdgeType } from '../../graph/edge';
import type { DataflowGraph } from '../../graph/graph';
import type { ReplacementOperatorHandlerArgs } from '../../graph/unknown-replacement';
import { onReplacementOperator } from '../../graph/unknown-replacement';
import { onUnknownSideEffect } from '../../graph/unknown-side-effect';
import { VertexType } from '../../graph/vertex';
import { valueFromRNodeConstant, valueFromTsValue } from '../values/general';
import type { Lift, Value, ValueSet } from '../values/r-value';
import { Bottom, isTop, Top } from '../values/r-value';
import { setFrom } from '../values/sets/set-constants';
import { resolveNode } from './resolve';

export type ResolveResult = Lift<ValueSet<Value[]>>;

type AliasHandler = (s: NodeId, d: DataflowGraph, e: REnvironmentInformation) => NodeId[] | undefined;
const AliasHandler = {
	[VertexType.Value]:              (sourceId: NodeId) => [sourceId],
	[VertexType.Use]:                getUseAlias,
	[VertexType.FunctionCall]:       getFunctionCallAlias,
	[VertexType.FunctionDefinition]: () => undefined,
	[VertexType.VariableDefinition]: () => undefined
} as const satisfies Record<VertexType, AliasHandler>;

export interface ResolveInfo {
	/** The current environment used for name resolution */
	environment?: REnvironmentInformation;
	/** The id map to resolve the node if given as an id */
	idMap?:       AstIdMap;
	/** The graph to resolve in */
	graph?:       DataflowGraph;
	/** Whether to track variables */
	full?:        boolean;
}

function getFunctionCallAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const identifier = recoverName(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = resolveByName(identifier, environment, ReferenceType.Function);
	if(defs === undefined || defs.length !== 1) {
		return undefined;
	}	
	
	return [sourceId]; 
}

function getUseAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: NodeId[] = [];

	// Source is Symbol -> resolve definitions of symbol
	const identifier = recoverName(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = resolveByName(identifier, environment);
	if(defs === undefined) {
		return undefined;
	}

	for(const def of defs) {
		// If one definition is not constant (or a variable aliasing a constant)
		// we can't say for sure what value the source has
		if(def.type === ReferenceType.Variable) {
			if(def.value === undefined) {
				return undefined;
			}
			definitions.push(...def.value);
		} else if(def.type === ReferenceType.Constant || def.type === ReferenceType.BuiltInConstant) {
			definitions.push(def.nodeId);
		} else {
			return undefined;
		}
	}

	return definitions;
}

/**
 * Gets the definitions / aliases of a node
 * 
 * This function is called by the built-in-assignment processor so that we can 
 * track assignments inside the environment. The returned ids are stored in
 * the sourceIds value field of their InGraphIdentifierDefinition. This enables
 * us later, in the {@link trackAliasInEnvironments} function, to get all the 
 * aliases of an identifier.
 * 
 * @param sourceIds    - node ids to get the definitions for
 * @param dataflow     - dataflow graph
 * @param environment  - environment
 * @returns node id of alias
 */
export function getAliases(sourceIds: readonly NodeId[], dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: Set<NodeId> = new Set<NodeId>();

	for(const sourceId of sourceIds) {
		const info = dataflow.getVertex(sourceId);
		if(info === undefined) {
			return undefined;
		}

		const defs = AliasHandler[info.tag](sourceId, dataflow, environment);
		for(const def of defs ?? []) {
			definitions.add(def);
		}
	}

	return [...definitions];
}

/**
 * Evaluates the value of a node in the set domain.
 * 
 * resolveIdToValue tries to resolve the value using the data it has been given.
 * If the environment is provided the approximation is more precise, as we can 
 * track aliases in the environment.
 * Otherwise, the graph is used to try and resolve the nodes value.
 * If neither is provided the value cannot be resolved.
 * 
 * This function is also used by the Resolve Value Query and the Dependency Query
 * to resolve values. For e.g. in the Dependency Query it is used to resolve calls
 * like `lapply(c("a", "b", "c"), library, character.only = TRUE)`
 *
 * @param id          - The node id or node to resolve
 * @param environment - The current environment used for name resolution
 * @param graph       - The graph to resolve in
 * @param idMap       - The id map to resolve the node if given as an id
 * @param full        - Whether to track aliases on resolve
 */
export function resolveIdToValue(id: NodeId | RNodeWithParent | undefined, { environment, graph, idMap, full = true } : ResolveInfo): ResolveResult {
	if(id === undefined) {
		return Top;
	}
	
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);
	if(node === undefined) {
		return Top;
	}

	switch(node.type) {
		case RType.Argument:
		case RType.Symbol:
			if(environment) {
				return full ? trackAliasInEnvironments(node.lexeme, environment, graph, idMap) : Top;
			} else if(graph && getConfig().solver.variables === VariableResolve.Alias) {
				return full ? trackAliasesInGraph(node.info.id, graph, idMap) : Top;
			} else {
				return Top;
			}
		case RType.FunctionCall:
			return setFrom(resolveNode(node, environment, graph, idMap));
		case RType.String:
		case RType.Number:
		case RType.Logical:
			return setFrom(valueFromRNodeConstant(node));
		default:
			return Top;
	}
}

/**
 * Please use {@link resolveIdToValue}
 * 
 * Uses the aliases that were tracked in the environments (by the
 * {@link getAliases} function) to resolve a node to a value.
 * 
 * 
 * @param identifier - Identifier to resolve
 * @param use        - Environment to use
 * @param graph      - Dataflow graph
 * @param idMap      - id map of Dataflow graph
 * @returns Value of Identifier or Top
 */
export function trackAliasInEnvironments(identifier: Identifier | undefined, use: REnvironmentInformation, graph?: DataflowGraph, idMap?: AstIdMap): ResolveResult {
	if(identifier === undefined) {
		return Top;
	}

	const defs = resolveByName(identifier, use);
	if(defs === undefined) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>();
	for(const def of defs) {
		if(def.type === ReferenceType.BuiltInConstant) {
			values.add(valueFromTsValue(def.value));
		} else if(def.type === ReferenceType.BuiltInFunction) {
			// Tracked in #1207
		} else if(def.value !== undefined) {
			/* if there is at least one location for which we have no idea, we have to give up for now! */
			if(def.value.length === 0) {
				return Top;
			}
		
			for(const alias of def.value) {
				const definitionOfAlias = idMap?.get(alias);
				if(definitionOfAlias !== undefined) {
					const value = resolveNode(definitionOfAlias, use, graph, idMap);
					if(isTop(value)) {
						return Top;
					} 

					values.add(value);
				}
			}
		}
	}

	if(values.size == 0) {
		return Top;
	}

	return setFrom(...values);
}


/** given an unknown alias, we have to clear all values in the environments */
onUnknownSideEffect((_graph: DataflowGraph, env: REnvironmentInformation, _id: NodeId, target?: LinkTo) => {
	if(target) {
		return;
	}

	let current = env.current;
	while(current) {
		current.memory.forEach(mem => mem.forEach((def) => {
			if(def.type !== ReferenceType.BuiltInConstant 
				&& def.type !== ReferenceType.BuiltInFunction 
				&& def.value !== undefined) {
				def.value.length = 0;
			}
		}));

		current = current.parent;
	}
});

onReplacementOperator((args: ReplacementOperatorHandlerArgs) => {
	if(!args.target) {
		return;
	}

	let current = args.env.current;
	while(current) {
		const defs = current.memory.get(args.target);
		defs?.forEach(def  => {
			if(def.type !== ReferenceType.BuiltInConstant 
				&& def.type !== ReferenceType.BuiltInFunction 
				&& def.value !== undefined) {
				def.value.length = 0;
			}
		});

		current = current.parent;
	}
});

function isNestedInLoop(node: RNodeWithParent | undefined, ast: AstIdMap): boolean {
	const parent = node?.info.parent;
	if(node === undefined || !parent) {
		return false;
	}

	const parentNode = ast.get(parent);
	if(parentNode === undefined) {
		return false;
	}

	if(parentNode.type === RType.WhileLoop || parentNode.type === RType.RepeatLoop) {
		return true;
	}

	return isNestedInLoop(parentNode, ast);
}

/**
 * Please use {@link resolveIdToValue} 
 * 
 * Tries to resolve the value of a node by traversing the dataflow graph
 * 
 * @param id    - node to resolve
 * @param graph - dataflow graph
 * @param idMap - idmap of dataflow graph
 * @returns Value of node or Top/Bottom
 */
export function trackAliasesInGraph(id: NodeId, graph: DataflowGraph, idMap?: AstIdMap): ResolveResult {
	idMap ??= graph.idMap;
	guard(idMap !== undefined, 'The ID map is required to get the lineage of a node');
	const start = graph.getVertex(id);
	guard(start !== undefined, 'Unable to find start for alias tracking');

	const queue = new VisitingQueue(25);
	const clean = initializeCleanEnvironments();
	const cleanFingerprint = envFingerprint(clean);
	queue.add(id, clean, cleanFingerprint, false);

	let forceBot = false;

	const resultIds: NodeId[] = [];
	while(queue.nonEmpty()) {
		const { id, baseEnvironment } = queue.next();
		const res = graph.get(id);
		if(!res) {
			continue;
		}
		const [vertex, outgoingEdges] = res;
		const cds = vertex.cds;
		for(const cd of cds ?? []) {
			const target = graph.idMap?.get(cd.id);
			if(target === undefined) {
				continue;
			}
			if(target.type === RType.WhileLoop || target.type === RType.RepeatLoop) {
				forceBot = true;
				break;
			}
		}
		if(!forceBot && (cds?.length === 0 && isNestedInLoop(idMap.get(id), idMap))) {
			forceBot = true;
		}
		if(forceBot) {
			break;
		}
		if(vertex.tag === VertexType.Value) {
			resultIds.push(id);
			continue;
		} else if(vertex.tag === VertexType.FunctionDefinition) {
			resultIds.push(id);
			continue;
		}

		const isFn = vertex.tag === VertexType.FunctionCall;


		// travel all read and defined-by edges
		for(const [targetId, edge] of outgoingEdges) {
			if(isFn) {
				if(edge.types === EdgeType.Returns || edge.types === EdgeType.DefinedByOnCall || edge.types ===  EdgeType.DefinedBy) {
					queue.add(targetId, baseEnvironment, cleanFingerprint, false);
				}
				continue;
			}
			// currently, they have to be exact!
			if(edge.types === EdgeType.Reads || edge.types ===  EdgeType.DefinedBy || edge.types === EdgeType.DefinedByOnCall) {
				queue.add(targetId, baseEnvironment, cleanFingerprint, false);
			}
		}
	}
	if(forceBot || resultIds.length === 0) {
		return Bottom;
	}
	const values: Set<Value> = new Set<Value>();
	for(const id of resultIds) {
		const node = idMap.get(id);
		if(node !== undefined) {
			values.add(valueFromRNodeConstant(node));
		}
	}
	return setFrom(...values);
}

/**
 * Please use {@link resolveIdToValue}
 * 
 * Resolve an Identifier to a constant, if the identifier is a constant
 * 
 * @param name        - Identifier to resolve
 * @param environment - Environment to use
 * @returns Value of Constant or Top
 */
export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): ResolveResult {
	if(name === undefined) {
		return Top;
	}

	const definitions = resolveByName(name, environment, ReferenceType.Constant);
	if(definitions === undefined) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>();
	definitions.forEach(def => values.add(valueFromTsValue((def as BuiltInIdentifierConstant).value ?? Top)));
	return setFrom(...values);
}
