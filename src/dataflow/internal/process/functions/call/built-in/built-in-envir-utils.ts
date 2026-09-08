/** Shared utilities for built-in functions that interact with tracked R environments. */
import type { DataflowProcessorInformation } from '../../../../../processor';
import { RValue } from '../../../../../eval/values/r-value';
import type { DataflowInformation } from '../../../../../info';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall, EmptyArgument  } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { unpackArg } from '../argument/unpack-argument';
import type { IdentifierDefinition, InGraphIdentifierDefinition, NamedInGraphIdentifierDefinition, Identifier } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import { define } from '../../../../../environments/define';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { DefaultAttachPosition, REnvironment } from '../../../../../environments/environment';
import { findByPrefixIfUnique } from '../../../../../../util/prefix';
import { resolveNodeToStackEnv } from './built-in-stack-env';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { dataflowLogger } from '../../../../../logger';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RPipe } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { EdgeType } from '../../../../../graph/edge';
import { toUnnamedArgument } from '../argument/make-argument';

/** A tracked env is a real stack environment (not a private custom env) when its current layer is the global or the built-in/base env. */
function isStackEnvState(envState: REnvironmentInformation): boolean {
	return envState.current.globalEnv === true || envState.current.builtInEnv === true;
}

/** `args` with the piped value spliced in as an implicit first arg, when the pipe targets this `rootId` */
export function effectiveArgs<OtherInfo>(
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] {
	return data.pipedArgument?.rootId === rootId ? [toUnnamedArgument(data.pipedArgument.node, data.completeAst.idMap), ...args] : args;
}

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:    DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:       NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId:  NodeId;
	/** true when this resolves to a real stack env (globalenv/baseenv), not a tracked custom env */
	readonly isStackEnv?:  boolean;
	/** the global half of `isStackEnv`, which is the half that reaches the real frame chain */
	readonly isGlobalEnv?: boolean;
}

/** Maps a list of identifier definitions (from {@link Resolve.byNameAndType}) to an {@link EnvirResolution}, merging the envStates of multiple reaching definitions. */
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
		return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, isStackEnv: isStackEnvState(envState), isGlobalEnv: envState.current.globalEnv === true };
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
 * The formal parameter names of the qualified call `id` (a `pkg::fn` {@link Identifier}) from the signature
 * database (excluding `...`), or `fallback` when the database is disabled or does not carry the function. Lets a
 * built-in argument matcher use R's real signature (via {@link ReadOnlyFlowrAnalyzerDependenciesContext#signatureOf})
 * instead of a hardcoded formal list, while staying correct -- and graph-invariant -- when no signature is available.
 */
export function signatureParamNames<OtherInfo>(
	data:     DataflowProcessorInformation<OtherInfo & ParentInformation>,
	id:       Identifier,
	fallback: readonly string[]
): readonly string[] {
	const names = data.ctx.deps.signatures().parametersOf(id) ?? [];
	return names.length > 0 ? names : fallback;
}

/** desugars `lhs |> rhs(...)` one level to `rhs(lhs, ...)`, for literal-shape inspection */
export function pipedCall<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RFunctionCall<OtherInfo & ParentInformation> & { named: true } | undefined {
	if(!RPipe.is(node) || !RFunctionCall.isNamed(node.rhs)) {
		return undefined;
	}
	const lhsArg = RArgument.is(node.lhs) ? node.lhs : toUnnamedArgument(node.lhs, data.completeAst.idMap);
	return { ...node.rhs, arguments: [lhsArg, ...node.rhs.arguments] };
}

/**
 * The constant string a name-position node denotes at construction time (string literal, aliased variable, or
 * a paste-like join of such); `undefined` if any part is dynamic or the fold is user-shadowed. Unwraps one
 * leading pipe (the value domain does not desugar those) and otherwise defers entirely to it -- the shadow
 * check, the paste-like fold and its numeric/logical coercion all live there, in {@link resolveAsStringFn}.
 */
export function resolveConstantString<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): string | undefined {
	/* pass the (possibly desugared) node itself, not its id: the desugared call is synthesized and never makes
	 * it into the id map, so looking it back up by id would hand back the original, un-desugared call */
	const piped = pipedCall(node, data);
	return NodeValue.singleStringOf(piped ?? node, data);
}

