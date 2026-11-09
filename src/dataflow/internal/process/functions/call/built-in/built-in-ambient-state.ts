import type { DataflowProcessorInformation } from '../../../../../processor';
import { type ControlDependency, DataflowInformation, type ExitPoint, ExitPointType, happensInEveryBranch } from '../../../../../info';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { type DataflowGraphVertexFunctionCall, DfgVertex } from '../../../../../graph/vertex';
import { ArgProp, CallProp, CallProps, type FnSig, SemanticCallTag } from '../../../../../environments/built-in-props';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RLogical } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { statedFunctions } from '../../../../../environments/query-fn-props';
import { type NamedInGraphIdentifierDefinition, type BrandedIdentifier, Identifier, isInGraphDefinition, type IdentifierDefinition, type IdentifierReference, type InGraphIdentifierDefinition, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { type Environment, REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import { applyCdsToDefinitions } from '../../../../../environments/reference-to-maybe';
import { RConstant, RLoopConstructs, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RValue } from '../../../../../eval/values/r-value';
import { MatchArgs } from '../../../../../graph/match-args';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { appliedArguments } from '../../../../../graph/applied-arguments';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import type { DataflowGraph } from '../../../../../graph/graph';
import { Dataflow } from '../../../../../graph/df-helper';
import type { FlowrConfig } from '../../../../../../config';
import { EdgeType } from '../../../../../graph/edge';
import { isNotUndefined } from '../../../../../../util/assert';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNull } from '../../../../../../r-bridge/lang-4.x/convert-values';
import { RIfThenElse } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { uniqueArray, uniqueArrayMerge } from '../../../../../../util/collections/arrays';
import { AmbientAccess } from '../../../../../graph/ambient-access';
import { type AmbientFamily, AmbientStateName, GraphicsDevices, MessageSinks, OutputSinks, KeyedAccumulators, KeyedState, UnknownKey } from '../../../../../environments/ambient-state-name';
import { flagValue, keysOf, keyedWrites, stringValuesOf } from './built-in-ambient-keys';
import { Ternary, TernaryLogic } from '../../../../../../util/logic';
import { OperatorUsedAs } from '../../../../../environments/default-builtin-config/base-operators';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import { RWhileLoop } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RForLoop } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { AmbientSingleState, PrintingOptions } from '../../../../../environments/built-in-kinds';
import { Ambient, type AmbientCondition, type AmbientEffect, type AmbientEffects, type AmbientFamilyName, AmbientPart, AmbientVerb } from '../../../../../environments/ambient-effect';
export { PrintingOptions } from '../../../../../environments/built-in-kinds';

const ListConstructors: ReadonlySet<BrandedIdentifier> = new Set(['list', 'c']);

/** the states of the active instance of a family */
function activeStates(family: AmbientFamily): AmbientStateName[] {
	return family.states.map(([active]) => active);
}

const DeviceStates = GraphicsDevices.states.flat();

const Accumulating: ReadonlySet<AmbientStateName> = new Set([
	...DeviceStates, ...OutputSinks.states.flat(), ...MessageSinks.states.flat(), AmbientStateName.canvas, AmbientStateName.palette, AmbientStateName.allOptions, AmbientStateName.unknownOption,
	AmbientStateName.warnsAsErrors, AmbientStateName.files, AmbientStateName.rngKind, AmbientStateName.finalizers, ...KeyedAccumulators
]);

/** What a call does to the graphics devices. */
enum DeviceAccess {
	Open = 'open',
	Close = 'close',
	CloseAll = 'close-all',
	/** closes one that is not known to be the active one, which writes what any of them holds */
	CloseSome = 'close-some',
	/** makes another one active */
	Switch = 'switch'
}

/** How a write differs from the default, see {@link AmbientWrite}. */
enum AmbientWriteMode {
	/** binds in the current frame only (`withr::local_options`) */
	Local = 'local',
	/** replaces an accumulating state (a new device) */
	Reset = 'reset',
	/** may not happen */
	Maybe = 'maybe'
}

/** A write other than the default. */
interface AmbientWrite {
	readonly name:     AmbientStateName
	readonly mode:     AmbientWriteMode
	readonly assumed?: true
}


/** a write that may not happen: it reads what was there, so it can still replace the state and keep everything before reachable */
function maybe(name: AmbientStateName): AmbientWrite {
	return { name, mode: AmbientWriteMode.Maybe };
}

/** what reading the options `keys` reads, every option if the keys are unknown */
function optionReads(keys: readonly BrandedIdentifier[] | undefined): AmbientStateName[] {
	return keys === undefined ? [AmbientStateName.allOptions] : [...keys.map(AmbientStateName.option), AmbientStateName.unknownOption];
}

/**
 * Links a call handing back the entry `key` of a keyed state (`getOption("digits")`, `Sys.getenv("A")`, `par("mfrow")`) to the values the calls that may have set it last gave it,
 * so value resolution sees them like the result of a call. It links only if these calls cover every path and named the entry, as anything else (`options(op)`, `layout(m)`, a new device) may set it to a value we do not know.
 */
function linkEntryValue<OtherInfo>(res: DataflowInformation, rootId: NodeId, state: KeyedState, keys: readonly BrandedIdentifier[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
	const [key] = keys;
	if(keys.length !== 1 || key === UnknownKey || Resolve.byName(AmbientStateName.keyed(state, UnknownKey), data.environment)?.some(d => !NodeId.isBuiltIn(d.nodeId))) {
		return;
	}
	const defs = Resolve.byName(AmbientStateName.keyed(state, key), data.environment) ?? [];
	const whole = new Set((Resolve.byName(AmbientStateName.allOf(state), data.environment) ?? []).map(d => d.nodeId));
	const own = new Set(defs.map(d => d.nodeId));
	/* a write of the whole state that names no entry, like `layout(m)`, may change this one as well */
	const namesEntries = (id: NodeId) => {
		const setter = data.completeAst.idMap.get(id);
		return NodeId.isBuiltIn(id) || (RFunctionCall.is(setter) && setter.arguments.every(a => a === EmptyArgument || a.name !== undefined));
	};
	if(defs.length === 0 || [...whole].some(id => !own.has(id) && !namesEntries(id)) || !(defs.some(d => happensInEveryBranch(d.cds)) || happensInEveryBranch(defs.flatMap(d => d.cds ?? [])))) {
		return;
	}
	const values: NodeId[] = [];
	for(const { nodeId } of defs) {
		const setter = data.completeAst.idMap.get(nodeId);
		const named = RFunctionCall.is(setter) && whole.has(nodeId) ? setter.arguments.filter(a => a !== EmptyArgument && a.name !== undefined && Identifier.getName(a.name.content) === key) : [];
		const value = named.length === 1 ? RArgument.valueOf(named[0]) : undefined;
		if(value === undefined) {
			return;
		}
		values.push(value.info.id);
	}
	for(const value of values) {
		res.graph.addEdge(rootId, value, EdgeType.Returns);
	}
}

/** Whether calling `definition` runs a body flowR cannot see: a library function's, or whatever a parameter is bound to. */
export function hidesBody(definition: IdentifierDefinition): boolean {
	return NodeId.isBuiltIn(definition.nodeId) || isReferenceType(definition.type, ReferenceType.Parameter | ReferenceType.Argument);
}

/** Whether the call `call` of a function body reaches a built-in only once linked where the function is called, through a parameter or a name the body cannot resolve. */
export function reachesBuiltInLate(call: DataflowGraphVertexFunctionCall): boolean {
	const definitions = call.environment === undefined ? [] : Resolve.byNameAndType(call.name, call.environment, ReferenceType.Function) ?? [];
	return definitions.length === 0 || definitions.some(hidesBody);
}

/** A call into code flowR cannot see may read any option, draw random numbers (with `draws` advancing the generator), and with `graphics` draw on the device. */
export function readsAllAmbientState<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, graphics: boolean, draws = true): DataflowInformation {
	const reads: AmbientStateName[] = [AmbientStateName.allOptions, AmbientStateName.rng, AmbientStateName.allOf(KeyedState.Env)];
	if(graphics) {
		reads.push(AmbientStateName.graphics, AmbientStateName.palette);
	}
	return withAccess(res, rootId, data, reads, draws ? [{ ...maybe(AmbientStateName.rng), assumed: true }] : []);
}

/** Adds the reads and writes of the ambient state to what a call does, see {@link AmbientStateName}. */
function withAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, reads: readonly AmbientStateName[], writes: readonly (AmbientStateName | AmbientWrite)[] = [], kills: readonly AmbientStateName[] = []): DataflowInformation {
	if(reads.length === 0 && writes.length === 0 && kills.length === 0) {
		return res;
	}
	const cds = data.cds ? [...data.cds] : undefined;
	const maybeWritten = writes.flatMap(w => typeof w === 'object' && w.mode === AmbientWriteMode.Maybe ? [w.name] : []);
	const read = uniqueArrayMerge(reads, maybeWritten);
	const readRefs: IdentifierReference[] = read.map(name => ({ nodeId: rootId, name, type: ReferenceType.Variable, cds }));
	recordAmbient(res.graph, rootId, res.environment, read, writes, kills);
	/* the writes stay out of `out`: an assignment reads whatever else its source writes (`x <- y <- 3`) */
	return {
		...res,
		unknownReferences: readRefs.length > 0 ? [...res.unknownReferences, ...readRefs] : res.unknownReferences,
		environment:       defineAmbient(res.environment, rootId, cds, writes)
	};
}

/** Whether the write of `name` binds in the current frame only, see {@link AmbientWrite}. */
function writesLocally(environment: REnvironmentInformation, name: AmbientStateName, mode: AmbientWrite['mode'] | undefined): boolean {
	return mode === AmbientWriteMode.Local || (environment.level > 0 && environment.current.memory.has(name));
}

/** Notes in `graph` what the call `rootId` reads, writes, and ends (`kills`), see {@link DataflowGraph#recordAmbientAccess}; `environment` is the one the writes apply to. */
function recordAmbient(graph: DataflowGraph, rootId: NodeId, environment: REnvironmentInformation, reads: readonly AmbientStateName[], writes: readonly (AmbientStateName | AmbientWrite)[], kills: readonly AmbientStateName[] = []): void {
	if(reads.length === 0 && writes.length === 0 && kills.length === 0) {
		return;
	}
	const global: AmbientStateName[] = [];
	const assumed: AmbientStateName[] = [];
	const local: AmbientStateName[] = [];
	for(const write of writes) {
		const { name, mode, assumed: isAssumed } = typeof write === 'string' ? { name: write, mode: undefined, assumed: undefined } : write;
		(writesLocally(environment, name, mode) ? local : isAssumed ? assumed : global).push(name);
	}
	graph.recordAmbientAccess(rootId, { reads, writes: global, assumed, local, kills });
}

