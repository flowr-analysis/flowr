import type { IEnvironment, REnvironmentInformation } from './environment';
import { BuiltInEnvironment } from './environment';
import { Ternary } from '../../util/logic';
import type { Identifier, IdentifierDefinition } from './identifier';
import { isReferenceType, ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import type { BuiltInIdentifierConstant } from './built-in';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../graph/vertex';
import type { DataflowGraph } from '../graph/graph';
import { getConfig } from '../../config';
import { assertUnreachable } from '../../util/assert';


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
 * @returns A list of possible definitions of the identifier (one if the definition location is exactly and always known), or `undefined` if the identifier is undefined in the current scope/with the current environment information.
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

export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): unknown[] | undefined {
	if(name === undefined) {
		return undefined;
	}

	const definitions = resolveByName(name, environment, ReferenceType.Constant);
	if(definitions === undefined) {
		return undefined;
	}

	return definitions.map(def => (def as BuiltInIdentifierConstant).value);
}

const AliasHandler = {
	[VertexType.Value]:              (sourceId: NodeId) => [sourceId],
	[VertexType.Use]:                getUseAlias,
	[VertexType.FunctionCall]:       () => undefined,
	[VertexType.FunctionDefinition]: () => undefined,
	[VertexType.VariableDefinition]: () => undefined
} as const satisfies Record<VertexType, (s: NodeId, d: DataflowGraph, e: REnvironmentInformation) => NodeId[] | undefined>;

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
		defs?.forEach(v => definitions.add(v));
	}

	return [...definitions];
}

export function resolveToValues(identifier: Identifier | undefined, environment: REnvironmentInformation, graph: DataflowGraph): unknown[] | undefined {
	if(identifier === undefined) {
		return undefined;
	}

	const defs = resolveByName(identifier, environment);
	if(defs === undefined) {
		return undefined;
	}

	const values: unknown[] = [];
	for(const def of defs) {
		if(def.type === ReferenceType.BuiltInConstant) {
			values.push(def.value);
		} else if(def.type === ReferenceType.BuiltInFunction) {
			// TODO: nothing?
		} else {
			if(def.value !== undefined) {
				for(const id of def.value) {
					const value = graph.idMap?.get(id)?.content;
					if(value !== undefined) {
						values.push(value);
					}
				}
			}
		}
	}

	if(values.length == 0) {
		return undefined;
	}

	return values;
}

export function resolve(identifier: Identifier | undefined, environment: REnvironmentInformation, graph: DataflowGraph): unknown[] | undefined {
	const resolve = getConfig().resolve;

	switch(resolve) {
		case 'alias': return resolveToValues(identifier, environment, graph);
		case 'builtin': return resolveToConstants(identifier, environment);
		case 'disabled': return [];
		default: assertUnreachable(resolve);
	}
}