/** The `returnsEnvState` of the first reaching definition that carries one, else `undefined`. */
export function findReturnsEnvState(defs: readonly IdentifierDefinition[] | undefined): REnvironmentInformation | undefined {
	return defs?.find((d): d is InGraphIdentifierDefinition => (d as InGraphIdentifierDefinition).returnsEnvState !== undefined)?.returnsEnvState;
}

/** Result of resolving an envir-like argument that also reports when routing anywhere would be a guess. */
export interface EnvirArgRouting<OtherInfo> {
	/** the environment to route into, if flowR can pin one down */
	readonly resolution: EnvirResolution<OtherInfo> | undefined
	/**
	 * the argument names a value whose identity is out of reach at this point (e.g. a function parameter), so
	 * `resolution` being `undefined` does not mean it is not an environment -- routing anywhere would be unsound
	 */
	readonly ambiguous:  boolean
}

/** a reaching definition that carries no envState only because we cannot see what it will be bound to, not because it is known to not be an environment */
function isAmbiguousEnvirDef(d: InGraphIdentifierDefinition): boolean {
	return d.type === ReferenceType.Parameter && d.envState === undefined;
}

/** Resolves a single already-found argument (e.g. from {@link RFunctionCall.matchArgsToParams}) to an {@link EnvirArgRouting}. */
export function resolveArgToEnvirOrAmbiguous<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirArgRouting<OtherInfo> {
	if(RArgument.isEmpty(arg)) {
		return { resolution: undefined, ambiguous: false };
	}
	const node = unpackArg(arg);
	// `.GlobalEnv`/`.BaseEnv` or a `globalenv()`/`baseenv()`/`emptyenv()` call resolves to the corresponding stack env
	const stackEnv = resolveNodeToStackEnv(node, data);
	if(stackEnv !== undefined && node !== undefined) {
		return { resolution: stackEnvirResolution(stackEnv, node.info.id, node.lexeme ?? '', data), ambiguous: false };
	}
	if(!RSymbol.is(node)) {
		return { resolution: undefined, ambiguous: false };
	}
	const defs = Resolve.byNameAndType(node.content, data.environment, ReferenceType.Variable);
	return {
		resolution: resolveDefsToEnvirResolution(defs, node.info.id, data),
		ambiguous:  (defs as readonly InGraphIdentifierDefinition[] | undefined)?.some(isAmbiguousEnvirDef) ?? false
	};
}

/** Resolves a single already-found argument (e.g. from {@link RFunctionCall.matchArgsToParams}) to an {@link EnvirResolution} when it is a symbol holding a tracked envState. */
export function resolveArgToEnvir<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	return resolveArgToEnvirOrAmbiguous(arg, data).resolution;
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
		name:      lexeme,
		nodeId,
		type:      ReferenceType.Variable,
		definedAt: nodeId,
		envState,
	} as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, isStackEnv: true, isGlobalEnv: envState.current.globalEnv === true };
}

/** The `argName` argument (matched with pmatch) or, when unnamed, the argument at `position`; `undefined` when neither is present. */
function findEnvirArgNode<OtherInfo>(
	args:      readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	argName:   string,
	position?: number
): PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined {
	for(const arg of args) {
		if(arg !== EmptyArgument && arg.name !== undefined && findByPrefixIfUnique(arg.name.content, [argName]) === argName) {
			return arg;
		}
	}
	const positional = position === undefined ? undefined : args[position];
	return positional !== undefined && !RArgument.isNamed(positional) ? positional : undefined;
}

/** Resolves the `argName` argument (default `'envir'`), named with pmatch, to an {@link EnvirArgRouting}. */
export function resolveEnvirArgOrAmbiguous<OtherInfo>(
	args:    readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:    DataflowProcessorInformation<OtherInfo & ParentInformation>,
	argName  = 'envir',
	position?: number
): EnvirArgRouting<OtherInfo> {
	const arg = findEnvirArgNode(args, argName, position);
	return arg === undefined ? { resolution: undefined, ambiguous: false } : resolveArgToEnvirOrAmbiguous(arg, data);
}

/** Resolves the `argName` argument (default `'envir'`), named with pmatch, to an {@link EnvirResolution}. */
export function resolveEnvirArg<OtherInfo>(
	args:    readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:    DataflowProcessorInformation<OtherInfo & ParentInformation>,
	argName  = 'envir',
	position?: number
): EnvirResolution<OtherInfo> | undefined {
	return resolveEnvirArgOrAmbiguous(args, data, argName, position).resolution;
}