/** Whether the code itself binds a variable of the same name, by quoting it in backticks, which a write of the state must not replace, as they only share the name. */
function boundByCode(environment: REnvironmentInformation, name: AmbientStateName): boolean {
	return Resolve.byName(name, environment)?.some(d => d.nodeId !== d.definedAt) === true;
}

/** Applies the writes of the call `rootId` to the environment, see {@link withAccess}. */
function defineAmbient(environment: REnvironmentInformation, rootId: NodeId, cds: readonly ControlDependency[] | undefined, writes: readonly (AmbientStateName | AmbientWrite)[]): REnvironmentInformation {
	for(const write of writes) {
		const { name, mode, assumed } = typeof write === 'string' ? { name: write, mode: undefined, assumed: undefined } : write;
		const accumulates = Accumulating.has(name) || name.startsWith(AmbientStateName.file(''));
		/* an assumed write keeps what the body wrote before, which, other than it, surely happened */
		const keep = (accumulates && (mode === undefined || mode === AmbientWriteMode.Maybe)) || assumed === true || boundByCode(environment, name);
		/* an accumulating state only ever grows, its definitions are maybe so merging environments keeps them all; a reset is definite */
		const isMaybe = keep || (accumulates && mode !== AmbientWriteMode.Reset);
		const def: NamedInGraphIdentifierDefinition<AmbientStateName> = {
			nodeId:    rootId,
			name,
			type:      ReferenceType.Variable,
			definedAt: rootId,
			cds:       isMaybe ? cds ?? [] : cds,
			...assumed ? { assumed } : {}
		};
		/* the state is global, wherever the call happens, unless the call or an earlier one (`local_seed`) scopes it to the current frame */
		environment = REnvironment.define(def, !writesLocally(environment, name, mode), environment, keep);
	}
	return environment;
}

/** {@link defineAmbient}, recording the writes for `rootId` in `graph` as well. */
function defineRecorded(graph: DataflowGraph, environment: REnvironmentInformation, rootId: NodeId, cds: readonly ControlDependency[] | undefined, writes: readonly (AmbientStateName | AmbientWrite)[]): REnvironmentInformation {
	recordAmbient(graph, rootId, environment, [], writes);
	return defineAmbient(environment, rootId, cds, writes);
}

/** What an assignment writes beyond its target: only a global `.Random.seed` sets {@link AmbientStateName.rng}. */
export function ambientWritesOfAssignment(graph: DataflowGraph, environment: REnvironmentInformation, target: Identifier, rootId: NodeId, cds: readonly ControlDependency[] | undefined, global: boolean): REnvironmentInformation {
	environment = ambientWritesOfRelease(graph, environment, [target], rootId, cds);
	return global && Identifier.getName(target) === AmbientStateName.rngVariable ? defineRecorded(graph, environment, rootId, cds, [AmbientStateName.rng, AmbientStateName.rngKind]) : environment;
}

/** Rebinding or removing the names (all of them if `undefined`) may release an object a finalizer is registered for. */
export function ambientWritesOfRelease(graph: DataflowGraph, environment: REnvironmentInformation, names: readonly Identifier[] | undefined, rootId: NodeId, cds: readonly ControlDependency[] | undefined): REnvironmentInformation {
	const holders = (Resolve.byName(AmbientStateName.finalizers, environment) ?? []).filter(isInGraphDefinition).map(d => d.holder);
	const released = holders.some(h => h === undefined || names === undefined || names.some(n => Identifier.getName(n) === h));
	return released ? defineRecorded(graph, environment, rootId, cds, [AmbientStateName.finalizers]) : environment;
}

function* ambientDefinitionsBetween(after: REnvironmentInformation, before: REnvironmentInformation, skipUnchanged: boolean): Generator<[AmbientStateName, NodeId]> {
	let unchanged: Environment | undefined = before.current;
	for(let env: Environment | undefined = after.current; env !== undefined && !env.builtInEnv; env = env.parent, unchanged = unchanged?.parent) {
		/* a frame the part did not write to shares its memory with the one before */
		if(skipUnchanged && (env === unchanged || env.memory === unchanged?.memory)) {
			continue;
		}
		for(const [name, definitions] of env.memory.entries()) {
			if(!AmbientStateName.is(name)) {
				continue;
			}
			const known = new Set((Resolve.byName(name, before) ?? []).map(d => d.nodeId));
			for(const { nodeId } of definitions) {
				if(!known.has(nodeId)) {
					yield [name, nodeId];
				}
			}
		}
	}
}

/** Ambient writes stay out of `out` (see {@link withAccess}), so a part that only maybe runs marks its writes as maybe in `target` here. */
export function makeAmbientWritesMaybe(after: REnvironmentInformation, before: REnvironmentInformation, target: REnvironmentInformation, cds: readonly ControlDependency[]): void {
	for(const [name, nodeId] of ambientDefinitionsBetween(after, before, true)) {
		applyCdsToDefinitions(target, name, ReferenceType.Variable, Resolve.byName(name, target) ?? [], nodeId, cds);
	}
}

/** The states written in `after` that `before` does not hold, as by a promise (`delayedAssign`) whose writes only happen once a read forces it. */
export function ambientWritesBetween(after: REnvironmentInformation, before: REnvironmentInformation): AmbientStateName[] {
	const names = new Set<AmbientStateName>();
	for(const [name] of ambientDefinitionsBetween(after, before, false)) {
		names.add(name);
	}
	return [...names];
}

/** Notes that a definition binds a promise or a text connection, which reads have to look for from now on. */
export function markForcing(environment: REnvironmentInformation): void {
	REnvironment.findBuiltIn(environment.current).forcing = true;
}

/** Whether a definition seen so far binds a promise or a text connection, see {@link markForcing}. */
export function mayForce(environment: REnvironmentInformation): boolean {
	return REnvironment.findBuiltIn(environment.current).forcing === true;
}

/** The state a symbol reads, plus the maybe-writes of forcing a promise bound to it. */
export function ambientAccessOfSymbol<OtherInfo>(res: DataflowInformation, symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const forcing = mayForce(data.environment);
	const definitions = forcing ? Resolve.byName(symbol.content, data.environment) ?? [] : [];
	const forces = definitions.filter(isInGraphDefinition).flatMap(d => d.forces ?? []);
	return withAccess(res, symbol.info.id, data, ambientReadsOfSymbol(symbol, data, forcing), forces.map(maybe));
}

/** Binds `name` (globally) to the given definitions, in addition to what it holds with `keep`, so `#graphics` can become what another state holds. */
function setAmbient(environment: REnvironmentInformation, name: AmbientStateName, definitions: readonly IdentifierDefinition[], keep = false): REnvironmentInformation {
	if(definitions.length === 0 && !keep) {
		return { ...environment, current: environment.current.removeAll([{ name }]) };
	}
	for(const [i, def] of definitions.entries()) {
		environment = REnvironment.define({ ...def, name }, true, environment, keep || i > 0);
	}
	return environment;
}

/** A variable a text connection writes reads what is written to connections, `.Random.seed` reads the generator state, and `.Options` the options, see {@link optionsVariableReads}. */
function ambientReadsOfSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, forcing: boolean): AmbientStateName[] {
	const name = Identifier.getName(symbol.content);
	if(forcing && Resolve.byName(AmbientStateName.textConnection(name), data.environment)?.length) {
		/* what is written to a connection we cannot name may be written to this one */
		return [AmbientStateName.anyFile];
	} else if(name === AmbientStateName.rngVariable) {
		return [AmbientStateName.rng, AmbientStateName.rngKind];
	} else if(name !== '.Options') {
		return [];
	}
	return optionsVariableReads(symbol, data);
}

/** `.Options$digits` (or `.Options[["digits"]]`) reads that option, anything else done with `.Options` reads all of them. */
function optionsVariableReads<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): AmbientStateName[] {
	const parent = RNode.directParent(symbol, data.completeAst.idMap);
	if(!RAccess.is(parent) || parent.accessed.info.id !== symbol.info.id || (parent.operator !== '$' && parent.operator !== '[[')) {
		return optionReads(undefined);
	}
	const value = RArgument.valueOf(parent.access[0]);
	if(RString.is(value)) {
		return optionReads([value.content.str]);
	} else if(parent.operator === '$' && RSymbol.is(value)) {
		return optionReads([Identifier.getName(value.content)]);
	}
	return optionReads(undefined);
}

/** Options affecting calls we cannot name (`scipen` changes every number-to-string conversion), so setting one stays an unknown side effect. */
const GlobalEffectOptions: ReadonlySet<BrandedIdentifier> = new Set([
	'scipen', 'OutDec', 'warn', 'error', 'expressions', 'encoding', 'stringsAsFactors', 'timeout', 'HTTPUserAgent',
	'download.file.method', 'download.file.extra', 'internet.info', 'warnPartialMatchArgs', 'warnPartialMatchAttr',
	'warnPartialMatchDollar', 'keep.source', 'keep.parse.data', 'check.bounds', 'CBoundsCheck', 'catch.script.errors',
	'defaultPackages', 'topLevelEnvironment', 'java.parameters'
]);

/** Environment variables R or a child process reads by itself: the time zone, locale, library paths, temp dir, search path, proxies. */
const GlobalEffectEnv = /^(TZ|LANG|LANGUAGE|LC_\w+|R_\w+|TMPDIR|TEMP|TMP|HOME|PATH|SHELL|\w*_proxy|\w*_PROXY|no_proxy|NO_PROXY)$/;

/** What reading the given entries of `state` reads: each entry and the writes we cannot name, all of the state if no entry is known. */
function keyedReads(state: KeyedState, keys: readonly BrandedIdentifier[]): AmbientStateName[] {
	return keys.length === 0 || keys.includes(UnknownKey) ? [AmbientStateName.allOf(state)] : [...keys.map(k => AmbientStateName.keyed(state, k)), AmbientStateName.keyed(state, UnknownKey)];
}



/** Where each part of the global state lives, which gives every {@link AmbientEffect} its reads and writes. */
interface FamilyState {
	/** the pseudo variable holding it, all of it for a keyed part, the active instance for an instance family */
	readonly state:      AmbientStateName
	readonly keyed?:     KeyedState
	/** the family whose active instance the part belongs to, which accessing it opens on the fly if none is open */
	readonly of?:        AmbientFamily
	/** the family of instances the part is */
	readonly instances?: AmbientFamily
}

