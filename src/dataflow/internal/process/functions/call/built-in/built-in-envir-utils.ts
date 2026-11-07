/** Shared utilities for built-in functions that interact with tracked R environments. */
import type { DataflowProcessorInformation } from '../../../../../processor';
import { RValue } from '../../../../../eval/values/r-value';
import type { DataflowInformation } from '../../../../../info';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall, EmptyArgument  } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { hasEnvState, ReferenceType } from '../../../../../environments/identifier';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
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
import type { DataflowGraph } from '../../../../../graph/graph';
import { DfgVertex, type DataflowGraphVertexFunctionDefinition } from '../../../../../graph/vertex';
import { Dataflow } from '../../../../../graph/df-helper';
import { ClosureFrames } from '../../../../../graph/closure-frames';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { toUnnamedArgument } from '../argument/make-argument';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { MatchArgs } from '../../../../../graph/match-args';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { FnSig } from '../../../../../environments/built-in-props';

function stackKindOf(envState: REnvironmentInformation): StackEnv | undefined {
	return envState.current.globalEnv === true ? 'global' : envState.current.builtInEnv === true ? 'base' : undefined;
}

/** The real stack environments a resolution can name, as opposed to a tracked custom env. */
export type StackEnv = 'global' | 'base';

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:   DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:      NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation };
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId: NodeId;
	/** which real stack env this resolves to, absent for a tracked custom env; only `'global'` reaches the real frame chain */
	readonly stack?:      StackEnv;
}


function resolveDefsToEnvirResolution<OtherInfo>(
	defs:   readonly IdentifierDefinition[] | undefined,
	nodeId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirArgRouting<OtherInfo> {
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
		return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, stack: stackKindOf(envState) };
	}
	if(!inDefs.every(hasEnvState)) {
		return undefined;
	}
	const stack = stackKindOf(inDefs[0].envState);
	if(inDefs.some(d => stackKindOf(d.envState) !== stack)) {
		return 'ambiguous';
	}
	let mergedEnvState = inDefs[0].envState;
	for(let i = 1; i < inDefs.length; i++) {
		for(const [, varDefs] of (inDefs[i].envState).current.memory) {
			for(const varDef of varDefs) {
				const named = varDef as InGraphIdentifierDefinition & { name: Identifier };
				if(named.name !== undefined) {
					mergedEnvState = REnvironment.define(named, false, mergedEnvState);
				}
			}
		}
	}
	const envDef: NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation } = {
		...(inDefs[0] as NamedInGraphIdentifierDefinition),
		envState: mergedEnvState
	};
	return {
		envirData:   { ...data, environment: mergedEnvState },
		envDef,
		envirNodeId: nodeId,
		stack
	};
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
	const piped = pipedCall(node, data);
	return NodeValue.singleStringOf(piped ?? node, data);
}

/** The `returnsEnvState` of the first reaching definition that carries one, else `undefined`. */
export function findReturnsEnvState(defs: readonly IdentifierDefinition[] | undefined): REnvironmentInformation | undefined {
	return defs?.find((d): d is InGraphIdentifierDefinition => (d as InGraphIdentifierDefinition).returnsEnvState !== undefined)?.returnsEnvState;
}

/**
 * The environment to route into, if flowR can pin one down; `'ambiguous'` when the argument names a value whose
 * identity is out of reach at this point (e.g. a function parameter), so routing anywhere would be unsound.
 */
export type EnvirArgRouting<OtherInfo> = EnvirResolution<OtherInfo> | 'ambiguous' | undefined;

/** the environment `routing` pinned down, dropping the ambiguous marker. */
export function envirOf<OtherInfo>(routing: EnvirArgRouting<OtherInfo>): EnvirResolution<OtherInfo> | undefined {
	return routing === 'ambiguous' ? undefined : routing;
}

