import { VariableResolve } from '../../../config';
import type { LinkTo } from '../../../queries/catalog/call-context-query/call-context-query-format';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { VisitingQueue } from '../../../slicing/static/visiting-queue';
import { guard } from '../../../util/assert';
import type { BuiltInIdentifierConstant } from '../../environments/built-in';
import type { IEnvironment, REnvironmentInformation } from '../../environments/environment';
import { Identifier, ReferenceType } from '../../environments/identifier';
import { DfEdge, EdgeType } from '../../graph/edge';
import { RForLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { DataflowGraph } from '../../graph/graph';
import { onReplacementOperator, type ReplacementOperatorHandlerArgs } from '../../graph/unknown-replacement';
import { onUnknownSideEffect } from '../../graph/unknown-side-effect';
import { Vertex, VertexType } from '../../graph/vertex';
import { valueFromRNodeConstant, valueFromTsValue, valueSetGuard } from '../values/general';
import { Bottom, isTop, isValue, type Lift, Top, type Value, type ValueSet } from '../values/r-value';
import { setFrom, setOf } from '../values/sets/set-constants';
import { resolveNode } from './resolve';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RLoopConstructs, RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { Resolve } from '../../environments/resolve-helper';
import { NodeValue } from './node-value';

export type ResolveResult = Lift<ValueSet<Value[]>>;

type AliasHandler = (s: NodeId, d: DataflowGraph, e: REnvironmentInformation, def: IEnvironment) => NodeId[] | undefined;
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
	/** Variable resolve mode */
	resolve?:     VariableResolve;
	/** Context used for resolving */
	ctx:          ReadOnlyFlowrAnalyzerContext;
	/** If set, the ids that should not be considered during resolution (=&gt; top) */
	blocked?:     Set<NodeId>;
}

function getFunctionCallAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const vertex = dataflow.getVertex(sourceId);
	/* the lexeme of an infix call like `a %% b` is the whole expression, so we prefer the effective name of the vertex */
	const identifier = Vertex.isFunctionCall(vertex) ? vertex.name : NodeId.recoverName(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = Resolve.byNameAndType(identifier, environment, ReferenceType.Function);
	if(defs?.length !== 1) {
		return undefined;
	}

	return [sourceId];
}

function getUseAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: NodeId[] = [];

	// Source is Symbol -> resolve definitions of symbol
	const identifier = NodeId.recoverName(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = Resolve.byName(identifier, environment);
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
 * @param sourceIds   - node ids to get the definitions for
 * @param dataflow    - dataflow graph
 * @param environment - environment
 * @returns           node id of alias
 */
export function getAliases(sourceIds: readonly NodeId[], dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: Set<NodeId> = new Set<NodeId>();

	for(const sourceId of sourceIds) {
		const info = dataflow.getVertex(sourceId);
		if(info === undefined) {
			return undefined;
		} else if(Vertex.isFunctionDefinition(info)) {
			definitions.add(sourceId);
			continue;
		}

		const defs = AliasHandler[info.tag](sourceId, dataflow, environment);
		for(const def of defs ?? []) {
			definitions.add(def);
		}
	}

	return Array.from(definitions);
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
 * @param  id          - The node id or node to resolve
 * @param  environment - The current environment used for name resolution
 * @param  graph       - The graph to resolve in
 * @param  idMap       - The id map to resolve the node if given as an id
 * @param  full        - Whether to track aliases on resolve
 * @param  resolve     - Variable resolve mode
 * @param  ctx         - Context used for clean environment
 * @param  blocked     - If set, the ids that should not be considered during resolution (=&gt;top)
 * @useInstead {@link Resolve.toValue}
 */
export function resolveIdToValue(id: NodeId | RNodeWithParent | undefined, { environment, graph, idMap, full = true, ctx, resolve = ctx.config.solver.variables, blocked }: ResolveInfo): ResolveResult {
	blocked ??= new Set<NodeId>();

	if(id === undefined) {
		return Top;
	}

	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);
	if(node === undefined || blocked.has(node.info.id)) {
		return Top;
	}
	blocked.add(node.info.id);

	switch(node.type) {
		case RType.Argument:
			/* a missing argument (`f(x=)`) carries no value, and it is no symbol to resolve either */
			return node.value ? resolveIdToValue(node.value.info.id, { environment, graph, idMap, full, resolve, ctx, blocked }) : Top;
		case RType.Symbol:
			if(full) {
				if(environment) {
					return trackAliasInEnvironments(Identifier.toString((node as RSymbol).content), environment, { idMap, resolve, ctx, graph, blocked });
				} else if(graph && resolve === VariableResolve.Alias) {
					return trackAliasesInGraph(node.info.id, graph, ctx, idMap, blocked);
				}
			}
			return Top;
		case RType.FunctionDefinition:
			return setFrom({ type: 'function-definition' });
		case RType.FunctionCall:
		case RType.BinaryOp:
		case RType.UnaryOp:
		case RType.ExpressionList:
			return setFrom(resolveNode({
				resolve, node, ctx, environment, graph, idMap, blocked
			}));
		case RType.String:
		case RType.Number:
		case RType.Logical:
			return setFrom(valueFromRNodeConstant(node));
		default:
			return Top;
	}
}

/**
 * Resolves an id to a single constant string value, or `undefined` if it is not a unique string constant.
 * @useInstead {@link Resolve.toSingleString}
 */
export function resolveIdToSingleString(id: NodeId | RNodeWithParent | undefined, info: ResolveInfo): string | undefined {
	const element = NodeValue.sole(valueSetGuard(resolveIdToValue(id, info)), 'string');
	return element !== undefined && isValue(element.value) ? element.value.str : undefined;
}

/** the values one element of a sequence may take: a vector contributes its elements, a set what its members do */
function iteratedElements(value: Value): readonly Value[] {
	if(value.type === 'vector' && isValue(value.elements)) {
		return value.elements.flatMap(iteratedElements);
	} else if(value.type === 'set' && isValue(value.elements)) {
		return value.elements.flatMap(iteratedElements);
	}
	return [value];
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Uses the aliases that were tracked in the environments (by the
 * {@link getAliases} function) to resolve a node to a value.
 * The third argument is the {@link ResolveInfo} (ctx, idMap, ...) minus the environment, which is passed on its own.
 * @param identifier  - Identifier to resolve
 * @param environment - Environment to use
 * @returns           Value of Identifier or Top
 */
export function trackAliasInEnvironments(identifier: Identifier | undefined, environment: REnvironmentInformation, { blocked, idMap, resolve = VariableResolve.Alias, ctx, graph }: Omit<ResolveInfo, 'environment'>): ResolveResult {
	if(identifier === undefined) {
		return Top;
	}

	const defs = Resolve.byName(identifier, environment);

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
					/* the environment attempt below marks what it visited as blocked, so the retry starts from a copy */
					const beforeAttempt = blocked === undefined ? undefined : new Set(blocked);
					let value = resolveNode({ resolve, node: definitionOfAlias, ctx, environment, graph, idMap, blocked });
					if(isTop(value) && graph?.unknownSideEffects.size === 0) {
						/* `x <- x + 1`: the environment holds only the definition we are resolving, so its own operand
						 * finds nothing there, while the graph still knows which definition that operand reads. Only
						 * when nothing unknown happened, as then the environment is right to give up */
						value = resolveNode({ resolve, node: definitionOfAlias, ctx, graph, idMap, blocked: beforeAttempt });
					}
					if(isTop(value)) {
						return Top;
					}

					/* the sequence is what it runs over, so what the name holds is one of its elements */
					if(def.iterated) {
						iteratedElements(value).forEach(e => values.add(e));
					} else {
						values.add(value);
					}
				}
			}
		}
	}

	if(values.size === 0) {
		return Top;
	}

	return setOf([...values]);
}