const Families: Readonly<Record<AmbientFamilyName, FamilyState>> = {
	[AmbientPart.Device]:           { state: AmbientStateName.device, instances: GraphicsDevices },
	[AmbientPart.Sink]:             { state: AmbientStateName.sink, instances: OutputSinks },
	[AmbientPart.MessageSink]:      { state: MessageSinks.switched, instances: MessageSinks },
	[AmbientPart.Plot]:             { state: AmbientStateName.plot, of: GraphicsDevices },
	[KeyedState.Par]:               { state: AmbientStateName.graphics, keyed: KeyedState.Par, of: GraphicsDevices },
	[AmbientPart.Palette]:          { state: AmbientStateName.palette },
	[AmbientPart.LastPlot]:         { state: AmbientStateName.lastPlot },
	[KeyedState.Option]:            { state: AmbientStateName.allOptions, keyed: KeyedState.Option },
	[KeyedState.Env]:               { state: AmbientStateName.allOf(KeyedState.Env), keyed: KeyedState.Env },
	[KeyedState.Locale]:            { state: AmbientStateName.allOf(KeyedState.Locale), keyed: KeyedState.Locale },
	[KeyedState.SearchPath]:        { state: AmbientStateName.allOf(KeyedState.SearchPath), keyed: KeyedState.SearchPath },
	[AmbientPart.Rng]:              { state: AmbientStateName.rng },
	[AmbientPart.RngKind]:          { state: AmbientStateName.rngKind },
	[AmbientPart.WorkingDirectory]: { state: AmbientStateName.workingDirectory },
	[AmbientPart.Files]:            { state: AmbientStateName.files },
	[AmbientPart.ProjectRoot]:      { state: AmbientStateName.projectRoot },
	[AmbientPart.LibPaths]:         { state: AmbientStateName.libPaths },
	[AmbientPart.Umask]:            { state: AmbientStateName.umask },
	[AmbientPart.Finalizers]:       { state: AmbientStateName.finalizers },
	[AmbientPart.TextConnection]:   { state: AmbientStateName.anyFile }
};

/** The state an {@link AmbientEffect} reads, writes, and ends. */
interface StateAccess {
	readonly reads:  readonly AmbientStateName[]
	readonly writes: readonly (AmbientStateName | AmbientWrite)[]
	readonly kills:  readonly AmbientStateName[]
}

/** Whether an effect changes the state, so a call whose only changes are off only queries it. */
function changes(effect: AmbientEffect): boolean {
	return effect.access !== AmbientVerb.Reads && effect.access !== AmbientVerb.Builds;
}

/** Whether the `condition` holds for the arguments `args`, what values are known decided with `data`. */
function holds<OtherInfo>(condition: AmbientCondition, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data?: DataflowProcessorInformation<OtherInfo & ParentInformation>): Ternary {
	if(condition === 'no-arguments') {
		return args.length === 0 ? Ternary.Always : Ternary.Never;
	} else if(condition === 'query') {
		return isQuery(args) ? Ternary.Always : Ternary.Never;
	} else if('flag' in condition) {
		const flag = args.find(a => a !== EmptyArgument && a.name !== undefined && Identifier.getName(a.name.content) === condition.flag);
		return flag === undefined || flag === EmptyArgument ? Ternary.Never : RLogical.is(flag.value) ? flag.value.content ? Ternary.Always : Ternary.Never : data === undefined ? Ternary.Maybe : flagValue(flag.value, data);
	} else if('arg' in condition) {
		return argumentIs(MatchArgs.toNames(args, condition.formals).get(condition.arg), condition.is, data);
	}
	return args.some((a, i) => a !== EmptyArgument && (a.name === undefined ? i >= condition.besides.length : !condition.besides.includes(Identifier.getName(a.name.content)))) ? Ternary.Always : Ternary.Never;
}

/** Whether the argument is one of the strings `is`, `null` standing for a missing or `NULL` argument. */
function argumentIs<OtherInfo>(arg: RArgument<OtherInfo & ParentInformation> | undefined, is: readonly (string | null)[], data: DataflowProcessorInformation<OtherInfo & ParentInformation> | undefined): Ternary {
	const value = RArgument.valueOf(arg);
	if(value === undefined || (RSymbol.is(value) && value.content === RNull)) {
		return is.includes(null) ? Ternary.Always : Ternary.Never;
	}
	/* an argument given is taken for a value, `NULL` only if written so */
	const strings = RString.is(value) ? [value.content.str] : data === undefined ? undefined : stringValuesOf(value, data);
	if(!is.some(v => v !== null)) {
		return Ternary.Never;
	} else if(strings === undefined) {
		return Ternary.Maybe;
	}
	const known = strings.map(v => is.includes(v));
	return known.every(Boolean) ? Ternary.Always : known.some(Boolean) ? Ternary.Maybe : Ternary.Never;
}

/** Whether the effect happens for the arguments `args`, see {@link AmbientEffect#when}. */
function applies<OtherInfo>(effect: AmbientEffect, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data?: DataflowProcessorInformation<OtherInfo & ParentInformation>): Ternary {
	return TernaryLogic.and(effect.when === undefined ? Ternary.Always : holds(effect.when, args, data), effect.unless === undefined ? Ternary.Always : TernaryLogic.negate(holds(effect.unless, args, data)));
}

/**
 * What the effect on a part without instances does to its state, for the entries `keys` (all of them if `undefined`).
 * A part of the active instance of a family opens one on the fly, a drawing on the plot writes the canvas with `drawing`.
 * With `maybe` the arguments are unknown, so a reset only adds and an entry is not known to be removed.
 */
function stateAccess(effect: AmbientEffect, keys: readonly BrandedIdentifier[] | undefined, maybe: boolean, drawing: boolean): StateAccess {
	const { state, keyed, of } = Families[effect.family];
	const { access } = effect;
	if(access === AmbientVerb.Builds) {
		return { reads: [], writes: [], kills: [] };
	}
	const read = keyed === undefined ? [state] : keyedReads(keyed, keys ?? []);
	const written = keyed === undefined ? [state] : keys === undefined ? [AmbientStateName.allOf(keyed)] : keyedWrites(keyed, keys);
	const writes: (AmbientStateName | AmbientWrite)[] = [
		...of === undefined ? [] : [of.used],
		...drawing && effect.family === AmbientPart.Plot && (access === AmbientVerb.Adds || access === AmbientVerb.Resets) ? [AmbientStateName.canvas] : [],
		...access === AmbientVerb.Reads ? [] : access === AmbientVerb.Resets && !maybe ? written.map(name => ({ name, mode: AmbientWriteMode.Reset })) : written
	];
	return {
		/* with unknown arguments, a reset may add to what is there (`plot(f, add = TRUE)`) */
		reads: access === AmbientVerb.Reads || access === AmbientVerb.Adds || (maybe && access === AmbientVerb.Resets) ? read : [],
		writes,
		kills: access === AmbientVerb.Kills && !maybe ? written.filter(n => keyed === undefined || n !== AmbientStateName.allOf(keyed)) : []
	};
}

/** Whether a call drawing on a device writes its canvas, see `semantics.ambient.drawingWritesDevice`. */
export function drawingWritesDevice(config: FlowrConfig): boolean {
	return config.semantics.ambient?.drawingWritesDevice === true;
}

/** Wires the {@link AmbientEffect}s of a call into its dataflow information: reads become unknown references, writes define the pseudo variable globally. */
export function applyAmbientEffects<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] | UnknownArguments, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effects: AmbientEffects): DataflowInformation {
	for(const effect of Ambient.list(effects)) {
		if(args === UnknownArguments) {
			res = applyWithUnknownArguments(res, rootId, data, effect);
		} else {
			const happens = applies(effect, args, data);
			if(happens !== Ternary.Never) {
				res = applyEffect(res, args, rootId, data, effect, happens === Ternary.Maybe);
			}
		}
	}
	return res;
}

/** Applies the effect, which only `maybe` happens. */
function applyEffect<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effect: AmbientEffect, maybe = false): DataflowInformation {
	const { instances, keyed } = Families[effect.family];
	if(instances !== undefined) {
		return instanceAccess(res, rootId, data, effect, instances, args.length > 0);
	}
	const keys = effect.member === undefined || effect.member === 'every' ? undefined : keysOf(effect.member, args, data);
	switch(effect.family) {
		case KeyedState.Option:
			return effect.access === AmbientVerb.Reads ? readOptions(res, args, rootId, data, effect, keys) : setOptions(res, args, rootId, data);
		case AmbientPart.Files:
			return fileAccess(res, rootId, data, effect);
		case AmbientPart.TextConnection:
			return openTextConnection(res, args, rootId, data);
		case AmbientPart.Finalizers:
			return effect.access === AmbientVerb.Reads ? runFinalizers(res, rootId, data) : registerFinalizer(res, args, rootId, data);
		case AmbientPart.LastPlot:
			if(changes(effect)) {
				/* the plot object is what the outermost `+` the call is part of builds */
				recordAmbient(res.graph, rootId, res.environment, [], [AmbientStateName.lastPlot]);
				return { ...res, environment: defineAmbient(res.environment, outermostPlus(rootId, data.completeAst.idMap), data.cds ? [...data.cds] : undefined, [AmbientStateName.lastPlot]) };
			}
			break;
		case KeyedState.Env:
		case KeyedState.Par:
			if(effect.handsBack && keys !== undefined && keyed !== undefined) {
				linkEntryValue(res, rootId, keyed, keys, data);
			}
			/* a variable R or a child process reads by itself is read by calls we cannot name */
			if(effect.family === KeyedState.Env && changes(effect) && keys?.some(k => k === UnknownKey || GlobalEffectEnv.test(k))) {
				res.graph.markIdForUnknownSideEffects(rootId);
			}
			break;
	}
	const { reads, writes, kills } = stateAccess(effect, keyed === undefined ? undefined : keys, maybe, drawingWritesDevice(data.ctx.config));
	return withAccess(res, rootId, data, reads, uniqueArray(writes), kills);
}

/** What the effect on an instance family does: opening, closing, and switching move the states of the instances, see {@link deviceAccess}. */
function instanceAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effect: AmbientEffect, family: AmbientFamily, named: boolean): DataflowInformation {
	const { state } = Families[effect.family];
	switch(effect.access) {
		case AmbientVerb.Opens:
			return deviceAccess(res, rootId, data, DeviceAccess.Open, family);
		case AmbientVerb.Switches:
			return deviceAccess(res, rootId, data, DeviceAccess.Switch, family);
		case AmbientVerb.Closes:
			/* `dev.off(which)` may close an instance other than the active one, which keeps its state then */
			return deviceAccess(res, rootId, data, effect.member === 'every' ? DeviceAccess.CloseAll : named ? DeviceAccess.CloseSome : DeviceAccess.Close, family);
		default: {
			const { reads, writes } = instanceStateAccess(effect, state, family);
			return withAccess(res, rootId, data, reads, writes);
		}
	}
}

