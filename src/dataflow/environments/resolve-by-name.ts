import type { IEnvironment, REnvironmentInformation } from './environment';
import { BuiltInEnvironment } from './environment';
import { Ternary } from '../../util/logic';
import type { Identifier, IdentifierDefinition } from './identifier';
import { ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';


/* TODO: use bitmasks */
const TargetTypePredicate = {
	[ReferenceType.Unknown]:         () => true,
	[ReferenceType.Function]:        t => t.type === ReferenceType.Function || t.type === ReferenceType.BuiltInFunction || t.type === ReferenceType.Unknown || t.type === ReferenceType.Argument || t.type === ReferenceType.Parameter,
	[ReferenceType.Variable]:        t => t.type === ReferenceType.Variable || t.type === ReferenceType.Parameter || t.type === ReferenceType.Argument || t.type === ReferenceType.Unknown,
	[ReferenceType.Constant]:        t => t.type === ReferenceType.Constant || t.type === ReferenceType.BuiltInConstant || t.type === ReferenceType.Unknown,
	[ReferenceType.Parameter]:       () => true,
	[ReferenceType.Argument]:        () => true,
	[ReferenceType.BuiltInConstant]: t => t.type === ReferenceType.BuiltInConstant || t.type === ReferenceType.Unknown,
	[ReferenceType.BuiltInFunction]: t => t.type === ReferenceType.BuiltInFunction || t.type === ReferenceType.Unknown
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
