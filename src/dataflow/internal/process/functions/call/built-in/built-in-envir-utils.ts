/** Shared utilities for built-in functions that interact with tracked R environments. */
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { unpackArg } from '../argument/unpack-argument';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import type { Identifier, IdentifierDefinition, InGraphIdentifierDefinition, NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { findByPrefixIfUnique } from '../../../../../../util/prefix';
import { resolveNodeToStackEnv } from './built-in-stack-env';

/** A tracked env is a real stack environment (not a private custom env) when its current layer is the global or the built-in/base env. */
function isStackEnvState(envState: REnvironmentInformation): boolean {
	return envState.current.globalEnv === true || envState.current.builtInEnv === true;
}

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:   DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:      NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId: NodeId;
	/** `true` when this resolves to a real stack environment (`globalenv()`/`.GlobalEnv`), not a tracked custom env. */
	readonly isStackEnv?: boolean;
}

/** Maps a list of identifier definitions (from {@link resolveByName}) to an {@link EnvirResolution}, merging the envStates of multiple reaching definitions. */
function resolveDefsToEnvirResolution<OtherInfo>(
	defs:   readonly IdentifierDefinition[] | undefined,
	nodeId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	if(!defs || defs.length === 0) {
		return undefined;
	}
	const inDefs = defs as readonly InGraphIdentifierDefinition[];
	if(inDefs.length === 1) {
		const envState = inDefs[0].envState;
		if(!envState) {
			return undefined;
		}
		const envDef = inDefs[0] as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
		return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, isStackEnv: isStackEnvState(envState) };
	}
	if(!inDefs.every(d => d.envState !== undefined)) {
		return undefined;
	}
	let mergedEnvState = inDefs[0].envState as REnvironmentInformation;
	for(let i = 1; i < inDefs.length; i++) {
		for(const [, varDefs] of (inDefs[i].envState as REnvironmentInformation).current.memory) {
			for(const varDef of varDefs) {
				const named = varDef as InGraphIdentifierDefinition & { name: Identifier };
				if(named.name !== undefined) {
					mergedEnvState = define(named, false, mergedEnvState);
				}
			}
		}
	}
	const envDef: NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation } = {
		...(inDefs[0] as NamedInGraphIdentifierDefinition),
		envState: mergedEnvState
	};
	return { envirData: { ...data, environment: mergedEnvState }, envDef, envirNodeId: nodeId };
}

/**
 * Binds call arguments to formal parameter names using R's matching rules: exact name, then partial (pmatch) name, then remaining unnamed args left-to-right.
 * Pass `paramNames` as the full formal parameter list (excluding `...`) so ambiguous prefixes are rejected.
 */
export function bindArgs<OtherInfo>(
	args:       readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	paramNames: readonly string[]
): ReadonlyMap<string, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>> {
	const bound = new Map<string, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>>();
	const used = new Set<number>();

	/* pass 1: exact name matches */
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		if(arg === EmptyArgument || arg.name === undefined) {
			continue;
		}
		const n = arg.name.content as string;
		if(paramNames.includes(n) && !bound.has(n)) {
			bound.set(n, arg);
			used.add(i);
		}
	}
	/* pass 2: partial (pmatch) name matches */
	for(let i = 0; i < args.length; i++) {
		if(used.has(i)) {
			continue;
		}
		const arg = args[i];
		if(arg === EmptyArgument || arg.name === undefined) {
			continue;
		}
		const matched = findByPrefixIfUnique(arg.name.content as string, paramNames);
		if(matched !== undefined && !bound.has(matched)) {
			bound.set(matched, arg);
			used.add(i);
		}
	}
	/* pass 3: remaining unnamed args fill remaining formal params left-to-right */
	let formalIdx = 0;
	for(let i = 0; i < args.length; i++) {
		if(used.has(i)) {
			continue;
		}
		const arg = args[i];
		if(arg === EmptyArgument || arg.name !== undefined) {
			continue;
		}
		while(formalIdx < paramNames.length && bound.has(paramNames[formalIdx])) {
			formalIdx++;
		}
		if(formalIdx < paramNames.length) {
			bound.set(paramNames[formalIdx], arg);
			used.add(i);
			formalIdx++;
		}
	}
	return bound;
}

