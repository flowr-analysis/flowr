import type { IEnvironment, REnvironmentInformation } from './environment';
import { initializeCleanEnvironments , BuiltInEnvironment } from './environment';
import { Ternary } from '../../util/logic';
import type { Identifier, IdentifierDefinition } from './identifier';
import { isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import type { BuiltInIdentifierConstant } from './built-in';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../graph/vertex';
import type { DataflowGraph } from '../graph/graph';
import { getConfig, VariableResolve } from '../../config';
import { assertUnreachable, guard } from '../../util/assert';
import type { AstIdMap, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { VisitingQueue } from '../../slicing/static/visiting-queue';
import { envFingerprint } from '../../slicing/static/fingerprint';
import { edgeIncludesType, EdgeType } from '../graph/edge';


const FunctionTargetTypes = ReferenceType.Function | ReferenceType.BuiltInFunction | ReferenceType.Unknown | ReferenceType.Argument | ReferenceType.Parameter;
const VariableTargetTypes = ReferenceType.Variable | ReferenceType.Parameter | ReferenceType.Argument | ReferenceType.Unknown;
const ConstantTargetTypes = ReferenceType.Constant | ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInConstantTargetTypes = ReferenceType.BuiltInConstant | ReferenceType.Unknown;
const BuiltInFunctionTargetTypes = ReferenceType.BuiltInFunction | ReferenceType.Unknown;

const TargetTypePredicate = {
	[ReferenceType.Unknown]:         () => true,
	[ReferenceType.Function]:        ({ type }: IdentifierDefinition) => isReferenceType(type, FunctionTargetTypes),
	[ReferenceType.Variable]:        ({ type }: IdentifierDefinition) => isReferenceType(type, VariableTargetTypes),
	[ReferenceType.Constant]:        ({ type }: IdentifierDefinition) => isReferenceType(type, ConstantTargetTypes),
	[ReferenceType.Parameter]:       () => true,
	[ReferenceType.Argument]:        () => true,
	[ReferenceType.BuiltInConstant]: ({ type }: IdentifierDefinition) => isReferenceType(type, BuiltInConstantTargetTypes),
	[ReferenceType.BuiltInFunction]: ({ type }: IdentifierDefinition) => isReferenceType(type, BuiltInFunctionTargetTypes)
} as const satisfies Record<ReferenceType, (t: IdentifierDefinition) => boolean>;

/**
 * Resolves a given identifier name to a list of its possible definition location using R scoping and resolving rules.
 *
 * @param name         - The name of the identifier to resolve
 * @param environment  - The current environment used for name resolution
 * @param target       - The target (meta) type of the identifier to resolve
 *
 * @returns A list of possible identifier definitions (one if the definition location is exactly and always known), or `undefined`
 *          if the identifier is undefined in the current scope/with the current environment information.
 */
export function resolveByName(name: Identifier, environment: REnvironmentInformation, target: ReferenceType = ReferenceType.Unknown): IdentifierDefinition[] | undefined {
	let current: IEnvironment = environment.current;
	let definitions: IdentifierDefinition[] | undefined = undefined;
	const wantedType = TargetTypePredicate[target];
	do{
		const definition = current.memory.get(name);
		if(definition !== undefined) {
			const filtered = definition.filter(wantedType);
			if(filtered.length === definition.length && definition.every(d => happensInEveryBranch(d.controlDependencies))) {
				return definition;
			} else if(filtered.length > 0) {
				definitions ??= [];
				definitions.push(...filtered);
			}
		}
		current = current.parent;
	} while(current.id !== BuiltInEnvironment.id);

	const builtIns = current.memory.get(name);
	if(definitions) {
		return builtIns === undefined ? definitions : [...definitions, ...builtIns];
	} else {
		return builtIns;
	}
}

export function resolvesToBuiltInConstant(name: Identifier | undefined, environment: REnvironmentInformation, wantedValue: unknown): Ternary {
	if(name === undefined) {
		return Ternary.Never;
	}
	const definition = resolveByName(name, environment, ReferenceType.Constant);

	if(definition === undefined) {
		return Ternary.Never;
	}

	let all = true;
	let some = false;
	for(const def of definition) {
		if(def.type === ReferenceType.BuiltInConstant && def.value === wantedValue) {
			some = true;
		} else {
			all = false;
		}
	}

	if(all) {
		return Ternary.Always;
	} else {
		return some ? Ternary.Maybe : Ternary.Never;
	}
}

/** Please use {@link resolveValueOfVariable} */
export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): unknown[] | undefined {
	if(name === undefined) {
		return undefined;
	}

	const definitions = resolveByName(name, environment, ReferenceType.Constant);

	return definitions?.map(def => (def as BuiltInIdentifierConstant).value);
}

type AliasHandler = (s: NodeId, d: DataflowGraph, e: REnvironmentInformation) => NodeId[] | undefined;

const AliasHandler = {
	[VertexType.Value]:              (sourceId: NodeId) => [sourceId],
	[VertexType.Use]:                getUseAlias,
	[VertexType.FunctionCall]:       () => undefined,
	[VertexType.FunctionDefinition]: () => undefined,
	[VertexType.VariableDefinition]: () => undefined
} as const satisfies Record<VertexType, AliasHandler>;

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

/** Please use {@link resolveValueOfVariable} */
export function trackAliasInEnvironments(identifier: Identifier | undefined, use: REnvironmentInformation, idMap?: AstIdMap): unknown[] | undefined {
	if(identifier === undefined) {
		return undefined;
	}

	const defs = resolveByName(identifier, use);
	if(defs === undefined) {
		return undefined;
	}

	const values: unknown[] = [];
	for(const def of defs) {
		if(def.type === ReferenceType.BuiltInConstant) {
			values.push(def.value);
		} else if(def.type === ReferenceType.BuiltInFunction) {
			// Tracked in #1207
		} else if(def.value !== undefined) {
			/* if there is at least one location for which we have no idea, we have to give up for now! */
			if(def.value.length === 0) {
				return undefined;
			}
			for(const id of def.value) {
				const value = idMap?.get(id)?.content;
				if(value !== undefined) {
					values.push(value);
				}
			}
		}
	}

	if(values.length == 0) {
		return undefined;
	}

	return values;
}

export function trackAliasesInGraph(id: NodeId, graph: DataflowGraph, idMap?: AstIdMap): unknown[] | undefined {
	idMap ??= graph.idMap;
	guard(idMap !== undefined, 'The ID map is required to get the lineage of a node');
	const start = graph.getVertex(id);
	guard(start !== undefined, 'Unable to find start for alias tracking');

	const queue = new VisitingQueue(25);
	const clean = initializeCleanEnvironments();
	const cleanFingerprint = envFingerprint(clean);
	queue.add(id, clean, cleanFingerprint, false);

	const resultIds: NodeId[] = [];
	while(queue.nonEmpty()) {
		const { id, baseEnvironment } = queue.next();
		const res = graph.get(id);
		if(!res) {
			continue;
		}
		const [vertex, outgoingEdges] = res;
		if(vertex.tag === VertexType.Value) {
			resultIds.push(id);
			continue;
		}

		// travel all read and defined-by edges
		for(const [targetId, edge] of outgoingEdges) {
			if(edgeIncludesType(edge.types, EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall)) {
				queue.add(targetId, baseEnvironment, cleanFingerprint, false);
			}
		}
	}

	if(resultIds.length === 0) {
		return undefined;
	}
	const values: unknown[] = [];
	for(const id of resultIds) {
		const node = idMap.get(id);
		if(node !== undefined) {
			values.push(node.content);
		}
	}
	return values;
}
/**
 * Convenience function using the variable resolver as specified within the configuration file
 * In the future we may want to have this set once at the start of the analysis
 *
 * @see {@link resolve} - for a more general approach which "evaluates" a node based on value resolve
 */
export function resolveValueOfVariable(identifier: Identifier | undefined, environment: REnvironmentInformation, idMap?: AstIdMap): unknown[] | undefined {
	const resolve = getConfig().solver.variables;

	switch(resolve) {
		case VariableResolve.Alias: return trackAliasInEnvironments(identifier, environment, idMap);
		case VariableResolve.Builtin: return resolveToConstants(identifier, environment);
		case VariableResolve.Disabled: return [];
		default: assertUnreachable(resolve);
	}
}

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

/**
 * Generalized {@link resolveValueOfVariable} function which evaluates a node based on the value resolve
 *
 * @param id         - The node id or node to resolve
 * @param environment - The current environment used for name resolution
 * @param idMap      - The id map to resolve the node if given as an id
 * @param full       - Whether to track variables
 */
export function resolve(id: NodeId | RNodeWithParent, { environment, graph, idMap, full } : ResolveInfo): unknown[] | undefined {
	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);
	if(node === undefined) {
		return undefined;
	}
	switch(node.type) {
		case RType.Symbol:
			if(environment) {
				return full ? resolveValueOfVariable(node.lexeme, environment, idMap) : undefined;
			} else if(graph && getConfig().solver.variables === VariableResolve.Alias) {
				return full ? trackAliasesInGraph(node.info.id, graph, idMap) : undefined;
			} else {
				return undefined;
			}
		case RType.String:
		case RType.Number:
		case RType.Logical:
			return [node.content];
		default:
			return undefined;
	}
}