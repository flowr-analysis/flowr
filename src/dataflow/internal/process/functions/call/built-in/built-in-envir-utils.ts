/** Shared utilities for built-in functions that interact with tracked R environments. */
import type { DataflowProcessorInformation } from '../../../../../processor';
import { RValue } from '../../../../../eval/values/r-value';
import type { DataflowInformation } from '../../../../../info';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall, EmptyArgument  } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { type EnvHolderDefinition, type BrandedIdentifier, Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition, type NamedInGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { hasEnvState, ReferenceType } from '../../../../../environments/identifier';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import { DefaultAttachPosition, REnvironment } from '../../../../../environments/environment';
import { findByPrefixIfUnique } from '../../../../../../util/prefix';
import { isEnclosingFrame, resolveNodeToStackEnv } from './built-in-stack-env';
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
import { noteUnknownMethods } from './built-in-expression-list';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

function stackKindOf(envState: REnvironmentInformation): StackEnv | undefined {
	return envState.current.globalEnv === true ? 'global' : envState.current.builtInEnv === true ? 'base' : isEnclosingFrame(envState) ? 'enclosing' : undefined;
}

/** The real stack environments a resolution can name, as opposed to a tracked custom env: `'enclosing'` is the frame of a function around the current one, see {@link isEnclosingFrame}. */
export type StackEnv = 'global' | 'base' | 'enclosing';

/** Result type for a successful envir-argument resolution. */
export interface EnvirResolution<OtherInfo> {
	/** `data` with its `environment` replaced by the resolved `envState` for in-env lookups. */
	readonly envirData:   DataflowProcessorInformation<OtherInfo & ParentInformation>;
	/** The definition of the variable that holds the environment */
	readonly envDef:      EnvHolderDefinition;
	/** Node ID of the USE of the envir variable (e.g. the `e` in `envir=e`). */
	readonly envirNodeId: NodeId;
	/** which real stack env this resolves to, absent for a tracked custom env; `'global'` and `'enclosing'` reach the real frame chain */
	readonly stack?:      StackEnv;
}


function resolveDefsToEnvirResolution<OtherInfo>(defs: readonly IdentifierDefinition[] | undefined, nodeId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirArgRouting<OtherInfo> {
	if(!defs || defs.length === 0) {
		return undefined;
	}
	const inDefs = defs as readonly InGraphIdentifierDefinition[];
	if(!inDefs.every(hasEnvState)) {
		return undefined;
	}
	const stack = stackKindOf(inDefs[0].envState);
	if(inDefs.some(d => stackKindOf(d.envState) !== stack)) {
		return 'ambiguous';
	}
	/* the variable may hold any of them, so each binding of each joins the others */
	let mergedEnvState = inDefs[0].envState;
	for(let i = 1; i < inDefs.length; i++) {
		for(const [name, varDefs] of (inDefs[i].envState).current.memory) {
			for(const varDef of varDefs) {
				const named = varDef as NamedInGraphIdentifierDefinition;
				if(named.name !== undefined && !mergedEnvState.current.memory.get(name)?.some(d => d.nodeId === named.nodeId)) {
					mergedEnvState = REnvironment.define({ ...named, cds: named.cds ?? [] }, false, mergedEnvState);
				}
			}
		}
	}
	return { envirData: { ...data, environment: mergedEnvState }, envDef: { ...inDefs[0] as NamedInGraphIdentifierDefinition, envState: mergedEnvState }, envirNodeId: nodeId, stack };
}

/** The formal parameter names of the qualified call `id` (a `pkg::fn` {@link Identifier}) from the signature database (excluding `...`), or `fallback` when the database is disabled or does not carry the function. */
export function signatureParamNames<OtherInfo>(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, id: Identifier, fallback: readonly string[]): readonly string[] {
	const names = data.ctx.deps.signatures().parametersOf(id) ?? [];
	return names.length > 0 ? names : fallback;
}

/** desugars `lhs |> rhs(...)` one level to `rhs(lhs, ...)`, for literal-shape inspection */
export function pipedCall<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): RFunctionCall<OtherInfo & ParentInformation> & { named: true } | undefined {
	if(!RPipe.is(node) || !RFunctionCall.isNamed(node.rhs)) {
		return undefined;
	}
	const lhsArg = RArgument.is(node.lhs) ? node.lhs : toUnnamedArgument(node.lhs, data.completeAst.idMap);
	return { ...node.rhs, arguments: [lhsArg, ...node.rhs.arguments] };
}

/** The constant string a name-position node denotes at construction time (string literal, aliased variable, or a paste-like join of such); `undefined` if any part is dynamic or the fold is user-shadowed. */
export function resolveConstantString<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string | undefined {
	const piped = pipedCall(node, data);
	return NodeValue.singleStringOf(piped ?? node, data);
}

/** The `returnsEnvState` of the first reaching definition that carries one, else `undefined`. */
export function findReturnsEnvState(defs: readonly IdentifierDefinition[] | undefined): REnvironmentInformation | undefined {
	return defs?.find((d): d is InGraphIdentifierDefinition => (d as InGraphIdentifierDefinition).returnsEnvState !== undefined)?.returnsEnvState;
}

/** The environment to route into, if flowR can pin one down; `'ambiguous'` when the argument names a value whose identity is out of reach at this point (e.g. a function parameter), so routing anywhere would be unsound. */
export type EnvirArgRouting<OtherInfo> = EnvirResolution<OtherInfo> | 'ambiguous' | undefined;

/** the environment `routing` pinned down, dropping the ambiguous marker. */
export function envirOf<OtherInfo>(routing: EnvirArgRouting<OtherInfo>): EnvirResolution<OtherInfo> | undefined {
	return routing === 'ambiguous' ? undefined : routing;
}

/** Resolves a single already-found argument (e.g. from {@link RFunctionCall.matchArgsToParams}) to an {@link EnvirArgRouting}. */
export function resolveArgToEnvirOrAmbiguous<OtherInfo>(arg: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirArgRouting<OtherInfo> {
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

/** `environment(fn)` names the frame the closure `fn` holds, tracked as the environment state of the variable holding the closure: what is written into the frame is read by the closure once it is called (see {@link linkClosureFrameReads}). */
export function closureFrameResolution<OtherInfo>(node: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> | undefined {
	if(!RFunctionCall.isNamed(node, 'environment') || node.arguments.length !== 1 || !Resolve.isBuiltIn(node.functionName.content, data.environment, ReferenceType.Function)) {
		return undefined;
	}
	const fn = RArgument.valueOf(node.arguments[0]);
	const defs = RSymbol.is(fn) ? Resolve.byName(fn.content, data.environment) : undefined;
	const def = defs?.length === 1 ? defs[0] as NamedInGraphIdentifierDefinition : undefined;
	if(def?.name === undefined || NodeId.isBuiltIn(def.definedAt)) {
		return undefined;
	}
	/* a closure written out at the top holds the global frame, which `h <- function() NULL` binds it in */
	const global = REnvironment.findGlobal(data.environment.current);
	if(def.value !== undefined && def.value.length > 0 && def.value.every(v => RFunctionDefinition.is(data.completeAst.idMap.get(v))) && global.memory.get(Identifier.getName(def.name))?.some(d => d.nodeId === def.nodeId)) {
		return stackEnvirResolution({ current: global, level: 0 }, node.info.id, node.lexeme ?? '', data);
	}
	const envDef = { ...def, envState: def.envState ?? REnvironment.pushLocal(data.environment), envId: def.envId ?? def.nodeId, closureFrame: true } as const;
	return { envirData: { ...data, environment: envDef.envState }, envDef, envirNodeId: node.info.id };
}

/** A call of a closure whose frame was written (see {@link closureFrameResolution}) reads those writes wherever its body reads a name it does not bind itself. */
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
		/* what the body binds by `<<-` is the frame, which the write into it may replace, so only a local binding hides the frame */
		if(!DfgVertex.isUse(graph.getVertex(id)) || !RSymbol.is(read) || Dataflow.targetsOf(graph, id, EdgeType.Reads).some(t => body.has(t) && !Dataflow.definedBySuperAssignment(graph, t))) {
			continue;
		}
		const written = ClosureFrames.writesOf(name, environment, Identifier.getName(read.content), called.id, graph);
		/* the write as well, `environment(g)$v <- 5` defines `v` at the value it writes */
		for(const target of [...written.ids, ...written.writers]) {
			graph.addEdge(id, target, EdgeType.Reads);
		}
	}
}

/** A free variable of a function body names an environment bound only once the function is called: what the body writes into it escapes the function like a `<<-` would, and the call adds it to the environment the name holds there. */
function freeEnvirResolution<OtherInfo>(name: Identifier, nodeId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> {
	const envState = REnvironment.pushLocal(data.environment);
	const envDef = { name, nodeId, type: ReferenceType.Variable, definedAt: nodeId, cds: data.cds, envState, envWrites: true } as const;
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId };
}

/** Builds an {@link EnvirResolution} for an environment obtained directly (not via a holder variable), e.g. `globalenv()` / `.GlobalEnv`. */
function stackEnvirResolution<OtherInfo>(envState: REnvironmentInformation, nodeId: NodeId, lexeme: string, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> {
	// no holder variable: envDef is only a carrier for envState/nodeId
	const envDef = { name: lexeme, nodeId, type: ReferenceType.Variable, definedAt: nodeId, envState } as EnvHolderDefinition;
	return { envirData: { ...data, environment: envState }, envDef, envirNodeId: nodeId, stack: stackKindOf(envState) ?? 'base' };
}

/** The slots `envir` falls back to (`envir = as.environment(pos)`), so an environment handed to one of them is the target as well. */
export const EnvirPositionFormals: readonly BrandedIdentifier[] = ['pos', 'where'];

function envirArgOf<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], bound: BoundFormals<OtherInfo> | undefined, formal: BrandedIdentifier): PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined {
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

type BoundFormals<OtherInfo> = ReadonlyMap<BrandedIdentifier, PotentiallyEmptyRArgument<OtherInfo & ParentInformation>>;

function bindFormals<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], sig: FnSig | undefined): BoundFormals<OtherInfo> | undefined {
	return sig === undefined ? undefined : MatchArgs.toNames(args, FnSig.layout(sig).names);
}