/** What reading or using an instance does, `every` one with {@link AmbientEffect#member}: using it adds to what its closing links to. */
function instanceStateAccess(effect: AmbientEffect, state: AmbientStateName, family: AmbientFamily): { readonly reads: readonly AmbientStateName[], readonly writes: readonly AmbientStateName[] } {
	const others = family.states.find(([active]) => active === state)?.[1];
	return {
		reads:  effect.access === AmbientVerb.Builds ? [] : [state, ...effect.member === 'every' && others !== undefined ? [others] : []],
		writes: changes(effect) ? [family.used] : []
	};
}

/** What reading options does: the entries `keys` names, all options if a method may print the value `print(x)` dispatches on, which draws a plot object. */
function readOptions<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effect: AmbientEffect, keys: readonly BrandedIdentifier[] | undefined): DataflowInformation {
	if(effect.dispatchOn !== undefined) {
		const dispatched = RArgument.valueOf(args[effect.dispatchOn]);
		return withAccess(res, rootId, data, printingReads(dispatched, true, keys ?? [], data), mayHoldPlot(dispatched, data) ? DrawsNewPlot : []);
	}
	if(effect.handsBack) {
		linkEntryValue(res, rootId, KeyedState.Option, keys ?? [], data);
	}
	return withAccess(res, rootId, data, keyedReads(KeyedState.Option, keys ?? []));
}

/** What reading or writing the files the call names does, see {@link fileStems}. */
function fileAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effect: AmbientEffect): DataflowInformation {
	const stems = fileStems(res, rootId, data, effect);
	if(stems?.length === 0) {
		return res;
	}
	if(effect.access === AmbientVerb.Reads) {
		/* a read through a connection the program holds moves its position, so the next read depends on this one */
		const moves = readsThroughHandle(res, rootId, data, effect.sig) ? stems === undefined ? [AmbientStateName.anyFile, AmbientStateName.files] : stems.map(AmbientStateName.file) : [];
		return withAccess(res, rootId, data, [AmbientStateName.workingDirectory, ...stems === undefined ? [AmbientStateName.files] : [...stems.map(AmbientStateName.file), AmbientStateName.anyFile]], moves);
	}
	return withAccess(res, rootId, data, [AmbientStateName.workingDirectory], [...stems === undefined ? [AmbientStateName.anyFile] : stems.map(AmbientStateName.file), AmbientStateName.files]);
}

/** `gc()` may run every registered finalizer whose object is released. */
function runFinalizers<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const registered = (Resolve.byName(AmbientStateName.finalizers, data.environment) ?? []).filter(isInGraphDefinition);
	for(const fn of registered.flatMap(d => d.value ?? [])) {
		res.graph.addEdge(rootId, fn, EdgeType.Calls);
	}
	return withAccess(res, rootId, data, [AmbientStateName.finalizers], registered.flatMap(d => d.writes ?? []).map(maybe));
}

/** drawing a new plot adds to the device, which opens one if none is open, and replaces its plot */
const DrawsNewPlot: readonly (AmbientStateName | AmbientWrite)[] = [AmbientStateName.device, { name: AmbientStateName.plot, mode: AmbientWriteMode.Reset }];

/**
 * Whether the value of `node` may be a plot object, which printing draws: a call building one ({@link AmbientVerb.Builds}, as `ggplot` does),
 * a `+` adding to one, or a variable bound to either.
 */
function mayHoldPlot<OtherInfo>(node: RNode<OtherInfo & ParentInformation> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, seen = new Set<NodeId>()): boolean {
	if(node === undefined || seen.has(node.info.id)) {
		return false;
	}
	seen.add(node.info.id);
	if(RFunctionCall.isNamed(node)) {
		return (statedFunctions(node.functionName.content, data.environment) ?? [])
			.some(t => hiddenAccess(t).some(a => a.family === AmbientPart.Plot && a.access === AmbientVerb.Builds));
	} else if(RBinaryOp.is(node)) {
		return node.operator === '+' && (mayHoldPlot(node.lhs, data, seen) || mayHoldPlot(node.rhs, data, seen));
	} else if(RIfThenElse.is(node)) {
		return mayHoldPlot(node.then, data, seen) || mayHoldPlot(node.otherwise, data, seen);
	} else if(RExpressionList.is(node)) {
		return mayHoldPlot(node.children.at(-1), data, seen);
	} else if(!RSymbol.is(node)) {
		return false;
	}
	return (Resolve.byName(node.content, data.environment) ?? []).filter(isInGraphDefinition).some(d => {
		const source = data.completeAst.idMap.get(d.definedAt);
		return RBinaryOp.is(source) && mayHoldPlot(source.lhs.info.id === d.nodeId ? source.rhs : source.lhs, data, seen);
	});
}

/** the outermost `+` chain holding `id`, `id` itself if it is part of none */
function outermostPlus(id: NodeId, idMap: AstIdMap): NodeId {
	let at = idMap.get(id);
	for(let parent = at === undefined ? undefined : RNode.directParent(at, idMap); RBinaryOp.is(parent) && parent.operator === '+'; parent = RNode.directParent(parent, idMap)) {
		at = parent;
	}
	return at?.info.id ?? id;
}

/** `reg.finalizer(e, f)` keeps the functions `f` may be, and the name holding `e`, whose release lets `gc()` run them. */
function registerFinalizer<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const bound = MatchArgs.toNames(args, ['e', 'f', 'onexit']);
	const fn = bound.get('f')?.value;
	const holder = bound.get('e')?.value;
	const value = RFunctionDefinition.is(fn) ? [fn.info.id] : RSymbol.is(fn) ? (Resolve.byName(fn.content, data.environment) ?? []).flatMap(d => (d as Partial<InGraphIdentifierDefinition>).value ?? []) : [];
	const writes = value.flatMap(id => {
		const definition = res.graph.getVertex(id);
		return DfgVertex.isFunctionDefinition(definition) ? ambientWritesBetween(definition.subflow.environment, data.environment) : [];
	});
	const definition = { nodeId: rootId, name: AmbientStateName.finalizers, type: ReferenceType.Variable, definedAt: rootId, cds: data.cds ? [...data.cds] : [], value, writes, holder: RSymbol.is(holder) ? Identifier.getName(holder.content) : undefined } as const;
	recordAmbient(res.graph, rootId, res.environment, [], [AmbientStateName.finalizers]);
	return { ...res, environment: REnvironment.define(definition, true, res.environment, true) };
}

/** `textConnection(object, open, local)` opened for writing binds `object` globally, or locally with `local = TRUE`. */
function openTextConnection<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const bound = MatchArgs.toNames(args, ['object', 'open', 'local', 'name', 'encoding']);
	const open = bound.get('open');
	const modes = open === undefined ? ['r'] : stringValuesOf(open, data);
	if(modes?.every(m => m.startsWith('r'))) {
		return res;
	}
	const names = stringValuesOf(bound.get('object'), data);
	if(names === undefined) {
		handleUnknownSideEffect(res.graph, res.environment, rootId);
		return res;
	}
	const local = bound.get('local');
	const scopes = local === undefined ? [false] : NodeValue.setOf(local.info.id, data)?.elements.map(v => v.type === 'logical' && v.value === true);
	const cds = data.cds ? [...data.cds] : undefined;
	let environment = res.environment;
	for(const name of names) {
		for(const [i, inFrame] of (scopes ?? [true, false]).entries()) {
			environment = REnvironment.define({ nodeId: rootId, name, type: ReferenceType.Variable, definedAt: rootId, cds }, !inFrame, environment, i > 0 || names.length > 1);
		}
	}
	markForcing(environment);
	return withAccess({ ...res, environment }, rootId, data, [], names.map(AmbientStateName.textConnection));
}

/** Whether one of the resources the call reads is a variable bound to a connection, like `con` in `con <- file(f); readLines(con)`. */
function readsThroughHandle<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, sig: FnSig | undefined): boolean {
	const call = res.graph.getVertex(rootId);
	if(sig === undefined || !DfgVertex.isFunctionCall(call)) {
		return false;
	}
	return MatchArgs.findWithProps(appliedArguments(res.graph, call, data.completeAst.idMap).args, sig, ArgProp.Resource)
		.some(id => boundValues(id, data, false).some(v => callsTagged(v, data, SemanticCallTag.Opens)));
}

/** What the argument `id` holds: its value, or with `direct` unset only what the variable it names is bound to. */
function boundValues<OtherInfo>(id: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, direct = true): RNodeWithParent<OtherInfo>[] {
	const arg = data.completeAst.idMap.get(id);
	const node = RArgument.is(arg) ? RArgument.valueOf(arg) : arg;
	if(!RSymbol.is(node) || node.content === RNull) {
		return direct && node !== undefined ? [node] : [];
	}
	return (Resolve.byName(node.content, data.environment) ?? []).filter(isInGraphDefinition).flatMap(d => d.value ?? [])
		.map(v => data.completeAst.idMap.get(v)).filter(isNotUndefined);
}

/** Whether `node` calls a function flowR states `tag` of, like {@link SemanticCallTag.Opens} for `file(f)`. */
function callsTagged<OtherInfo>(node: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, tag: SemanticCallTag): boolean {
	return RFunctionCall.isNamed(node) && (Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function) ?? [])
		.some(d => d.type === ReferenceType.BuiltInFunction && d.config?.tags?.includes(tag) === true);
}

/** Whether the resource argument `id` names no file: `""` (the console for `cat`), `NULL`, or a console connection like `stdout()`. */
function namesNoFile<OtherInfo>(id: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const values = boundValues(id, data);
	return values.length > 0 && values.every(v => (RString.is(v) && v.content.str === '') || (RSymbol.is(v) && v.content === RNull)
		|| callsTagged(v, data, SemanticCallTag.Console));
}