/** Resolves a symbol by name to an {@link EnvirResolution} when it holds a tracked environment. */
export function resolveSymbolToEnvir<OtherInfo>(
	symbolName: Identifier,
	nodeId:     NodeId,
	data:       DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	return resolveDefsToEnvirResolution(Resolve.byNameAndType(symbolName, data.environment, ReferenceType.Variable), nodeId, data);
}

/** the writes to route into the resolved envir */
function writtenDefinitionsOf(result: DataflowInformation, definedAt?: NodeId): readonly NamedInGraphIdentifierDefinition[] {
	return result.out.filter(
		(d): d is NamedInGraphIdentifierDefinition =>
			d.name !== undefined && 'definedAt' in d &&
			(definedAt === undefined || d.definedAt === definedAt)
	);
}

/** Moves definitions written into a custom environment from the caller's scope into `envDef`'s tracked `envState`, re-defining the holder variable. */
function routeWrittenToCustomEnv(
	result:    DataflowInformation,
	envDef:    NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation },
	newDefAt:  NodeId,
	definedAt?: NodeId
): DataflowInformation {
	const written = writtenDefinitionsOf(result, definedAt);

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

/**
 * Routes writes into a real stack env's frame chain, the same way `<<-` reaches an outer scope.
 * Each write also gets a `Reads` edge back to `rootId`, so slicing does not drop the call that made it.
 */
export function routeWrittenToStackEnv(
	result:    DataflowInformation,
	into:      REnvironmentInformation,
	rootId:    NodeId,
	definedAt?: NodeId
): DataflowInformation {
	const written = writtenDefinitionsOf(result, definedAt);
	let environment = into;
	for(const w of written) {
		environment = define(w, true, environment);
		result.graph.addEdge(w.nodeId, rootId, EdgeType.Reads);
	}
	return { ...result, environment };
}

/**
 * Routes writes under a resolved `envir=` to the real stack frame or a tracked custom env, and adds the
 * `Reads` edge from `rootId` to the envir argument.
 */
export function routeWrittenToEnvir<OtherInfo>(
	result:            DataflowInformation,
	resolution:        EnvirResolution<OtherInfo>,
	rootId:            NodeId,
	callerEnvironment: REnvironmentInformation,
	definedAt?:        NodeId
): DataflowInformation {
	let routed: DataflowInformation;
	if(resolution.isStackEnv) {
		/* only the global frame is ours to write: `baseenv()`/`emptyenv()` hand out the built-in environment,
		 * which is shared and never cloned, so defining into it would corrupt every later lookup (R errors on
		 * such a write anyway) */
		routed = resolution.isGlobalEnv ? routeWrittenToStackEnv(result, callerEnvironment, rootId, definedAt) : result;
	} else {
		routed = routeWrittenToCustomEnv(result, resolution.envDef, rootId, definedAt);
	}
	routed.graph.addEdge(rootId, resolution.envirNodeId, EdgeType.Reads);
	return routed;
}

/** A `search()` position must be an integer and may never displace the global environment (R rejects `pos = 1`). */
function clampAttachPosition(pos: number): number | undefined {
	return Number.isFinite(pos) ? Math.max(DefaultAttachPosition, Math.trunc(pos)) : undefined;
}

/**
 * The `search()` position the `pos` argument of a `library()` call requests, either given as a number or as the name of
 * an existing entry (`pos = "package:base"`). Returns `undefined` when there is no such argument, its value is unknown
 * or ambiguous, or it names an entry that is not on the search path; callers then attach at {@link DefaultAttachPosition}
 * (as R does, which warns in the last case).
 */
export function resolveAttachPosition<OtherInfo>(
	posId: NodeId | undefined,
	data:  DataflowProcessorInformation<OtherInfo & ParentInformation>
): number | undefined {
	if(posId === undefined) {
		return undefined;
	}
	const element = NodeValue.soleOf(posId, data);
	if(element === undefined) {
		return undefined;
	}
	const asNumber = RValue.numberOf(element);
	if(asNumber !== undefined) {
		return clampAttachPosition(asNumber);
	}
	const asString = RValue.stringOf(element);
	if(asString !== undefined) {
		const found = REnvironment.searchPosition(data.environment.current, asString);
		if(found === undefined) {
			dataflowLogger.warn(`search-path entry '${asString}' does not exist, attaching at the default position`);
			return undefined;
		}
		return clampAttachPosition(found);
	}
	return undefined;
}