/** Resolves a single already-found argument (e.g. from {@link RFunctionCall.matchArgsToParams}) to an {@link EnvirArgRouting}. */
export function resolveArgToEnvirOrAmbiguous<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirArgRouting<OtherInfo> {
	if(RArgument.isEmpty(arg)) {
		return undefined;
	}
	const node = RArgument.valueOf(arg);
	// `.GlobalEnv`/`.BaseEnv` or a `globalenv()`/`baseenv()`/`emptyenv()` call resolves to the corresponding stack env
	const stackEnv = resolveNodeToStackEnv(node, data);
	if(stackEnv !== undefined && node !== undefined) {
		return stackEnvirResolution(stackEnv, node.info.id, node.lexeme ?? '', data);
	}
	if(!RSymbol.is(node)) {
		return closureFrameResolution(node, data);
	}
	const defs = Resolve.byNameAndType(node.content, data.environment, ReferenceType.Variable);
	if(!data.ctx.config.solver.trackEnvironments) {
		return resolveDefsToEnvirResolution(defs, node.info.id, data);
	} else if(defs === undefined && data.environment.level > 0) {
		return freeEnvirResolution(node.content, node.info.id, data);
	}
	/* an environment we do not track */
	return resolveDefsToEnvirResolution(defs, node.info.id, data) ?? (defs === undefined ? undefined : 'ambiguous');
}

/**
 * `environment(fn)` names the frame the closure `fn` holds, tracked as the environment state of the variable holding
 * the closure: what is written into the frame is read by the closure once it is called (see {@link linkClosureFrameReads}).
 */
export function closureFrameResolution<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	const holder = closureFrameHolder(node, data);
	if(holder === undefined) {
		return undefined;
	}
	const envDef = { ...holder.def, envState: holder.def.envState ?? REnvironment.pushLocal(data.environment), envId: holder.def.envId ?? holder.def.nodeId, closureFrame: true } as const;
	return { envirData: { ...data, environment: envDef.envState }, envDef, envirNodeId: holder.call };
}

/** The single variable holding the closure `fn` of an `environment(fn)` call. */
function closureFrameHolder<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): { readonly def: NamedInGraphIdentifierDefinition, readonly call: NodeId } | undefined {
	if(!RFunctionCall.isNamed(node, 'environment') || node.arguments.length !== 1 || !Resolve.isBuiltIn(node.functionName.content, data.environment, ReferenceType.Function)) {
		return undefined;
	}
	const fn = RArgument.valueOf(node.arguments[0]);
	const defs = RSymbol.is(fn) ? Resolve.byName(fn.content, data.environment) : undefined;
	const def = defs?.length === 1 ? defs[0] as InGraphIdentifierDefinition : undefined;
	return fn === undefined || def?.name === undefined || NodeId.isBuiltIn(def.definedAt) ? undefined : { def: def as NamedInGraphIdentifierDefinition, call: node.info.id };
}

/**
 * A call of a closure whose frame was written (see {@link closureFrameResolution}) reads those writes wherever its
 * body reads a name it does not bind itself.
 */
export function linkClosureFrameReads(call: NodeId, called: DataflowGraphVertexFunctionDefinition, environment: REnvironmentInformation, graph: DataflowGraph): void {
	const vertex = graph.getVertex(call);
	const name = DfgVertex.isFunctionCall(vertex) ? vertex.name : undefined;
	if(name === undefined || !Resolve.byName(name, environment)?.some(d => (d as InGraphIdentifierDefinition).closureFrame === true)) {
		return;
	}
	called.framed = true;
	const body = new Set(called.subflow.graph);
	for(const id of body) {
		const nested = graph.getVertex(id);
		if(DfgVertex.isFunctionDefinition(nested)) {
			nested.subflow.graph.forEach(inner => body.add(inner));
		}
	}
	const idMap = graph.idMap;
	for(const id of body) {
		const read = idMap?.get(id);
		if(!DfgVertex.isUse(graph.getVertex(id)) || !RSymbol.is(read) || Dataflow.targetsOf(graph, id, EdgeType.Reads).some(t => body.has(t))) {
			continue;
		}
		const written = ClosureFrames.writesOf(name, environment, Identifier.getName(read.content));
		/* the write as well, `environment(g)$v <- 5` defines `v` at the value it writes */
		for(const target of [...written.ids, ...written.writers]) {
			graph.addEdge(id, target, EdgeType.Reads);
		}
	}
}