/** The stems of the files the call names, `undefined` unless every file argument is a known path to a file with an extension (a device's `plot%03d.png` or a directory may stand for others). */
function fileStems<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, { sig, numbered }: { readonly sig?: FnSig, readonly numbered?: boolean }): string[] | undefined {
	const call = res.graph.getVertex(rootId);
	if(sig === undefined || !DfgVertex.isFunctionCall(call)) {
		return undefined;
	}
	const named = MatchArgs.findWithProps(appliedArguments(res.graph, call, data.completeAst.idMap).args, sig, ArgProp.Resource);
	const resources = sig.filter(([, p]) => (p & ArgProp.Resource) !== 0);
	if(named.length === 0 ? resources.length === 0 || resources.some(([, p]) => (p & ArgProp.Optional) === 0)
		: named.length < resources.filter(([n, p]) => n !== '...' && (p & (ArgProp.Forced | ArgProp.Optional)) === ArgProp.Forced).length) {
		return undefined;
	}
	const stems: string[] = [];
	for(const id of named) {
		if(namesNoFile(id, data)) {
			continue;
		}
		/* every `tempfile()` names a file no other call names */
		const fresh = boundValues(id, data);
		if(fresh.length > 0 && fresh.every(v => callsTagged(v, data, SemanticCallTag.TempFile))) {
			stems.push(...fresh.map(v => `tmp-${v.info.id}`));
			continue;
		}
		const paths = NodeValue.stringsOf(id, data);
		for(const path of paths?.length ? paths : ['']) {
			const [stem, ...extension] = path.split(/[/\\]/).at(-1)?.split('.') ?? [];
			if(!stem || extension.length === 0 || /[*?[]/.test(path) || (numbered && path.includes('%'))) {
				return undefined;
			}
			stems.push(stem);
		}
	}
	return stems;
}

/** What printing `value` reads: the printing `keys` for a plain value, all options for an unknown one (a tibble reads the pillar options). */
function printingReads<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, dispatches: boolean, keys: readonly BrandedIdentifier[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): AmbientStateName[] {
	const anyOption = dispatches && (value === undefined || !isPlainValue(value, data));
	return optionReads(anyOption ? undefined : keys);
}

const PlainValueTypes: ReadonlySet<string> = new Set(['number', 'string', 'logical', 'interval']);

/** whether the value at `node` is one of the base types whose printing no package method changes */
function isPlainValue<OtherInfo>(node: RNodeWithParent<OtherInfo>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(RConstant.is(node)) {
		return true;
	}
	const values = NodeValue.setOf(node.info.id, data)?.elements;
	return values !== undefined && values.length > 0 && values.every(v => typeof v.type === 'string' && PlainValueTypes.has(v.type));
}

/** The arguments of a call made on our behalf, like `do.call(par, args)`, which we cannot see. */
const UnknownArguments = Symbol('unknown-arguments');
type UnknownArguments = typeof UnknownArguments;

function applyWithUnknownArguments<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, effect: AmbientEffect): DataflowInformation {
	const { instances } = Families[effect.family];
	if(instances !== undefined && effect.access !== AmbientVerb.Reads && effect.access !== AmbientVerb.Adds) {
		/* we cannot tell which instance a close closes */
		return instanceAccess(res, rootId, data, effect, instances, true);
	} else if(effect.family === AmbientPart.Files) {
		/* the arguments handed on (`do.call(readLines, list("a.txt"))`, `lapply(files, readLines)`) may still name the files */
		return applyEffect(res, [], rootId, data, effect);
	} else if(effect.family === KeyedState.Option && changes(effect)) {
		/* like `options(op)`: it may set anything */
		res.graph.markIdForUnknownSideEffects(rootId);
	}
	const { reads, writes } = unknownArgumentAccess(effect, drawingWritesDevice(data.ctx.config));
	return withAccess(res, rootId, data, reads, writes);
}

/* evaluated code may attach a package as well, which every call nothing else resolves reads */
const Quoted = { reads: [AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette], writes: [AmbientStateName.unknownOption, AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette, AmbientStateName.allOf(KeyedState.SearchPath)] };

/** What the effect may read and write when the arguments of the call are unknown, as when only linking reveals it: any condition may hold, and any entry be named but stated ones. */
function unknownArgumentAccess(effect: AmbientEffect, drawing: boolean): { readonly reads: readonly AmbientStateName[], readonly writes: readonly AmbientStateName[] } {
	const { state, instances } = Families[effect.family];
	if(instances !== undefined) {
		return effect.access === AmbientVerb.Reads || effect.access === AmbientVerb.Adds ? instanceStateAccess(effect, state, instances) : { reads: [], writes: activeStates(instances) };
	}
	switch(effect.family) {
		case KeyedState.Option:
			if(changes(effect)) {
				return { reads: [AmbientStateName.allOptions], writes: [AmbientStateName.unknownOption, AmbientStateName.allOptions, AmbientStateName.warnsAsErrors] };
			}
			break;
		case AmbientPart.Files:
			return effect.access === AmbientVerb.Reads ? { reads: [AmbientStateName.workingDirectory, AmbientStateName.files], writes: [] }
				: { reads: [AmbientStateName.workingDirectory], writes: [AmbientStateName.anyFile, AmbientStateName.files] };
		case AmbientPart.TextConnection:
			return { reads: [], writes: [] };
		case AmbientPart.Finalizers:
			return effect.access === AmbientVerb.Reads ? { reads: [state], writes: [] } : { reads: [], writes: [state] };
	}
	const member = effect.member;
	const keys = typeof member === 'object' && member.from === 'constant' && effect.dispatchOn === undefined ? member.keys : [UnknownKey];
	const { reads, writes } = stateAccess(effect, Families[effect.family].keyed === undefined ? undefined : keys, true, drawing);
	return { reads, writes: writes.map(w => typeof w === 'string' ? w : w.name) };
}

/**
 * Opens, closes, or switches an instance of the `family` (a graphics device), each of whose states is per instance.
 * A close reads the calls that opened and used the closed instance, the explicit opening reads the close in turn, so keeping it keeps the close.
 * Within a function the open instances are unknown, so a call only adds.
 */
function deviceAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, kind: DeviceAccess, family: AmbientFamily = GraphicsDevices): DataflowInformation {
	const otherOf = (state: AmbientStateName) => family.states.find(([active]) => active === state)?.[1] ?? state;
	const actives = activeStates(family);
	/* `x <- dev.off()` is the device that is active afterward, one of the others */
	const closing = kind === DeviceAccess.Close ? [family.used, ...resultIsUsed(rootId, data) ? [otherOf(family.used)] : []] : [];
	const all = [family.used, otherOf(family.used)];
	const reads = kind === DeviceAccess.Switch ? [family.switched] : kind === DeviceAccess.CloseSome ? [family.switched, ...all] : kind === DeviceAccess.CloseAll ? all : closing;
	/* closing writes the file of the device, which its opening names unless we do not know the device closed */
	const unnamedFile = kind === DeviceAccess.Open ? [] : [AmbientStateName.anyFile, AmbientStateName.files];
	const cds = data.cds ? [...data.cds] : undefined;
	if(data.environment.level > 0) {
		/* a device the body opened itself is the one a later close in the same body closes: `f <- function() { pdf("a.pdf"); plot(1); dev.off() }` writes `a.pdf` and no other file */
		const here = kind === DeviceAccess.Close ? res.environment.current.memory.get(family.openedHere) ?? [] : [];
		for(const open of here) {
			res.graph.addEdge(open.nodeId, rootId, EdgeType.Reads);
		}
		let environment = { ...res.environment, current: res.environment.current.removeAll([{ name: family.openedHere }]) };
		if(kind === DeviceAccess.Open) {
			environment = defineAmbient(environment, rootId, cds, [{ name: family.openedHere, mode: AmbientWriteMode.Local }]);
		}
		recordAmbient(res.graph, rootId, environment, [], [], kind === DeviceAccess.Close || kind === DeviceAccess.CloseAll ? actives : []);
		return withAccess({ ...res, environment }, rootId, data, reads, [...actives, ...here.length > 0 ? [] : unnamedFile]);
	}
	const lookup = (name: AmbientStateName) => Resolve.byName(name, res.environment) ?? [];
	/* a use opening the device on the fly (`plot` without one) names no file and needs no close */
	const closed = kind === DeviceAccess.Close ? lookup(family.opened) : kind === DeviceAccess.CloseAll ? [...lookup(family.opened), ...lookup(otherOf(family.opened))] : [];
	for(const open of closed) {
		res.graph.addEdge(open.nodeId, rootId, EdgeType.Reads);
	}
	/* in a loop, an earlier round may have opened a device this one leaves behind, or a close may leave one open */
	const repeats = RLoopConstructs.encloses(rootId, data.completeAst.idMap);
	const earlierRound: IdentifierDefinition[] = repeats ? [{ nodeId: rootId, name: family.used, type: ReferenceType.Variable, definedAt: rootId, cds: cds ?? [] }] : [];
	let environment = res.environment;
	if(kind === DeviceAccess.Switch || kind === DeviceAccess.CloseSome) {
		environment = defineAmbient(environment, rootId, cds, actives);
	}
	for(const [active, others] of family.states) {
		const current = lookup(active);
		const other = lookup(others);
		switch(kind) {
			case DeviceAccess.Open:
				environment = setAmbient(environment, others, [...other, ...current, ...earlierRound]);
				environment = defineAmbient(environment, rootId, cds, [{ name: active, mode: AmbientWriteMode.Reset }]);
				break;
			case DeviceAccess.Close:
				environment = setAmbient(environment, active, repeats ? [...other, ...current] : other);
				break;
			case DeviceAccess.CloseAll:
				environment = setAmbient(setAmbient(environment, active, []), others, []);
				break;
			case DeviceAccess.Switch:
			case DeviceAccess.CloseSome:
				environment = setAmbient(setAmbient(environment, active, other, true), others, current, true);
				break;
		}
	}
	/* a close ends the state of the device it closes, all of them for every device */
	const kills = kind === DeviceAccess.Close ? actives : kind === DeviceAccess.CloseAll ? family.states.flat() : [];
	recordAmbient(res.graph, rootId, res.environment, [], kind === DeviceAccess.CloseAll ? family.states.flat() : actives, kills);
	return withAccess({ ...res, environment }, rootId, data, reads, kind === DeviceAccess.Open || closed.length > 0 ? [] : unnamedFile);
}

/** A call to `fn` made on our behalf (`do.call(fn, args)`, `sapply(x, fn)`): it accesses the state as `fn` does, or reads all of it if `fn` is opaque. */
export function applyAmbientStateOfCallee<OtherInfo>(res: DataflowInformation, callId: NodeId, fn: Identifier, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const targets = Resolve.byNameAndType(fn, data.environment, ReferenceType.Function) ?? [];
	res = applyAmbientEffects(res, UnknownArguments, callId, data, targets.flatMap(hiddenAccess));
	hiddenSideEffects(res.graph, res.environment, callId, targets);
	const unknown = (targets.length === 0 && data.environment.level === 0) || targets.some(t => t.type !== ReferenceType.BuiltInFunction && hidesBody(t));
	return unknown ? readsAllAmbientState(res, callId, data, true) : res;
}

