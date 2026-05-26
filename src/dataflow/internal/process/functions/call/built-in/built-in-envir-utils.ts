/**
 * Shared utilities for built-in functions that accept an `envir`-like argument
 * (e.g. `assign`, `get`, `local`).  The two key operations are:
 *
 * 1. {@link resolveEnvirArg} — find the named argument and, when it holds a tracked
 *    {@link InGraphIdentifierDefinition#envState}, return the context needed to
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
import type { InGraphIdentifierDefinition, NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
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

/**
 * Scans `args` for an argument named `argName` (default `'envir'`).  When found and
 * the argument is a symbol that resolves to a variable with a tracked
 * {@link InGraphIdentifierDefinition#envState}, returns the resolved context;
 * otherwise returns `undefined` (caller should fall through to the default path).
 */
export function resolveEnvirArg<OtherInfo>(
	args:    readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:    DataflowProcessorInformation<OtherInfo & ParentInformation>,
	argName = 'envir'
): EnvirResolution<OtherInfo> | undefined {
	for(const arg of args) {
		if(arg === EmptyArgument || arg.name?.content !== argName) {
			continue;
		}
		const node = unpackArg(arg);
		if(node?.type !== RType.Symbol) {
			return undefined;
		}
		const defs = resolveByName(node.content, data.environment, ReferenceType.Variable);
		if(defs?.length !== 1) {
			return undefined;
		}
		const envDef = defs[0] as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
		if(!envDef.envState) {
			return undefined;
		}
		return { envirData: { ...data, environment: envDef.envState }, envDef, envirNodeId: node.info.id };
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