/** Resolves a single already-found argument (e.g. from {@link bindArgs}) to an {@link EnvirResolution} when it is a symbol holding a tracked envState. */
export function resolveArgToEnvir<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	if(arg === EmptyArgument) {
		return undefined;
	}
	const node = unpackArg(arg);
	// `.GlobalEnv`/`.BaseEnv` or a `globalenv()`/`baseenv()`/`emptyenv()` call resolves to the corresponding stack env
	const stackEnv = resolveNodeToStackEnv(node, data);
	if(stackEnv !== undefined && node !== undefined) {
		return stackEnvirResolution(stackEnv, node.info.id, node.lexeme ?? '', data);
	}
	if(node?.type !== RType.Symbol) {
		return undefined;
	}
	return resolveDefsToEnvirResolution(resolveByName(node.content, data.environment, ReferenceType.Variable), node.info.id, data);
}

/** Builds an {@link EnvirResolution} for an environment obtained directly (not via a holder variable), e.g. `globalenv()` / `.GlobalEnv`. */
function stackEnvirResolution<OtherInfo>(
	envState: REnvironmentInformation,
	nodeId:   NodeId,
	lexeme:   string,
	data:     DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> {
	// no holder variable: envDef is only a carrier for envState/nodeId
	const envDef = {
		name:      lexeme as Identifier,
		nodeId,
		type:      ReferenceType.Variable,
		definedAt: nodeId,
		envState,
	} as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, isStackEnv: true };
}

/** Resolves the `argName` argument (default `'envir'`, pmatch against `allParamNames`), falling back to `positionalFallbackIndex`, to an {@link EnvirResolution}. */
export function resolveEnvirArg<OtherInfo>(
	args:                   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:                   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	argName                 = 'envir',
	positionalFallbackIndex?: number,
	allParamNames:          readonly string[] = [argName]
): EnvirResolution<OtherInfo> | undefined {
	/* named pass: pmatch against the full parameter list */
	for(const arg of args) {
		if(arg === EmptyArgument || arg.name === undefined) {
			continue;
		}
		if(findByPrefixIfUnique(arg.name.content as string, allParamNames) === argName) {
			return resolveArgToEnvir(arg, data);
		}
	}
	/* positional fallback (only when no named match existed) */
	if(positionalFallbackIndex !== undefined) {
		let pos = 0;
		for(const arg of args) {
			if(arg === EmptyArgument || arg.name !== undefined) {
				continue;
			}
			if(pos === positionalFallbackIndex) {
				return resolveArgToEnvir(arg, data);
			}
			pos++;
		}
	}
	return undefined;
}

/** Resolves a symbol by name to an {@link EnvirResolution} when it holds a tracked environment. */
export function resolveSymbolToEnvir<OtherInfo>(
	symbolName: Identifier,
	nodeId:     NodeId,
	data:       DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	return resolveDefsToEnvirResolution(resolveByName(symbolName, data.environment, ReferenceType.Variable), nodeId, data);
}

/** Moves definitions written into a custom environment from the caller's scope into `envDef`'s tracked `envState`, re-defining the holder variable. */
export function routeWrittenToCustomEnv(
	result:    DataflowInformation,
	envDef:    NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation },
	newDefAt:  NodeId,
	definedAt?: NodeId
): DataflowInformation {
	const written = result.out.filter(
		(d): d is NamedInGraphIdentifierDefinition =>
			d.name !== undefined && 'definedAt' in d &&
			(definedAt === undefined || d.definedAt === definedAt)
	);

	let newEnvState = envDef.envState;
	const namesToRemove = written.map(w => ({ name: w.name }));
	for(const w of written) {
		newEnvState = define(w, false, newEnvState);
	}

	const newEnvironment = define(
		{ ...envDef, definedAt: newDefAt, envState: newEnvState },
		false,
		{ current: result.environment.current.removeAll(namesToRemove), level: result.environment.level }
	);
	return { ...result, environment: newEnvironment };
}
