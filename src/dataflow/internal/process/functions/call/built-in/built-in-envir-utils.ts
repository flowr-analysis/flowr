/**
 * Shared utilities for built-in functions that accept an `envir`-like argument
 * (e.g. `assign`, `get`, `local`, `with`).  The two key operations are:
 *
 * 1. {@link resolveEnvirArg} — find the named (or positional) argument and, when it holds
 *    a tracked {@link InGraphIdentifierDefinition#envState}, return the context needed to
 *    perform lookups/writes inside that environment.
 *
 * 2. {@link routeWrittenToCustomEnv} — after processing an expression that writes
 *    into a custom environment, move the written definitions from the caller's scope
 *    into the holder variable's `envState`.
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
import type { Identifier, InGraphIdentifierDefinition, NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import type { REnvironmentInformation } from '../../../../../environments/environment';

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:   DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:      NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId: NodeId;
}

function resolveDefsToEnvirResolution<OtherInfo>(
	defs:    readonly InGraphIdentifierDefinition[],
	nodeId:  NodeId,
	data:    DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	if(defs.length === 0) {
		return undefined;
	}
	if(defs.length === 1) {
		const envState = defs[0].envState;
		if(!envState) {
			return undefined;
		}
		const envDef = defs[0] as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
		return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId };
	}
	/* multiple defs (e.g. after if-else): require all to have envState and merge */
	if(!defs.every(d => d.envState !== undefined)) {
		return undefined;
	}
	let mergedEnvState = defs[0].envState as REnvironmentInformation;
	for(let i = 1; i < defs.length; i++) {
		const otherEnvState = defs[i].envState as REnvironmentInformation;
		for(const [, varDefs] of otherEnvState.current.memory) {
			for(const varDef of varDefs) {
				const named = varDef as InGraphIdentifierDefinition & { name: Identifier };
				if(named.name !== undefined) {
					mergedEnvState = define(named, false, mergedEnvState);
				}
			}
		}
	}
	const envDef: NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation } = {
		...(defs[0] as NamedInGraphIdentifierDefinition),
		envState: mergedEnvState
	};
	return { envirData: { ...data, environment: mergedEnvState }, envDef, envirNodeId: nodeId };
}

/**
 * Scans `args` for an argument named `argName` (default `'envir'`), or — when
 * `positionalFallbackIndex` is given — for the arg at that positional index when
 * no named match is found.  When the resolved argument is a symbol that resolves
 * to a variable with a tracked {@link InGraphIdentifierDefinition#envState},
 * returns the resolved context; otherwise returns `undefined`.
 *
 * Named matches always take priority over the positional fallback.
 */
export function resolveEnvirArg<OtherInfo>(
	args:                   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:                   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	argName                 = 'envir',
	positionalFallbackIndex?: number
): EnvirResolution<OtherInfo> | undefined {
	/* first pass: named arg takes priority */
	for(const arg of args) {
		if(arg === EmptyArgument || arg.name?.content !== argName) {
			continue;
		}
		const node = unpackArg(arg);
		if(node?.type !== RType.Symbol) {
			return undefined;
		}
		const defs = resolveByName(node.content, data.environment, ReferenceType.Variable);
		return defs ? resolveDefsToEnvirResolution(defs as InGraphIdentifierDefinition[], node.info.id, data) : undefined;
	}

	/* second pass: positional fallback (only when no named match existed) */
	if(positionalFallbackIndex !== undefined) {
		let positionalCount = 0;
		for(const arg of args) {
			if(arg === EmptyArgument || arg.name !== undefined) {
				continue;
			}
			if(positionalCount === positionalFallbackIndex) {
				const node = unpackArg(arg);
				if(node?.type !== RType.Symbol) {
					return undefined;
				}
				const defs = resolveByName(node.content, data.environment, ReferenceType.Variable);
				return defs ? resolveDefsToEnvirResolution(defs as InGraphIdentifierDefinition[], node.info.id, data) : undefined;
			}
			positionalCount++;
		}
	}
	return undefined;
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
			(definedAt === undefined || (d as InGraphIdentifierDefinition).definedAt === definedAt)
	);

	let newEnvState = envDef.envState;
	const namesToRemove = written.map(w => ({ name: w.name }));
	for(const w of written) {
		newEnvState = define(w, false, newEnvState);
	}

	const newCurrent = result.environment.current.removeAll(namesToRemove);
	const updatedEnvDef: NamedInGraphIdentifierDefinition = {
		...envDef,
		definedAt: newDefAt,
		envState:  newEnvState
	};
	const newEnvironment = define(updatedEnvDef, false, {
		current: newCurrent,
		level:   result.environment.level
	});
	return { ...result, environment: newEnvironment };
}