/** The processors that write the environment from their arguments (define, remove, evaluate code): called through a parameter, `do.call`, or an apply function, what they write is unknown, so the values known so far may be stale. */
const WritesEnvironment: ReadonlySet<BuiltInProcName> = new Set([
	BuiltInProcName.Source, BuiltInProcName.Load, BuiltInProcName.Rm, BuiltInProcName.ListToEnv,
	BuiltInProcName.Assignment, BuiltInProcName.AssignmentLike, BuiltInProcName.SuperAssignment, BuiltInProcName.Eval, BuiltInProcName.Local
]);

/** The processors that change the search path: called that way, what names resolve to may change, but no value. */
const WritesSearchPath: ReadonlySet<BuiltInProcName> = new Set([BuiltInProcName.Library, BuiltInProcName.Attach, BuiltInProcName.Detach]);

/** Marks the call `callId` to the built-ins `targets` through a parameter or a variable as the unknown side effect they have, see {@link WritesEnvironment}. */
export function hiddenSideEffects(graph: DataflowGraph, environment: REnvironmentInformation, callId: NodeId, targets: readonly IdentifierDefinition[]): void {
	for(const target of targets) {
		const builtIn = target.type === ReferenceType.BuiltInFunction ? target : undefined;
		const processor = builtIn?.processorName;
		const effect = builtIn?.config?.hasUnknownSideEffects
			?? (processor !== undefined && WritesEnvironment.has(processor));
		if(effect) {
			handleUnknownSideEffect(graph, environment, callId, effect === true ? undefined : effect);
		} else if(processor !== undefined && WritesSearchPath.has(processor)) {
			graph.markIdForUnknownSideEffects(callId);
		}
	}
}

function hiddenAccess(target: IdentifierDefinition): readonly AmbientEffect[] {
	return Ambient.list(target.type === ReferenceType.BuiltInFunction ? target.config?.ambient : undefined);
}

/** The (maybe) writes of the call `callId` to the built-in `target` through a parameter, like `g <- function(f, ...) f(...); g(options, digits = 3)`. */
export function writesOfHiddenBuiltIn(target: IdentifierDefinition, callId: NodeId, drawing = false): (NamedInGraphIdentifierDefinition<AmbientStateName>)[] {
	return hiddenAccess(target).flatMap(a => unknownArgumentAccess(a, drawing).writes).map(name => ({ nodeId: callId, name, type: ReferenceType.Variable, definedAt: callId, cds: [] }));
}

/** The states the call to the built-in `target` through a parameter reads, see {@link writesOfHiddenBuiltIn}. */
export function readsOfHiddenBuiltIn(target: IdentifierDefinition): AmbientStateName[] {
	return hiddenAccess(target).flatMap(a => unknownArgumentAccess(a, false).reads);
}

function setOptions<OtherInfo>(res: DataflowInformation, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const queried: string[] = [];
	const written: AmbientStateName[] = [];
	let warnsAsErrors = false;
	let global = false;
	let unknownKeys = false;
	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		if(arg.name !== undefined) {
			const key = Identifier.getName(arg.name.content);
			written.push(AmbientStateName.option(key));
			global ||= GlobalEffectOptions.has(key);
			warnsAsErrors ||= key === 'warn' && !NodeValue.setOf(arg.value?.info.id, data)?.elements.every(value => value.type === 'logical' || (RValue.numberOf(value) ?? 2) < 2);
		} else if(RString.is(arg.value)) {
			queried.push(arg.value.content.str);
		} else {
			/* a list of options we cannot see into, usually restoring what an earlier call returned */
			unknownKeys = true;
		}
	}
	if(global || unknownKeys) {
		/* in every slice, but other than an unknown side effect, setting options leaves the variables alone */
		res.graph.markIdForUnknownSideEffects(rootId);
	}
	/* the call returns the previous values of what it sets, which only matters if that value is used */
	const previous = resultIsUsed(rootId, data) ? written : [];
	const reads: AmbientStateName[] = [...queried.map(AmbientStateName.option), ...previous];
	if(args.length === 0 || unknownKeys) {
		reads.push(AmbientStateName.allOptions);
	}
	if(reads.length > 0) {
		reads.push(AmbientStateName.unknownOption);
	}
	const writes = [...written];
	if(unknownKeys) {
		writes.push(AmbientStateName.unknownOption);
	}
	if(warnsAsErrors) {
		writes.push(AmbientStateName.warnsAsErrors);
	}
	if(writes.length > 0) {
		writes.push(AmbientStateName.allOptions);
	}
	return withAccess(res, rootId, data, reads, writes);
}

/** Whether the call to `fn` only queries the state it may set, as `par("mar")`, `options("digits")` and `palette()` do, which hand that state back visibly where setting it returns the previous one invisibly. */
export function callOnlyQueries<OtherInfo>(fn: Identifier, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], environment: REnvironmentInformation): boolean {
	const targets = Resolve.byNameAndType(fn, environment, ReferenceType.Function) ?? [];
	return targets.length > 0 && targets.every(t => onlyQueries(hiddenAccess(t), args));
}

/** Whether a call with the `effects` only queries: a change is off for the arguments `args`, and no other one happens. */
function onlyQueries<OtherInfo>(effects: readonly AmbientEffect[], args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): boolean {
	const changing = effects.filter(changes);
	return changing.some(e => e.unless !== undefined && holds(e.unless, args) === Ternary.Always) && changing.every(e => applies(e, args) === Ternary.Never);
}

/** `par()`, `par("mar", "usr")`, and `par(no.readonly = TRUE)` only query the graphics state */
function isQuery<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): boolean {
	return args.every(a => a === EmptyArgument
		|| (a.name === undefined ? RString.is(a.value) : Identifier.getName(a.name.content) === 'no.readonly'));
}

/** Whether the call's value may be used: anything but a non-final statement or the script's last statement (the last of a block is its value). */
function resultIsUsed<OtherInfo>(rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const node = data.completeAst.idMap.get(rootId);
	const parent = node === undefined ? undefined : RNode.directParent(node, data.completeAst.idMap);
	if(parent === undefined) {
		return false;
	} else if(RExpressionList.is(parent)) {
		/* a block yields its last value, which is used where the block's is */
		return parent.children.at(-1)?.info.id === rootId && !data.completeAst.ast.files.some(f => f.root.info.id === parent.info.id) && resultIsUsed(parent.info.id, data);
	} else if(RIfThenElse.is(parent)) {
		return parent.condition.info.id === rootId || resultIsUsed(parent.info.id, data);
	}
	/* a loop discards what its body yields */
	return !(RLoopConstructs.is(parent) && parent.body.info.id === rootId);
}

/** Links state reads in a loop body to the body's own writes of a later iteration and returns them, as the first iteration reads what is there before the loop. */
export function linkAmbientStateWithinLoop(graph: DataflowGraph, reads: readonly IdentifierReference[], body: DataflowInformation): IdentifierReference[] {
	const ambient = reads.filter((r): r is IdentifierReference & { name: AmbientStateName } => AmbientStateName.is(r.name));
	for(const r of ambient) {
		for(const def of Resolve.byName(r.name, body.environment) ?? []) {
			if(body.graph.hasVertex(def.nodeId)) {
				graph.addEdge(r.nodeId, def.nodeId, EdgeType.Reads);
			}
		}
	}
	return ambient;
}

/** A scoped state change (`withr`, `rlang`): `with_*` undoes it after its code, `local_*` when the calling function returns. */
export interface AmbientScope {
	/** the state the scope changes; the keyed ones (`options`, environment variables, locale) take the entries the call names */
	readonly state:     AmbientSingleState | KeyedState.Option | KeyedState.Env | KeyedState.Locale
	/** the formals in order, used to bind the arguments */
	readonly params:    readonly string[]
	/** the formal evaluated with the change in effect, absent for the `local_*` variants */
	readonly code?:     string
	/** the formal holding a list of the new values (`list(digits = 3)`), other named arguments are values too */
	readonly new?:      string
	/** the scope changes nothing, it only restores the state afterward (`with_preserve_seed`) */
	readonly preserve?: boolean
}

/** The processor for an {@link AmbientScope}. */
export function processAmbientScope<OtherInfo>(name: RSymbol<OtherInfo & ParentInformation>, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, scope: AmbientScope): DataflowInformation {
	const bound = MatchArgs.toNames(args, scope.params);
	const code = scope.code === undefined ? undefined : bound.get(scope.code);
	/* the code may be several arguments, all that fall to `...` (`capture.output(print(1), print(2))`) */
	const formals = new Set([...bound.entries()].filter(([param]) => param !== '...').map(([, arg]) => arg.info.id));
	const isCode = (arg: PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined) => arg !== undefined && arg !== EmptyArgument
		&& (scope.code === '...' ? !formals.has(arg.info.id) : arg.info.id === code?.info.id);
	const family = scopedFamily(scope.state);
	const local = code === undefined && data.environment.level > 0;
	const { writes, unknown } = scope.preserve ? { writes: local ? [{ name: singleStateOf(AmbientSingleState.Rng), mode: AmbientWriteMode.Local }] : [], unknown: false } : scopedWrites(scope, args, bound, local);
	const cds = data.cds ? [...data.cds] : undefined;
	const apply = (environment: REnvironmentInformation): REnvironmentInformation =>
		family !== undefined ? deviceAccess({ ...DataflowInformation.initialize(rootId, data), environment }, rootId, data, local ? DeviceAccess.Switch : DeviceAccess.Open, family).environment
			: defineAmbient(environment, rootId, cds, writes);

	const { information } = processKnownFunctionCall({
		name, args, rootId, data, origin:    BuiltInProcName.Default,
		patchData: (d, i) => isCode(args[i]) ? { ...d, environment: apply(d.environment) } : d
	});
	if(unknown) {
		information.graph.markIdForUnknownSideEffects(rootId);
	}
	/* the state a scope changes around its code is back afterward */
	const changed = family !== undefined ? activeStates(family) : writes;
	recordAmbient(information.graph, rootId, information.environment, [], code === undefined && !(family !== undefined && local) ? changed : changed.map(w => ({ name: typeof w === 'string' ? w : w.name, mode: AmbientWriteMode.Local })));
	if(code === undefined) {
		const applied = { ...information, environment: apply(information.environment) };
		/* the frame starts out with the state as it was */
		return scope.preserve && local ? withAccess(applied, rootId, data, [singleStateOf(AmbientSingleState.Rng)]) : applied;
	}
	/* afterward, what the scope changed is back to what it was before */
	let environment = information.environment;
	const keyed = keyedStateOf(scope);
	const restored = family !== undefined ? family.states.flat()
		: scope.state === AmbientSingleState.Rng || scope.state === AmbientSingleState.WorkingDirectory ? [singleStateOf(scope.state)]
			: writes.map(w => typeof w === 'string' ? w : w.name).filter(n => keyed !== undefined && n.startsWith(AmbientStateName.keyed(keyed, '')) && n !== AmbientStateName.keyed(keyed, UnknownKey));
	for(const state of restored) {
		const before = Resolve.byName(state, data.environment);
		/* an entry nothing set before keeps the scope's definition, we cannot tell R's default apart */
		if((before !== undefined && before.length > 0) || ((family !== undefined || scope.state === AmbientSingleState.Rng || scope.state === AmbientSingleState.WorkingDirectory) && data.environment.level === 0)) {
			environment = setAmbient(environment, state, before ?? []);
		}
	}
	if(scope.state === AmbientSingleState.Graphics) {
		/* `with_par` restores the parameters it set, what its code set with `par` stays */
		const kept = (Resolve.byName(AmbientStateName.graphics, environment) ?? []).filter(d => d.nodeId !== rootId);
		environment = setAmbient(environment, AmbientStateName.graphics, kept);
	}
	return { ...information, environment };
}