/** given an unknown alias, we have to clear all values in the environments */
onUnknownSideEffect((_graph: DataflowGraph, env: REnvironmentInformation, _id: NodeId, target?: LinkTo<RegExp | string>) => {
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
	return RNode.iterateParents(node, ast).some(RLoopConstructs.is);
}

/** whether the node is (or sits in) a parameter's default, which any call site may override */
function isParameterDefault(node: RNodeWithParent | undefined, idMap: AstIdMap): boolean {
	return node !== undefined && (node.info.role === RoleInParent.ParameterDefaultValue
		|| RNode.iterateParents(node, idMap).some(p => p.info.role === RoleInParent.ParameterDefaultValue));
}

/**
 * The sequence a use of a `for` loop's variable runs over, `undefined` when `id` is no such use. Every
 * definition it reads has to be that variable: once anything else writes the name (`i <- i + 1` in the body),
 * the sequence no longer states what the name holds.
 */
function iteratedSequence(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): RNodeWithParent | undefined {
	let sequence: RNodeWithParent | undefined;
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(!DfEdge.includesType(edge, EdgeType.Reads)) {
			continue;
		}
		const definition = idMap.get(target);
		const loop = definition?.info.parent === undefined ? undefined : idMap.get(definition.info.parent);
		if(!RForLoop.is(loop) || loop.variable.info.id !== definition?.info.id
			|| (sequence !== undefined && sequence.info.id !== loop.vector.info.id)) {
			return undefined;
		}
		sequence = loop.vector;
	}
	return sequence;
}