/**
 * A free variable of a function body names an environment bound only once the function is called: what the body
 * writes into it escapes the function like a `<<-` would, and the call adds it to the environment the name holds there.
 */
function freeEnvirResolution<OtherInfo>(
	name:   Identifier,
	nodeId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> {
	const envState = REnvironment.pushLocal(data.environment);
	const envDef = { name, nodeId, type: ReferenceType.Variable, definedAt: nodeId, cds: data.cds, envState, envWrites: true } as const;
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId };
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
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, stack: envState.current.globalEnv === true ? 'global' : 'base' };
}

/**
 * The slots `envir` falls back to (`envir = as.environment(pos)`), so an environment handed to one of them is the
 * target as well. They are tried after the envir formal itself.
 */
export const EnvirPositionFormals: readonly string[] = ['pos', 'where'];

function envirArgOf<OtherInfo>(
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	bound:  BoundFormals<OtherInfo> | undefined,
	formal: string
): PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined {
	if(bound !== undefined) {
		return bound.get(formal);
	}
	for(const arg of args) {
		if(arg !== EmptyArgument && arg.name !== undefined && findByPrefixIfUnique(arg.name.content, [formal]) === formal) {
			return arg;
		}
	}
	return undefined;
}

type BoundFormals<OtherInfo> = ReadonlyMap<string, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>>;

function bindFormals<OtherInfo>(
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	sig:  FnSig | undefined
): BoundFormals<OtherInfo> | undefined {
	return sig === undefined ? undefined : MatchArgs.toNames(args, FnSig.layout(sig).names);
}

/** Resolves the argument bound to `formal` (default `'envir'`) to an {@link EnvirArgRouting}. */
export function resolveEnvirArgOrAmbiguous<OtherInfo>(
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	sig:    FnSig | undefined,
	formal = 'envir'
): EnvirArgRouting<OtherInfo> {
	const arg = envirArgOf(args, bindFormals(args, sig), formal);
	return arg === undefined ? undefined : resolveArgToEnvirOrAmbiguous(arg, data);
}

/**
 * Whether the call supplies an argument for any of `formals` at all, however it resolves. A `pos`/`where` that is
 * not an environment names a position on R's search path (`envir = as.environment(pos)`), which flowR does not
 * model: `assign("x", 2, 1)` writes the global environment, not the calling scope.
 */
export function suppliesArg<OtherInfo>(
	args:    readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	sig:     FnSig | undefined,
	formals: readonly string[]
): boolean {
	const bound = bindFormals(args, sig);
	return formals.some(formal => envirArgOf(args, bound, formal) !== undefined);
}

function globalPositionOf<OtherInfo>(
	arg:  PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): EnvirResolution<OtherInfo> | undefined {
	const node = RArgument.valueOf(arg);
	const value = node === undefined ? undefined : NodeValue.soleOf(node.info.id, data);
	if(node === undefined || value === undefined || RValue.numberOf(value) !== 1) {
		return undefined;
	}
	return stackEnvirResolution({ current: REnvironment.findGlobal(data.environment.current), level: 0 }, node.info.id, node.lexeme ?? '', data);
}

/** The environment the argument `arg` given for `formal` names, where a position formal may name the global environment by its number. */
export function resolveEnvirOrPosition<OtherInfo>(
	arg:    PotentiallyEmptyRArgument<OtherInfo & ParentInformation>,
	formal: string,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>
): EnvirResolution<OtherInfo> | undefined {
	return envirOf(resolveArgToEnvirOrAmbiguous(arg, data)) ?? (EnvirPositionFormals.includes(formal) ? globalPositionOf(arg, data) : undefined);
}