/** The family of instances a scope opens one of for its code, `with_png` a device and `capture.output` a diversion of the output. */
function scopedFamily(state: AmbientScope['state']): AmbientFamily | undefined {
	return state === AmbientSingleState.Device ? GraphicsDevices : state === AmbientSingleState.Sink ? OutputSinks : undefined;
}

/** The keyed state an {@link AmbientScope} changes the entries of, `undefined` for a state without entries. */
function keyedStateOf(scope: AmbientScope): KeyedState | undefined {
	return scope.state === KeyedState.Option || scope.state === KeyedState.Env || scope.state === KeyedState.Locale ? scope.state : undefined;
}

/** The pseudo variable of a scoped state without entries. */
function singleStateOf(state: AmbientSingleState): AmbientStateName {
	return state === AmbientSingleState.Rng ? AmbientStateName.rng : state === AmbientSingleState.WorkingDirectory ? AmbientStateName.workingDirectory : AmbientStateName.graphics;
}

/** what a scope call writes: the entries of a keyed state it names, or the state it changes as a whole */
function scopedWrites<OtherInfo>(scope: AmbientScope, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], bound: ReadonlyMap<BrandedIdentifier, RArgument<OtherInfo & ParentInformation>>, local: boolean): { writes: (AmbientStateName | AmbientWrite)[], unknown: boolean } {
	const keyed = keyedStateOf(scope);
	if(keyed === undefined) {
		const name = singleStateOf(scope.state as AmbientSingleState);
		/* only the directory is restored as a whole (withr's `local_seed` leaves the generator where the function's draws took it) */
		return { writes: [local && scope.state === AmbientSingleState.WorkingDirectory ? { name, mode: AmbientWriteMode.Local } : name], unknown: false };
	}
	const keys: BrandedIdentifier[] = [];
	let unknown = false;
	/* what falls to `...` names options, it is no formal of its own */
	const formals = new Set([...bound.entries()].filter(([param]) => param !== '...').map(([, arg]) => arg.info.id));
	const fromList = (value: RNode<OtherInfo & ParentInformation> | undefined) => {
		if(RFunctionCall.isNamed(value, ListConstructors)) {
			for(const entry of value.arguments) {
				if(entry === EmptyArgument) {
					continue;
				} else if(entry.name === undefined) {
					unknown = true;
				} else {
					keys.push(Identifier.getName(entry.name.content));
				}
			}
		} else if(value !== undefined) {
			unknown = true;
		}
	};
	if(scope.new !== undefined) {
		fromList(bound.get(scope.new)?.value);
	}
	for(const arg of args) {
		if(arg === EmptyArgument || formals.has(arg.info.id)) {
			continue;
		}
		if(arg.name !== undefined) {
			keys.push(Identifier.getName(arg.name.content));
		} else {
			fromList(arg.value);
		}
	}
	/* we do not resolve the value a scope sets, so setting `warn` may turn warnings into errors */
	const options = keyed === KeyedState.Option;
	const names = keys.map(k => AmbientStateName.keyed(keyed, k as string)).concat(options && keys.includes('warn') ? [AmbientStateName.warnsAsErrors] : []);
	if(unknown) {
		names.push(AmbientStateName.keyed(keyed, UnknownKey));
	}
	names.push(AmbientStateName.allOf(keyed));
	const writes: (AmbientStateName | AmbientWrite)[] = names.map(name => local ? { name, mode: AmbientWriteMode.Local } : name);
	return { writes, unknown: unknown || (options && keys.some(k => GlobalEffectOptions.has(k))) };
}

/** Evaluating captured code may access any state; `Quoted.finalize` drops the writes again once the code is known to change none. */
export function evaluatesCapturedCode<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	return withAccess(res, rootId, data, Quoted.reads, Quoted.writes);
}

/** What the implicit `print` of a top-level value reads (see {@link readsOfAutoPrint}): every option if a method may print it (`dispatched`). */
export function autoPrintReads(dispatched: boolean): AmbientStateName[] {
	return [...optionReads(dispatched ? undefined : PrintingOptions), AmbientStateName.sink];
}

/** what printing writes: it is part of the diversion of the output, see {@link OutputSinks} */
export const PrintWrites: readonly AmbientStateName[] = [AmbientStateName.sinkOutput];

/** R prints every visible top-level value (see {@link autoPrints}) by an implicit `print`, which reads the options the configured `print` reads for that value, and draws a plot object. */
export function readsOfAutoPrint<OtherInfo>(processed: DataflowInformation, expression: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const print = Resolve.byNameAndType('print', { current: REnvironment.findBuiltIn(data.environment.current), level: 0 }, ReferenceType.Function)?.slice(0, 1) ?? [];
	const reads = print.flatMap(hiddenAccess).flatMap(effect => effect.family === KeyedState.Option && effect.access === AmbientVerb.Reads
		? printingReads(expression, effect.dispatchOn !== undefined, typeof effect.member === 'object' && effect.member.from === 'constant' ? effect.member.keys : [], data) : []);
	return withAccess(processed, expression.info.id, data, [...reads, AmbientStateName.sink], [...PrintWrites, ...mayHoldPlot(expression, data) ? DrawsNewPlot : []]);
}

/** the processors whose calls return invisibly, although their configuration states no {@link CallProp.Invisible} */
const InvisibleProcessors: ReadonlySet<string> = new Set([BuiltInProcName.ForLoop, BuiltInProcName.WhileLoop, BuiltInProcName.RepeatLoop,
	BuiltInProcName.Assignment, BuiltInProcName.SuperAssignment, BuiltInProcName.FunctionDefinition]);

/** whether the value of the top-level `expression` is visible, so that R prints it, decided on its vertex */
export function autoPrints<OtherInfo>(expression: RNode<OtherInfo & ParentInformation>, processed: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const vertex = processed.graph.getVertex(expression.info.id);
	if(vertex === undefined || DfgVertex.isFunctionDefinition(vertex)) {
		return false;
	} else if(!DfgVertex.isFunctionCall(vertex)) {
		return true;
	} else if(Array.isArray(vertex.origin) && vertex.origin.some(o => InvisibleProcessors.has(o))) {
		return false;
	} else if(RExpressionList.is(expression) && expression.grouping?.[0].lexeme === '{' && vertex.onlyBuiltin && expression.children.length > 0) {
		/* a block hands on its last value, visible or not */
		return autoPrints(expression.children[expression.children.length - 1], processed, data);
	}
	/* `invisible`, `library`, ...: everything this resolves to returns invisibly */
	const targets = Resolve.byNameAndType(vertex.name, data.environment, ReferenceType.Function);
	return targets === undefined || targets.length === 0 || !targets.every(t => t.type === ReferenceType.BuiltInFunction && CallProps.hasAny(t.config, CallProp.Invisible));
}

/** A call through a variable bound to a built-in (`p <- par; p(...)`), only revealed when linking the statement's calls. */
export function applyAmbientStateOfCalledBuiltIns<OtherInfo>(res: DataflowInformation, callId: NodeId, builtIns: readonly NodeId[], before: REnvironmentInformation, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const call = data.completeAst.idMap.get(callId);
	if(!RFunctionCall.is(call)) {
		return res;
	}
	const known = res.unknownReferences.length;
	for(const builtIn of builtIns) {
		const targets = NodeId.isBuiltIn(builtIn) ? Resolve.byNameAndType(NodeId.fromBuiltIn(builtIn), before, ReferenceType.Function) ?? [] : [];
		res = applyAmbientEffects(res, call.arguments, callId, data, targets.flatMap(hiddenAccess));
		hiddenSideEffects(graph, before, callId, targets);
	}
	const access = res.graph.ambientAccessOf(callId);
	if(access !== undefined && res.graph !== graph) {
		graph.recordAmbientAccess(callId, AmbientAccess.names(access));
	}
	for(const read of res.unknownReferences.slice(known)) {
		for(const def of Resolve.byName(read.name, before) ?? []) {
			graph.addEdge(read.nodeId, def.nodeId, EdgeType.Reads);
		}
	}
	return res;
}

/** The writes that may set `warn` to 2 or more before or within what turns `before` into `after`. */
function warnsAsErrorsSources(after: REnvironmentInformation, before: REnvironmentInformation): Set<NodeId> {
	const lookup = (name: AmbientStateName) => [...Resolve.byName(name, before) ?? [], ...Resolve.byName(name, after) ?? []];
	const marked = new Set(lookup(AmbientStateName.warnsAsErrors).map(d => d.nodeId));
	return new Set([...lookup(AmbientStateName.option('warn')).filter(d => marked.has(d.nodeId)), ...lookup(AmbientStateName.unknownOption)].map(d => d.nodeId));
}

/** With `warn >= 2` R turns warnings into errors, so whatever may warn in `block` is a maybe error exit reading the options that may set `warn`. */
export function errorsOfWarnings<OtherInfo>(block: RNode<OtherInfo & ParentInformation>, after: REnvironmentInformation, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): ExitPoint[] {
	const sources = warnsAsErrorsSources(after, data.environment);
	if(sources.size === 0) {
		return [];
	}
	const cds = data.cds ? [...data.cds] : [];
	return warningSites(block, graph, data, new Map(), { muffled: true, link: true }).map(site => {
		for(const source of sources) {
			graph.addEdge(site, source, EdgeType.Reads);
		}
		return { type: ExitPointType.Error, nodeId: site, cds };
	});
}

