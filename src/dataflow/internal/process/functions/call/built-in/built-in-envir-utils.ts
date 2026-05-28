/**
 * Shared utilities for built-in functions that interact with tracked R environments.
 *
 * - {@link bindArgs} - bind call arguments to formal parameter names using R's matching rules.
 * - {@link resolveArgToEnvir} - resolve a single already-found argument to an {@link EnvirResolution}.
 * - {@link resolveEnvirArg} / {@link resolveSymbolToEnvir} - resolve a named argument or
 *   symbol to an {@link EnvirResolution} when it holds a tracked {@link InGraphIdentifierDefinition#envState}.
 * - {@link routeWrittenToCustomEnv} - move written definitions from the caller's scope into
 *   the holder variable's `envState` after processing an expression that writes into a custom env.
 */
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

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:   DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:      NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId: NodeId;
}

/**
 * Core resolver: maps a list of identifier definitions (from {@link resolveByName}) to an
 * {@link EnvirResolution}.  Accepts `undefined` so callers can pass `resolveByName` results
 * directly without an intermediate null check.
 *
 * Multiple reaching definitions (e.g. from if/else branches) are accepted only when every
 * definition carries an envState; their envStates are merged into a single combined snapshot.
 */
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
		return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId };
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
 * Binds call arguments to formal parameter names following R's standard matching rules:
 * 1. Exact name matches (named args bound to exact-matching formal params).
 * 2. Partial (pmatch) name matches via {@link findByPrefixIfUnique}.
 * 3. Remaining unnamed args fill remaining unbound formal params left-to-right.
 *
 * Pass `paramNames` as the full formal parameter list (excluding `...`) so ambiguous
 * prefixes are rejected correctly.  Use this when multiple formals must be found
 * simultaneously so that named-arg binding is consistent across all formals.
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

/**
 * Resolves a single already-found argument (e.g. from {@link bindArgs}) to an
 * {@link EnvirResolution} when the argument is a symbol that holds a tracked envState.
 * Returns `undefined` when the arg is empty, non-symbolic, or unresolved.
 */
export function resolveArgToEnvir<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	if(arg === EmptyArgument) {
		return undefined;
	}
	const node = unpackArg(arg);
	if(node?.type !== RType.Symbol) {
		return undefined;
	}
	return resolveDefsToEnvirResolution(resolveByName(node.content, data.environment, ReferenceType.Variable), node.info.id, data);
}

/**
 * Scans `args` for an argument named `argName` (default `'envir'`), or - when
 * `positionalFallbackIndex` is given - for the arg at that positional index when
 * no named match is found.  When the resolved argument is a symbol that resolves
 * to a variable with a tracked {@link InGraphIdentifierDefinition#envState},
 * returns the resolved context; otherwise returns `undefined`.
 *
 * Named matching uses pmatch semantics: pass `allParamNames` (the full formal parameter
 * list) so ambiguous prefixes are rejected.  Defaults to `[argName]`, which allows
 * prefix matches for `argName` only.
 *
 * When multiple formals must be matched simultaneously (e.g. `data` and `expr` in `with`),
 * use {@link bindArgs} + {@link resolveArgToEnvir} instead so named binding is consistent.
 */
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

/**
 * Resolves a symbol by name to an {@link EnvirResolution} when the symbol holds a tracked
 * environment.  Handles multiple reaching definitions (e.g. from if/else branches) by
 * merging their envStates - see {@link resolveDefsToEnvirResolution}.
 * Returns `undefined` when the name cannot be resolved or none of its definitions carry an envState.
 */
export function resolveSymbolToEnvir<OtherInfo>(
	symbolName: Identifier,
	nodeId:     NodeId,
	data:       DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	return resolveDefsToEnvirResolution(resolveByName(symbolName, data.environment, ReferenceType.Variable), nodeId, data);
}

/**
 * After processing an expression that writes into a custom environment, moves the
 * written definitions from the caller's scope into `envDef`'s tracked `envState`
 * and re-defines the holder variable in the returned environment.
 */
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