/** The first of `formals` whose argument resolves to a tracked environment; ambiguity is left to the caller. */
export function resolveFirstEnvirArg<OtherInfo>(
	args:    readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data:    DataflowProcessorInformation<OtherInfo & ParentInformation>,
	sig:     FnSig | undefined,
	formals: readonly string[]
): EnvirResolution<OtherInfo> | undefined {
	const bound = bindFormals(args, sig);
	for(const formal of formals) {
		const arg = envirArgOf(args, bound, formal);
		if(arg === undefined) {
			continue;
		}
		const resolution = resolveEnvirOrPosition(arg, formal, data);
		if(resolution !== undefined) {
			return resolution;
		}
	}
	return undefined;
}

/**
 * Marks `result` as an unknown side effect when the envir argument names a value that cannot be pinned down
 * (e.g. a parameter), so routing the writes anywhere would be a guess; reports whether it did.
 */
export function unknownIfAmbiguous<OtherInfo>(
	routing: EnvirArgRouting<OtherInfo>,
	result:  DataflowInformation,
	rootId:  NodeId
): boolean {
	if(routing !== 'ambiguous') {
		return false;
	}
	handleUnknownSideEffect(result.graph, result.environment, rootId);
	return true;
}

/** Resolves a symbol by name to an {@link EnvirResolution} when it holds a tracked environment. */
export function resolveSymbolToEnvir<OtherInfo>(
	symbolName: Identifier,
	nodeId:     NodeId,
	data:       DataflowProcessorInformation<OtherInfo & ParentInformation>,
): EnvirResolution<OtherInfo> | undefined {
	return envirOf(resolveDefsToEnvirResolution(Resolve.byNameAndType(symbolName, data.environment, ReferenceType.Variable), nodeId, data));
}

function writtenDefinitionsOf(result: DataflowInformation, definedAt?: NodeId): readonly NamedInGraphIdentifierDefinition[] {
	return result.out.filter(
		(d): d is NamedInGraphIdentifierDefinition =>
			d.name !== undefined && 'definedAt' in d &&
			(definedAt === undefined || d.definedAt === definedAt)
	);
}

function holdersOf(
	environment: REnvironmentInformation,
	envDef:      NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation }
): readonly (NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation })[] {
	const holders = [envDef];
	let env: Environment | undefined = environment.current;
	while(env !== undefined && !env.builtInEnv) {
		for(const defs of env.memory.values()) {
			for(const def of defs as readonly InGraphIdentifierDefinition[]) {
				/* a copy (`g <- e`) holds the same environment object, even once one of them saw a write */
				if((def.envState === envDef.envState || (def.envId !== undefined && def.envId === envDef.envId)) && def.name !== undefined && def.nodeId !== envDef.nodeId) {
					holders.push(def as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation });
				}
			}
		}
		if(env.globalEnv) {
			break;
		}
		env = env.parent;
	}
	return holders;
}

function routeWrittenToCustomEnv(
	result:    DataflowInformation,
	envDef:    NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation },
	newDefAt:  NodeId,
	definedAt?: NodeId
): DataflowInformation {
	const written = writtenDefinitionsOf(result, definedAt);

	let newEnvState = envDef.envState;
	/* only a binding the write made here moves into the environment, `local(y <- 2, envir = e)` leaves the caller's `y` alone */
	const namesToRemove = written.filter(w => result.environment.current.lookup(Identifier.getName(w.name))?.some(d => d.nodeId === w.nodeId)).map(w => ({ name: w.name }));
	for(const w of written) {
		newEnvState = REnvironment.define(w, false, newEnvState);
	}

	const stripped = { current: result.environment.current.removeAll(namesToRemove), level: result.environment.level };
	return { ...result, environment: rebindHolders(stripped, envDef, newEnvState, newDefAt) };
}

/**
 * The calls that look up bindings in an environment they are given, or write into it, see {@link readEnvironmentContents}.
 * Any other call gets the environment as a whole.
 */