/** What may signal a condition of the class `name` when `block` runs, which a handler for it depends on: everything that may warn, and for any class other than a warning also what muffles warnings, as that lets other conditions through. */
export function signalSites<OtherInfo>(block: RNode<OtherInfo & ParentInformation>, name: BrandedIdentifier, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, link: boolean): NodeId[] {
	return warningSites(block, graph, data, new Map(), { muffled: name === 'warning', link });
}

/** the classes of an error R raises on its own, as for arguments a closure does not take */
const ErrorClasses: readonly string[] = ['simpleError', 'error', 'condition'];

/** Whether running `block` may signal a condition a handler for the class `condition` catches, so whether the handler may run. */
export function maySignal<OtherInfo>(block: RNode<OtherInfo & ParentInformation>, condition: BrandedIdentifier, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, after: REnvironmentInformation): boolean {
	if(condition === 'interrupt') {
		return true;
	}
	const signal = { condition, warningsAreErrors: warnsAsErrorsSources(after, data.environment).size > 0 };
	return warningSites(block, graph, data, new Map(), { muffled: condition === 'warning', link: false, signal }).length > 0;
}

/** How {@link warningSites} collects: `muffled` leaves out what muffles warnings, `link` has a call read what may warn in the body it runs instead of listing that. */
interface WarningSiteMode {
	readonly muffled: boolean
	readonly link:    boolean
	readonly signal?: {
		readonly condition:         string
		readonly warningsAreErrors: boolean
	}
}

/** Whether a handler for `signal` catches a condition of the `classes`. */
function catches(signal: NonNullable<WarningSiteMode['signal']>, classes: readonly string[]): boolean {
	return classes.includes(signal.condition) || (signal.warningsAreErrors && classes.includes('warning') && ErrorClasses.includes(signal.condition));
}

/** The classes the call `call` of the built-in `targets` signals, if it states them and is handed nothing but constants. */
function signaledClasses(call: RFunctionCall<ParentInformation>, targets: readonly IdentifierDefinition[]): readonly string[] | undefined {
	const [target] = targets;
	const signals = targets.length === 1 && target.type === ReferenceType.BuiltInFunction ? target.config?.signals : undefined;
	return signals !== undefined && call.arguments.every(a => a !== EmptyArgument && RConstant.is(a.value)) ? signals : undefined;
}

/** Whether reading the variable `symbol` may signal: it may force a promise, be an active binding, or not exist. */
function readMaySignal(symbol: RSymbol<ParentInformation>, graph: DataflowGraph, environment: REnvironmentInformation, idMap: AstIdMap): boolean {
	/* the body of a closure the block calls is not part of the graph of the block */
	const vertex = graph.getVertex(symbol.info.id);
	if(vertex === undefined ? NotRead.has(symbol.info.role) || (symbol.info.role === RoleInParent.BinaryOperationLhs && assigns(RNode.directParent(symbol, idMap))) : !DfgVertex.isUse(vertex)) {
		return false;
	}
	const definitions = Resolve.byName(symbol.content, environment) ?? [];
	return definitions.length === 0 || definitions.some(d => {
		if(isReferenceType(d.type, ReferenceType.BuiltInConstant | ReferenceType.BuiltInFunction)) {
			return false;
		}
		const at = idMap.get(d.nodeId);
		const by = at && RNode.directParent(at, idMap);
		/* an assignment operator evaluates its value right away */
		return !assigns(by);
	});
}

/** the places a symbol names something rather than reads it */
const NotRead: ReadonlySet<RoleInParent> = new Set([RoleInParent.FunctionCallName, RoleInParent.ParameterName, RoleInParent.ArgumentName, RoleInParent.ForVariable]);

function assigns(node: RNode<ParentInformation> | undefined): boolean {
	return RBinaryOp.is(node) && RBinaryOp.getOperatorInfo(node)?.usedAs === OperatorUsedAs.Assignment;
}

/** Whether a call of the closure `definition` errs for its arguments alone, as one it has no parameter for. */
function rejectsArguments(definition: RFunctionDefinition<ParentInformation>, call: RFunctionCall<ParentInformation>): boolean {
	const names = definition.parameters.map(p => Identifier.getName(p.name.content));
	if(names.includes('...')) {
		return false;
	}
	const given = call.arguments.filter(a => a !== EmptyArgument);
	return given.length > names.length || given.some(a => a.name !== undefined && !names.some(n => n.startsWith(Identifier.getName(a.name?.content ?? ''))));
}

/** what may warn when `root` runs, see {@link WarningSiteMode}, `bodies` holds what may in the bodies of the closures seen so far */
function warningSites<OtherInfo>(root: RNode<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, bodies: Map<NodeId, readonly NodeId[]>, mode: WarningSiteMode): NodeId[] {
	const sites: NodeId[] = [];
	const { signal } = mode;
	RNode.visitAst(root, node => {
		if(RFunctionDefinition.is(node)) {
			return true;
		} else if(RBinaryOp.is(node) ? RBinaryOp.getOperatorInfo(node)?.usedAs !== OperatorUsedAs.Assignment : RUnaryOp.is(node) || RAccess.is(node)) {
			sites.push(node.info.id);
		} else if(signal !== undefined && (RSymbol.is(node) ? readMaySignal(node, graph, data.environment, data.completeAst.idMap) : testsValue(node))) {
			sites.push(node.info.id);
		} else if(RFunctionCall.is(node)) {
			const targets = node.named ? Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function) ?? [] : [];
			const classes = signal === undefined ? undefined : signaledClasses(node, targets);
			if(signal !== undefined && classes !== undefined) {
				if(catches(signal, classes)) {
					sites.push(node.info.id);
				}
				return false;
			}
			if(mode.muffled && RFunctionCall.isNamed(node, 'suppressWarnings') && targets.every(t => NodeId.isBuiltIn(t.nodeId))) {
				return true;
			}
			const handlers = mode.muffled ? muffledHandlers(node, graph, data) : undefined;
			if(handlers !== undefined) {
				sites.push(...handlers.flatMap(h => warningSites(h, graph, data, bodies, mode)));
				return true;
			}
			/* a name the construct does not see, as a global called in a function body, runs what the linker bound to the call */
			const callees = targets.length === 0 ? Dataflow.calleeIdsOf(graph, node.info.id).map(id => data.completeAst.idMap.get(id))
				: targets.flatMap(t => hidesBody(t) ? [undefined] : (t as Partial<InGraphIdentifierDefinition>).value?.map(id => data.completeAst.idMap.get(id)) ?? [undefined]);
			if(callees.length === 0 || !callees.every(RFunctionDefinition.is)) {
				sites.push(node.info.id);
				return false;
			}
			if(signal !== undefined && ErrorClasses.includes(signal.condition) && callees.some(c => rejectsArguments(c, node))) {
				sites.push(node.info.id);
			}
			/* the body runs in the function's own scope, we resolve what it calls where the construct is, which is where most functions live */
			const within = callees.flatMap(c => bodySites(c, graph, data, bodies, mode));
			if(!mode.link) {
				sites.push(...within);
				return false;
			}
			for(const site of within) {
				graph.addEdge(node.info.id, site, EdgeType.Reads);
			}
			if(within.length > 0) {
				sites.push(node.info.id);
			}
		}
		return false;
	});
	return sites;
}

/** Whether `node` branches or loops on a value that is not a constant, which R may reject (`if(NA)`). */
function testsValue(node: RNode<ParentInformation>): boolean {
	const tested = RIfThenElse.is(node) || RWhileLoop.is(node) ? node.condition : RForLoop.is(node) ? node.vector : undefined;
	return tested !== undefined && !RConstant.is(tested);
}

/** The handlers of a `withCallingHandlers` whose first handler muffles every `warning` of its `expr`, `undefined` otherwise. */
function muffledHandlers<OtherInfo>(call: RFunctionCall<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): RNode<OtherInfo & ParentInformation>[] | undefined {
	const vertex = graph.getVertex(call.info.id);
	if(!DfgVertex.isFunctionCall(vertex) || !callsBuiltIn(call, 'withCallingHandlers', BuiltInProcName.Try, graph, data)) {
		return undefined;
	}
	const handlers = MatchArgs.toSpec(vertex.args, { expr: 'expr', '...': '...' }).get('...') ?? [];
	const first = vertex.args.filter(RArgument.isNotEmpty).find(a => handlers.includes(a.nodeId));
	const handler = first?.name === 'warning' ? data.completeAst.idMap.get(first.nodeId) : undefined;
	const fn = RArgument.is(handler) ? handler.value : undefined;
	const body = RFunctionDefinition.is(fn) ? fn.body : undefined;
	const start = RExpressionList.is(body) ? body.children[0] : body;
	const restart = RFunctionCall.is(start) && callsBuiltIn(start, 'invokeRestart', BuiltInProcName.Default, graph, data) && start.arguments.length === 1 ? start.arguments[0] : undefined;
	const muffles = NodeValue.stringsOf(RArgument.valueOf(restart)?.info.id, data)?.join() === 'muffleWarning';
	return muffles ? handlers.map(h => data.completeAst.idMap.get(h)).filter(isNotUndefined) : undefined;
}

/** whether `call` surely calls the built-in `name`, its `origin` telling that nothing in between shadows it */
function callsBuiltIn<OtherInfo>(call: RFunctionCall<OtherInfo & ParentInformation>, name: BrandedIdentifier, origin: BuiltInProcName, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(!DfgVertex.hasOrigin(graph.getVertex(call.info.id), origin)) {
		return false;
	}
	const targets = call.named ? Resolve.byNameAndType(call.functionName.content, data.environment, ReferenceType.Function) : undefined;
	return targets !== undefined && targets.length > 0 && targets.every(t => t.nodeId === NodeId.toBuiltIn(name));
}

/** what may warn in the body of the closure `definition`, cached in `bodies` */
function bodySites<OtherInfo>(definition: RFunctionDefinition<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, bodies: Map<NodeId, readonly NodeId[]>, mode: WarningSiteMode): readonly NodeId[] {
	let sites = bodies.get(definition.info.id);
	if(sites === undefined) {
		/* a recursive call adds nothing to what the body may warn about */
		bodies.set(definition.info.id, []);
		sites = warningSites(definition.body, graph, data, bodies, mode);
		bodies.set(definition.info.id, sites);
	}
	return sites;
}
