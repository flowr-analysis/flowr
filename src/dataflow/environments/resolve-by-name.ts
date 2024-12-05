import type { IEnvironment, REnvironmentInformation } from './environment';
import { BuiltInEnvironment } from './environment';
import { Ternary } from '../../util/logic';
import type { Identifier, IdentifierDefinition } from './identifier';
import { isReferenceType , ReferenceType } from './identifier';
import { happensInEveryBranch } from '../info';
import type { BuiltInIdentifierConstant } from './built-in';
import type { DataflowGraph } from '../graph/graph';

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

export interface ResolveResult<T = unknown> {
	value: T,
	from:  ReferenceType
}

export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): ResolveResult[] | undefined {
	if(name === undefined) {
		return undefined;
	}

	const definitions = resolveByName(name, environment, ReferenceType.Constant);
	if(definitions === undefined) {
		return undefined;
	}

	return definitions.map<ResolveResult>(def => ({
		value: (def as BuiltInIdentifierConstant).value,
		from:  def.type
	}));
}

// export function resolveToValues(name: Identifier, environment: REnvironmentInformation, graph: DataflowGraph) {
// 	/*
// 	* - Was genau ist mit alias tracking gemeint? 
// 	* - Soll resolveToValues schon benutzt werden? 
// 	* 	- überall wo resolveToConstants eingesetzt wird
// 	*   - for i in 1 -> kein loop lul
// 	*   - bei if -> true, false 
// 	* - Warum kann der Identifier undefined sein?
// 	* - Kann ich resolveByName Nutzen dafür?
// 	* - How do I get the Value from a node?
// 	*/

// 	/*
// 	* BuiltInIdentifierDefinition: Funktion
// 	* BuiltInIdentifierConstant: Const Wert (true, false, null, ...)
// 	* 
// 	* 
// 	* append: Zwei environments zusammenfügen, alten defs bleiben erhalten (union)
// 	* 
// 	* overwrite: überschreiben, aber maybe bleibt da
// 	* 
// 	* anpassen: 
// 	* - (define)
// 	* - overwrite
// 	* - append
// 	* - built-in-assignment -> define()
// 	* 
// 	* Datenfluss berechnen -> Environment Holen -> Werte anschauen ->
// 	 */
// }