/** Resolves the argument bound to `formal` (default `'envir'`) to an {@link EnvirArgRouting}. */
export function resolveEnvirArgOrAmbiguous<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>, sig: FnSig | undefined, formal = 'envir'): EnvirArgRouting<OtherInfo> {
	const arg = envirArgOf(args, bindFormals(args, sig), formal);
	return arg === undefined ? undefined : resolveArgToEnvirOrAmbiguous(arg, data);
}

/** Whether the call supplies an argument for any of `formals` at all, however it resolves. */
export function suppliesArg<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], sig: FnSig | undefined, formals: readonly BrandedIdentifier[]): boolean {
	const bound = bindFormals(args, sig);
	return formals.some(formal => envirArgOf(args, bound, formal) !== undefined);
}

function globalPositionOf<OtherInfo>(arg: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> | undefined {
	const node = RArgument.valueOf(arg);
	const value = node === undefined ? undefined : NodeValue.soleOf(node.info.id, data);
	if(node === undefined || value === undefined || RValue.numberOf(value) !== 1) {
		return undefined;
	}
	return stackEnvirResolution({ current: REnvironment.findGlobal(data.environment.current), level: 0 }, node.info.id, node.lexeme ?? '', data);
}

/** The environment the argument `arg` given for `formal` names, where a position formal may name the global environment by its number. */
export function resolveEnvirOrPosition<OtherInfo>(arg: PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, formal: BrandedIdentifier, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> | undefined {
	return envirOf(resolveArgToEnvirOrAmbiguous(arg, data)) ?? (EnvirPositionFormals.includes(formal) ? globalPositionOf(arg, data) : undefined);
}

/** The first of `formals` whose argument resolves to a tracked environment; ambiguity is left to the caller. */
export function resolveFirstEnvirArg<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>, sig: FnSig | undefined, formals: readonly BrandedIdentifier[]): EnvirResolution<OtherInfo> | undefined {
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

/** Marks `result` as an unknown side effect when the envir argument names a value that cannot be pinned down (e.g. a parameter), so routing the writes anywhere would be a guess (and what they bind may be any method); reports whether it did. */
export function unknownIfAmbiguous<OtherInfo>(routing: EnvirArgRouting<OtherInfo>, result: DataflowInformation, rootId: NodeId): boolean {
	if(routing !== 'ambiguous') {
		return false;
	}
	handleUnknownSideEffect(result.graph, result.environment, rootId);
	noteUnknownMethods(result.environment, rootId);
	return true;
}

/** Resolves a symbol by name to an {@link EnvirResolution} when it holds a tracked environment. */
export function resolveSymbolToEnvir<OtherInfo>(symbolName: Identifier, nodeId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): EnvirResolution<OtherInfo> | undefined {
	return envirOf(resolveDefsToEnvirResolution(Resolve.byNameAndType(symbolName, data.environment, ReferenceType.Variable) ?? enclosingFrameHolders(symbolName, data.environment), nodeId, data));
}

/** The definitions of the free variable `name` of a body holding the frame of a function around (`e <- parent.env(environment())` in it): the body sees the frames around it emptied, which stand in for them (see {@link Environment#superMemory}). */
function enclosingFrameHolders(name: Identifier, environment: REnvironmentInformation): readonly IdentifierDefinition[] | undefined {
	const defs = environment.level > 0 ? environment.current.lookupLexically(Identifier.getName(name)) : undefined;
	return defs?.length && defs.every(d => hasEnvState(d) && isEnclosingFrame(d.envState)) ? defs : undefined;
}

function writtenDefinitionsOf(result: DataflowInformation, definedAt?: NodeId): readonly NamedInGraphIdentifierDefinition[] {
	return result.out.filter(
		(d): d is NamedInGraphIdentifierDefinition =>
			d.name !== undefined && 'definedAt' in d &&
			(definedAt === undefined || d.definedAt === definedAt)
	);
}

function holdersOf(environment: REnvironmentInformation, envDef: EnvHolderDefinition): readonly (EnvHolderDefinition)[] {
	const holders = [envDef];
	for(let env: Environment | undefined = environment.current; env !== undefined && !env.builtInEnv; env = env.globalEnv ? undefined : env.parent) {
		for(const defs of env.memory.values()) {
			for(const def of defs as readonly InGraphIdentifierDefinition[]) {
				/* a copy (`g <- e`) holds the same environment object, even once one of them saw a write, as does the variable it was copied from */
				if((def.envState === envDef.envState || (def.envId !== undefined && def.envId === envDef.envId) || def.nodeId === envDef.envId) && def.name !== undefined && def.nodeId !== envDef.nodeId) {
					holders.push(def as EnvHolderDefinition);
				}
			}
		}
	}
	return holders;
}

function routeWrittenToCustomEnv(result: DataflowInformation, envDef: EnvHolderDefinition, newDefAt: NodeId, callerEnvironment: REnvironmentInformation, definedAt?: NodeId): DataflowInformation {
	const written = writtenDefinitionsOf(result, definedAt);

	let newEnvState = envDef.envState;
	/* the frame of the function itself (`e <- environment()`) is where the write binds anyway */
	const ownFrame = envDef.envState.current.closure !== undefined && envDef.envState.current.closure === callerEnvironment.current.closure;
	/* only a binding the write made here moves into the environment, `local(y <- 2, envir = e)` leaves the caller's `y` alone */
	const namesToRemove = ownFrame ? [] : written.filter(w => result.environment.current.lookup(Identifier.getName(w.name))?.some(d => d.nodeId === w.nodeId)).map(w => ({ name: w.name }));
	for(const w of written) {
		newEnvState = REnvironment.define(w, false, newEnvState);
	}

	const current = result.environment.current.removeAll(namesToRemove);
	/* what the caller bound before stays bound, `v <- 3; assign("v", 4, envir = e)` keeps `v` at 3 */
	for(const { name } of namesToRemove) {
		const before = callerEnvironment.current.lookup(Identifier.getName(name));
		if(before !== undefined) {
			current.writableMemory.set(Identifier.getName(name), before);
		}
	}
	const stripped = { current, level: result.environment.level };
	return { ...result, environment: rebindHolders(stripped, envDef, newEnvState, newDefAt) };
}

/** The calls that look up bindings in an environment they are given, or write into it, see {@link readEnvironmentContents}. */
export const EnvironmentLookups: ReadonlySet<BrandedIdentifier> = new Set([
	BuiltInProcName.Access, BuiltInProcName.Assignment, BuiltInProcName.Attach, BuiltInProcName.EnvContents, BuiltInProcName.Get,
	BuiltInProcName.Local, BuiltInProcName.NewEnv, BuiltInProcName.Replacement, BuiltInProcName.Rm, BuiltInProcName.With
]);

/** An environment is changed in place, so a call given a variable holding a tracked environment reads everything written into the environment so far, through the writes, unless the call only looks up bindings in it (see {@link EnvironmentLookups}). */
export function readEnvironmentContents(graph: DataflowGraph, call: NodeId, holder: IdentifierDefinition): void {
	const envState = (holder as InGraphIdentifierDefinition).envState;
	/* a stack env or the frame of a function (`environment()`) holds variables the scoping links already */
	if(envState === undefined || stackKindOf(envState) !== undefined || envState.current.closure !== undefined || (holder as InGraphIdentifierDefinition).closureFrame === true) {
		return;
	}
	for(const fields of envState.current.memory.values()) {
		for(const field of fields) {
			/* the write reads what it stores, which is data to the call: a function stored there is not what it calls */
			if(!NodeId.isBuiltIn(field.definedAt)) {
				graph.addEdge(call, field.definedAt, EdgeType.Reads);
			}
		}
	}
}

/** What creates an environment rather than another value: `new.env()`, `globalenv()` and its kin, and `list2env()`. */
export const EnvironmentProducers: readonly BuiltInProcName[] = [BuiltInProcName.NewEnv, BuiltInProcName.StackEnv, BuiltInProcName.ListToEnv];

/** Whether the variable definition `holder` surely holds a value one of `origins` created, following plain copies (`e2 <- e`) and replacements (`e$f <- v` keeps what `e` held). */
export function holdsValueOf(holder: Pick<IdentifierDefinition, 'nodeId'>, graph: DataflowGraph, origins: readonly BuiltInProcName[]): boolean {
	const sources = Dataflow.valueSources(holder.nodeId, graph);
	return sources !== undefined && sources.length > 0 && sources.every(v => origins.some(o => DfgVertex.hasOrigin(graph.getVertex(v), o)));
}

/** Binds every other variable holding the same object as the variable `name` (copied from it by `y <- x`, see {@link InGraphIdentifierDefinition#envId}) to the change in place `change` as well (`x[, a := 9L]`), which reaches all of them. */
export function rebindAliases(environment: REnvironmentInformation, name: Identifier, change: NodeId, definedAt: NodeId): [REnvironmentInformation, NodeId | undefined] {
	const changed = Resolve.byName(name, environment) as readonly Partial<InGraphIdentifierDefinition>[] | undefined;
	const identities = new Set(changed?.map(d => d.envId ?? d.nodeId).filter(i => i !== undefined && !NodeId.isBuiltIn(i)));
	if(identities.size === 0) {
		return [environment, undefined];
	}
	const target = Identifier.getName(name);
	for(let env: Environment | undefined = environment.current; env !== undefined && !env.builtInEnv; env = env.parent) {
		for(const defs of env.memory.values()) {
			for(const def of defs as readonly InGraphIdentifierDefinition[]) {
				if(def.name !== undefined && Identifier.getName(def.name) !== target && identities.has(def.envId ?? def.nodeId)) {
					/* the alias may still hold the object as it was, so the change joins its binding */
					environment = REnvironment.define({ ...def, name: def.name, nodeId: change, definedAt, cds: [] }, environment.current.lookup(Identifier.getName(def.name)) === undefined, environment);
				}
			}
		}
	}
	return [environment, identities.size === 1 ? [...identities][0] : undefined];
}

/** Binds every variable holding the environment of `envDef` to its new state, where that variable is bound. */
export function rebindHolders(environment: REnvironmentInformation, envDef: EnvHolderDefinition, envState: REnvironmentInformation, definedAt?: NodeId): REnvironmentInformation {
	for(const holder of holdersOf(environment, envDef)) {
		/* a holder bound in an enclosing frame is updated there, so the write escapes the function like a `<<-` */
		environment = REnvironment.define({ ...holder, definedAt: definedAt ?? holder.definedAt, envState, ...envDef.closureFrame ? { closureFrame: true } as const : {} }, environment.current.lookup(Identifier.getName(holder.name)) === undefined, environment);
	}
	return environment;
}

/** Adds the `writes` a called function made into environments its free variables name (see {@link InGraphIdentifierDefinition#envWrites}) to the environments the caller binds these names to; a name still free in a calling function body stays with the writes, so its own calls add them. */
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
			caller = rebindHolders(caller, holder as EnvHolderDefinition, envState, call);
		}
	}
	return [callee, caller];
}