/** whether the call may run a built-in as well as a definition of the program, so that what it yields is open */
function callsBuiltInAndDefinition(edges: ReadonlyMap<NodeId, DfEdge>): boolean {
	let builtIn = false;
	let defined = false;
	for(const [target, edge] of edges) {
		if(DfEdge.includesType(edge, EdgeType.Calls)) {
			builtIn ||= NodeId.isBuiltIn(target);
			defined ||= !NodeId.isBuiltIn(target);
		}
	}
	return builtIn && defined;
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Tries to resolve the value of a node by traversing the dataflow graph
 * @param id      - node to resolve
 * @param ctx     - analysis context
 * @param graph   - dataflow graph
 * @param idMap   - idmap of dataflow graph
 * @param blocked - the ids already being resolved, so a cyclic definition stops
 * @returns       Value of node or Top/Bottom
 */
export function trackAliasesInGraph(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, idMap?: AstIdMap, blocked?: Set<NodeId>): ResolveResult {
	if(!graph.get(id)) {
		return Bottom;
	}

	idMap ??= graph.idMap;
	guard(idMap !== undefined, 'The ID map is required to get the lineage of a node');

	/* a loop makes the walk below give up, yet the variable of a `for` is precisely its sequence, elementwise */
	const sequence = iteratedSequence(id, graph, idMap);
	if(sequence !== undefined) {
		const value = resolveIdToValue(sequence.info.id, { graph, idMap, ctx, blocked });
		return isTop(value) ? Top : setOf(iteratedElements(value));
	}

	const queue = new VisitingQueue(10);
	const clean = ctx.env.makeCleanEnv();
	const cleanFingerprint = ctx.env.getCleanEnvFingerprint();
	queue.add(id, clean, cleanFingerprint, false);

	let forceTop = false;

	const resultIds: NodeId[] = [];
	/* what a call the walk ended in folds to, see below */
	const folded: Value[] = [];
	while(queue.nonEmpty()) {
		const { id, baseEnvironment } = queue.next();
		const vertex = graph.getVertex(id);
		if(!vertex) {
			continue;
		}
		const cds = vertex.cds;
		for(const cd of cds ?? []) {
			const target = graph.idMap?.get(cd.id);
			if(target === undefined) {
				continue;
			}
			if(RLoopConstructs.is(target)) {
				forceTop = true;
				break;
			}
		}
		if(!forceTop && (cds?.length === 0 && isNestedInLoop(idMap.get(id), idMap))) {
			forceTop = true;
		}
		if(forceTop) {
			break;
		}
		const t = vertex.tag;
		/* a replacement (`df[1] <- v`) defines its target from just a part of it, so what it is defined by is not
		 * the value of the target */
		if(t === VertexType.VariableDefinition && idMap.get(id)?.info.role === RoleInParent.Accessed) {
			return Top;
		}
		if(t === VertexType.Value || t === VertexType.FunctionDefinition) {
			resultIds.push(id);
			continue;
		}

		const isFn = t === VertexType.FunctionCall;
		const outgoingEdges = graph.edgesFrom(id);
		if(isFn && callsBuiltInAndDefinition(outgoingEdges)) {
			/* `if(u) toupper <- function(x) "z"`: the call may run the built-in just as well as the definition,
			 * and what the two hand back has nothing to do with each other, so following the one we can walk
			 * would state the value of a call that may never happen */
			return Top;
		}
		let foundRetuns = false;
		// travel all read and defined-by edges
		for(const [targetId, edge] of outgoingEdges) {
			if(isFn) {
				if(DfEdge.isOnlyType(edge, EdgeType.Returns) || DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall) || DfEdge.isOnlyType(edge, EdgeType.DefinedBy)) {
					queue.add(targetId, baseEnvironment, cleanFingerprint, false);
				}
				foundRetuns ||= DfEdge.includesType(edge, EdgeType.Returns);
				continue;
			}
			// currently, they have to be exact!
			if(DfEdge.isOnlyType(edge, EdgeType.Reads) || DfEdge.isOnlyType(edge, EdgeType.DefinedBy) || DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall)) {
				queue.add(targetId, baseEnvironment, cleanFingerprint, false);
			}
		}
		if(isFn && !foundRetuns) {
			/* a call that hands back none of its arguments has no `Returns` edge to follow, yet the value solver may
			 * well know what it produces (`p <- file.path("data", "x.csv")`), so we fold it instead of giving up */
			const node = idMap.get(id);
			const values = isParameterDefault(node, idMap) ? undefined
				: valueSetGuard(resolveIdToValue(node, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked }));
			if(values === undefined || values.elements.some(isTop)) {
				return Top;
			}
			folded.push(...values.elements);
			continue;
		}
	}

	if(forceTop || (resultIds.length === 0 && folded.length === 0)) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>(folded);
	for(const id of resultIds) {
		const vertex = graph.getVertex(id);
		if(Vertex.isValue(vertex) && vertex.value !== undefined) {
			values.add(vertex.value);
			continue;
		}
		const node = idMap.get(id);
		if(node !== undefined) {
			if(isParameterDefault(node, idMap)) {
				return Top;
			}
			values.add(valueFromRNodeConstant(node));
		}
	}
	return values.size === 0 ? Top : setOf([...values]);
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Resolve an Identifier to a constant, if the identifier is a constant
 * @param    name        - Identifier to resolve
 * @param    environment - Environment to use
 * @returns              Value of Constant or Top
 * @useInstead {@link Resolve.toConstants}
 */
export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): ResolveResult {
	if(name === undefined) {
		return Top;
	}

	const definitions = Resolve.byNameAndType(name, environment, ReferenceType.Constant);
	if(definitions === undefined) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>();
	definitions.forEach(def => {
		const d = (def as BuiltInIdentifierConstant).value;
		values.add(d === undefined ? Top : valueFromTsValue(d));
	});
	return setOf([...values]);
}