export const EnvironmentLookups: ReadonlySet<string> = new Set([
	BuiltInProcName.Access, BuiltInProcName.Assignment, BuiltInProcName.Attach, BuiltInProcName.EnvContents, BuiltInProcName.Get,
	BuiltInProcName.Local, BuiltInProcName.NewEnv, BuiltInProcName.Replacement, BuiltInProcName.Rm, BuiltInProcName.With
]);

/**
 * An environment is changed in place, so a call given a variable holding a tracked environment reads everything
 * written into the environment so far, unless the call only looks up bindings in it (see {@link EnvironmentLookups}).
 */
export function readEnvironmentContents(graph: DataflowGraph, call: NodeId, holder: IdentifierDefinition): void {
	const envState = (holder as InGraphIdentifierDefinition).envState;
	/* a stack env or the frame of a function (`environment()`) holds variables the scoping links already */
	if(envState === undefined || stackKindOf(envState) !== undefined || envState.current.closure !== undefined || (holder as InGraphIdentifierDefinition).closureFrame === true) {
		return;
	}
	for(const fields of envState.current.memory.values()) {
		for(const field of fields) {
			if(!NodeId.isBuiltIn(field.definedAt)) {
				graph.addEdge(call, field.nodeId, EdgeType.Reads);
				graph.addEdge(call, field.definedAt, EdgeType.Reads);
			}
		}
	}
}

/** Binds every variable holding the environment of `envDef` to its new state, where that variable is bound. */
export function rebindHolders(environment: REnvironmentInformation, envDef: NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation }, envState: REnvironmentInformation, definedAt?: NodeId): REnvironmentInformation {
	for(const holder of holdersOf(environment, envDef)) {
		/* a holder bound in an enclosing frame is updated there, so the write escapes the function like a `<<-` */
		environment = REnvironment.define({ ...holder, definedAt: definedAt ?? holder.definedAt, envState, ...envDef.closureFrame ? { closureFrame: true } as const : {} }, environment.current.lookup(Identifier.getName(holder.name)) === undefined, environment);
	}
	return environment;
}

/**
 * Adds the `writes` a called function made into environments its free variables name (see
 * {@link InGraphIdentifierDefinition#envWrites}) to the environments the caller binds these names to; a name still free
 * in a calling function body stays with the writes, so its own calls add them. Returns the callee's and the caller's
 * environment to merge.
 */
export function addEnvironmentWrites(writes: readonly IdentifierDefinition[], callee: REnvironmentInformation, caller: REnvironmentInformation, call: NodeId, graph: DataflowGraph): [REnvironmentInformation, REnvironmentInformation] {
	for(const written of writes) {
		if(!hasEnvState(written) || written.name === undefined) {
			continue;
		}
		const bound = Resolve.byNameAndType(written.name, caller, ReferenceType.Variable);
		if(bound === undefined && caller.level > 0) {
			continue;
		}
		callee = { current: callee.current.removeAll([{ name: written.name }]), level: callee.level };
		for(const holder of bound ?? []) {
			if(!hasEnvState(holder) || holder.name === undefined) {
				handleUnknownSideEffect(graph, caller, call);
				continue;
			}
			let envState = holder.envState;
			for(const fields of written.envState.current.memory.values()) {
				for(const field of fields as readonly InGraphIdentifierDefinition[]) {
					if(field.name !== undefined) {
						envState = REnvironment.define(field as NamedInGraphIdentifierDefinition, false, envState);
						/* the call made the write */
						graph.addEdge(field.nodeId, call, EdgeType.SideEffectOnCall);
					}
				}
			}
			caller = rebindHolders(caller, holder as NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation }, envState, call);
		}
	}
	return [callee, caller];
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
		environment = REnvironment.define(w, true, environment);
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
	if(resolution.stack !== undefined) {
		routed = resolution.stack === 'global' ? routeWrittenToStackEnv(result, callerEnvironment, rootId, definedAt) : result;
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