/** Routes writes into a real stack env's frame chain, the same way `<<-` reaches an outer scope. */
export function routeWrittenToStackEnv(result: DataflowInformation, into: REnvironmentInformation, rootId: NodeId, definedAt?: NodeId): DataflowInformation {
	const written = writtenDefinitionsOf(result, definedAt);
	let environment = into;
	for(const w of written) {
		environment = REnvironment.define(w, true, environment);
		result.graph.addEdge(w.nodeId, rootId, EdgeType.Reads);
	}
	return { ...result, environment };
}

/** Routes writes under a resolved `envir=` to the real stack frame or a tracked custom env, and adds the `Reads` edge from `rootId` to the envir argument. */
export function routeWrittenToEnvir<OtherInfo>(result: DataflowInformation, resolution: EnvirResolution<OtherInfo>, rootId: NodeId, callerEnvironment: REnvironmentInformation, definedAt?: NodeId): DataflowInformation {
	let routed: DataflowInformation;
	if(resolution.stack !== undefined) {
		routed = resolution.stack === 'base' ? result : routeWrittenToStackEnv(result, callerEnvironment, rootId, definedAt);
	} else {
		routed = routeWrittenToCustomEnv(result, resolution.envDef, rootId, callerEnvironment, definedAt);
	}
	routed.graph.addEdge(rootId, resolution.envirNodeId, EdgeType.Reads);
	return routed;
}

/** The `search()` position the `pos` argument of a `library()` call requests, either given as a number or as the name of an existing entry (`pos = "package:base"`). */
export function resolveAttachPosition<OtherInfo>(posId: NodeId | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): number | undefined {
	const element = posId === undefined ? undefined : NodeValue.soleOf(posId, data);
	const asNumber = element === undefined ? undefined : RValue.numberOf(element);
	const asString = element === undefined || asNumber !== undefined ? undefined : RValue.stringOf(element);
	const position = asNumber ?? (asString === undefined ? undefined : REnvironment.searchPosition(data.environment.current, asString));
	if(position === undefined && asString !== undefined) {
		dataflowLogger.warn(`search-path entry '${asString}' does not exist, attaching at the default position`);
	}
	/* it must be an integer and may never displace the global environment (R rejects `pos = 1`) */
	return position !== undefined && Number.isFinite(position) ? Math.max(DefaultAttachPosition, Math.trunc(position)) : undefined;
}
