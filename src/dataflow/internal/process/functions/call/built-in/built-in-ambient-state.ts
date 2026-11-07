import type { DataflowProcessorInformation } from '../../../../../processor';
import { type ControlDependency, DataflowInformation, type ExitPoint, ExitPointType } from '../../../../../info';
import type { ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { type DataflowGraphVertexFunctionCall, DfgVertex } from '../../../../../graph/vertex';
import { ArgProp, CallProp, CallProps, type FnSig, SemanticCallTag } from '../../../../../environments/built-in-props';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { Identifier, type IdentifierDefinition, type IdentifierReference, type InGraphIdentifierDefinition, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import { type Environment, REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import { applyCdsToDefinitions } from '../../../../../environments/reference-to-maybe';
import { RConstant, RLoopConstructs, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RValue, type Value } from '../../../../../eval/values/r-value';
import { MatchArgs } from '../../../../../graph/match-args';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { appliedArguments } from '../../../../../graph/applied-arguments';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import type { LinkTo } from '../../../../../../queries/catalog/call-context-query/call-context-query-format';
import type { DataflowGraph } from '../../../../../graph/graph';
import type { FlowrConfig } from '../../../../../../config';
import { EdgeType } from '../../../../../graph/edge';
import { isNotUndefined } from '../../../../../../util/assert';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNull } from '../../../../../../r-bridge/lang-4.x/convert-values';
import { RIfThenElse } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { uniqueArray, uniqueArrayMerge } from '../../../../../../util/collections/arrays';
import { AmbientStateName, KeyedAccumulators, KeyedState, UnknownKey } from '../../../../../environments/ambient-state-name';
import { type AmbientKeys, keysOf, keyedWrites, stringValuesOf } from './built-in-ambient-keys';
import { OperatorUsedAs } from '../../../../../environments/default-builtin-config/operators';

const ListConstructors: ReadonlySet<string> = new Set(['list', 'c']);

const DeviceStates = [AmbientStateName.graphics, AmbientStateName.otherDevices, AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy];

const Accumulating: ReadonlySet<string> = new Set([
	...DeviceStates, AmbientStateName.canvas, AmbientStateName.palette, AmbientStateName.allOptions, AmbientStateName.unknownOption,
	AmbientStateName.warnsAsErrors, AmbientStateName.files, AmbientStateName.rngKind, AmbientStateName.finalizers, ...KeyedAccumulators
]);

/**
 * A write other than the default: `local` binds in the current frame only (`withr::local_options`), `reset` replaces an accumulating state (a new device), `maybe` may not happen.
 * An `assumed` write is one only assumed of a body flowR cannot see, see {@link isAssumedWrite}.
 */
interface AmbientWrite {
	readonly name:     string
	readonly mode:     'local' | 'reset' | 'maybe'
	readonly assumed?: true
}

/** Whether `definition` is a write only assumed of a body flowR cannot see, like `#rng` for `function(f) f()`, other than the one of `set.seed(1)`. */
export function isAssumedWrite(definition: IdentifierDefinition): boolean {
	return (definition as { assumed?: true }).assumed === true;
}

/** a write that may not happen: it reads what was there, so it can still replace the state and keep everything before reachable */
function maybe(name: string): AmbientWrite {
	return { name, mode: 'maybe' };
}

/** what reading the options `keys` reads, every option if the keys are unknown */
function optionReads(keys: readonly string[] | undefined): string[] {
	return keys === undefined ? [AmbientStateName.allOptions] : [...keys.map(AmbientStateName.option), AmbientStateName.unknownOption];
}

/** Whether calling `definition` runs a body flowR cannot see: a library function's, or whatever a parameter is bound to. */
export function hidesBody(definition: IdentifierDefinition): boolean {
	return NodeId.isBuiltIn(definition.nodeId) || isReferenceType(definition.type, ReferenceType.Parameter | ReferenceType.Argument);
}

/**
 * Whether the call `call` of a function body reaches a built-in only once linked where the function is called, through a parameter
 * or a name the body cannot resolve. Through a variable (`p <- par; p(...)`) the body applied the built-in already, see {@link applyAmbientStateOfCalledBuiltIns}.
 */
export function reachesBuiltInLate(call: DataflowGraphVertexFunctionCall): boolean {
	const definitions = call.environment === undefined ? [] : Resolve.byNameAndType(call.name, call.environment, ReferenceType.Function) ?? [];
	return definitions.length === 0 || definitions.some(hidesBody);
}

/** A call into code flowR cannot see may read any option, draw random numbers (with `draws` advancing the generator), and with `graphics` draw on the device. */
export function readsAllAmbientState<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, graphics: boolean, draws = true): DataflowInformation {
	const reads: string[] = [AmbientStateName.allOptions, AmbientStateName.rng, AmbientStateName.allOf(KeyedState.Env)];
	if(graphics) {
		reads.push(AmbientStateName.graphics, AmbientStateName.palette);
	}
	return withAccess(res, rootId, data, reads, draws ? [{ ...maybe(AmbientStateName.rng), assumed: true }] : []);
}

/** Adds the reads and writes of the ambient state to what a call does, see {@link AmbientStateName}. */
function withAccess<OtherInfo>(
	res: DataflowInformation,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	reads: readonly string[],
	writes: readonly (string | AmbientWrite)[] = []
): DataflowInformation {
	if(reads.length === 0 && writes.length === 0) {
		return res;
	}
	const cds = data.cds ? [...data.cds] : undefined;
	const maybeWritten = writes.flatMap(w => typeof w === 'object' && w.mode === 'maybe' ? [w.name] : []);
	const readRefs: IdentifierReference[] = uniqueArrayMerge(reads, maybeWritten).map(name => ({ nodeId: rootId, name, type: ReferenceType.Variable, cds }));
	recordAmbient(res.graph, rootId, res.environment, readRefs.map(r => r.name as string), writes);
	/* the writes stay out of `out`: an assignment reads whatever else its source writes (`x <- y <- 3`) */
	return {
		...res,
		unknownReferences: readRefs.length > 0 ? [...res.unknownReferences, ...readRefs] : res.unknownReferences,
		environment:       defineAmbient(res.environment, rootId, cds, writes)
	};
}

/** Whether the write of `name` binds in the current frame only, see {@link AmbientWrite}. */
function writesLocally(environment: REnvironmentInformation, name: string, mode: AmbientWrite['mode'] | undefined): boolean {
	return mode === 'local' || (environment.level > 0 && environment.current.memory.has(name as never));
}

/** Notes in `graph` what the call `rootId` reads and writes, see {@link DataflowGraph#recordAmbientAccess}; `environment` is the one the writes apply to. */
function recordAmbient(graph: DataflowGraph, rootId: NodeId, environment: REnvironmentInformation, reads: readonly string[], writes: readonly (string | AmbientWrite)[]): void {
	if(reads.length === 0 && writes.length === 0) {
		return;
	}
	const global: string[] = [];
	const assumed: string[] = [];
	const local: string[] = [];
	for(const write of writes) {
		const { name, mode, assumed: isAssumed } = typeof write === 'string' ? { name: write, mode: undefined, assumed: undefined } : write;
		(writesLocally(environment, name, mode) ? local : isAssumed ? assumed : global).push(name);
	}
	graph.recordAmbientAccess(rootId, { reads, writes: global, assumed, local });
}

/** Applies the writes of the call `rootId` to the environment, see {@link withAccess}. */
function defineAmbient(environment: REnvironmentInformation, rootId: NodeId, cds: readonly ControlDependency[] | undefined, writes: readonly (string | AmbientWrite)[]): REnvironmentInformation {
	for(const write of writes) {
		const { name, mode, assumed } = typeof write === 'string' ? { name: write, mode: undefined, assumed: undefined } : write;
		const accumulates = Accumulating.has(name) || name.startsWith(AmbientStateName.file(''));
		/* an assumed write keeps what the body wrote before, which, other than it, surely happened */
		const keep = (accumulates && (mode === undefined || mode === 'maybe')) || assumed === true;
		/* an accumulating state only ever grows, its definitions are maybe so merging environments keeps them all; a reset is definite */
		const isMaybe = keep || (accumulates && mode !== 'reset');
		const def: InGraphIdentifierDefinition & { name: string, assumed?: true } = {
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
function defineRecorded(graph: DataflowGraph, environment: REnvironmentInformation, rootId: NodeId, cds: readonly ControlDependency[] | undefined, writes: readonly (string | AmbientWrite)[]): REnvironmentInformation {
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
	const holders = (Resolve.byName(AmbientStateName.finalizers, environment) ?? []).map(d => (d as { holder?: string }).holder);
	const released = holders.some(h => h === undefined || names === undefined || names.some(n => Identifier.getName(n) === h));
	return released ? defineRecorded(graph, environment, rootId, cds, [AmbientStateName.finalizers]) : environment;
}

function* ambientDefinitionsBetween(after: REnvironmentInformation, before: REnvironmentInformation, skipUnchanged: boolean): Generator<[string, NodeId]> {
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
export function ambientWritesBetween(after: REnvironmentInformation, before: REnvironmentInformation): string[] {
	const names = new Set<string>();
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
	const forces = definitions.flatMap(d => (d as { forces?: readonly string[] }).forces ?? []);
	return withAccess(res, symbol.info.id, data, ambientReadsOfSymbol(symbol, data, forcing), forces.map(maybe));
}

/** Binds `name` (globally) to the given definitions, in addition to what it holds with `keep`, so `#graphics` can become what another state holds. */
function setAmbient(environment: REnvironmentInformation, name: string, definitions: readonly IdentifierDefinition[], keep = false): REnvironmentInformation {
	if(definitions.length === 0 && !keep) {
		return { ...environment, current: environment.current.removeAll([{ name }]) };
	}
	for(const [i, def] of definitions.entries()) {
		environment = REnvironment.define({ ...def, name }, true, environment, keep || i > 0);
	}
	return environment;
}

/** A variable a text connection writes reads what is written to connections, `.Random.seed` reads the generator state, and `.Options` the options, see {@link optionsVariableReads}. */
function ambientReadsOfSymbol<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, forcing: boolean): string[] {
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
function optionsVariableReads<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] {
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
const GlobalEffectOptions: ReadonlySet<string> = new Set([
	'scipen', 'OutDec', 'warn', 'error', 'expressions', 'encoding', 'stringsAsFactors', 'timeout', 'HTTPUserAgent',
	'download.file.method', 'download.file.extra', 'internet.info', 'warnPartialMatchArgs', 'warnPartialMatchAttr',
	'warnPartialMatchDollar', 'keep.source', 'keep.parse.data', 'check.bounds', 'CBoundsCheck', 'catch.script.errors',
	'defaultPackages', 'topLevelEnvironment', 'java.parameters'
]);

/** Environment variables R or a child process reads by itself: the time zone, locale, library paths, temp dir, search path, proxies. */
const GlobalEffectEnv = /^(TZ|LANG|LANGUAGE|LC_\w+|R_\w+|TMPDIR|TEMP|TMP|HOME|PATH|SHELL|\w*_proxy|\w*_PROXY|no_proxy|NO_PROXY)$/;

/** What reading the given entries of `state` reads: each entry and the writes we cannot name, all of the state if no entry is known. */
function keyedReads(state: KeyedState, keys: readonly string[]): string[] {
	return keys.length === 0 || keys.includes(UnknownKey) ? [AmbientStateName.allOf(state)] : [...keys.map(k => AmbientStateName.keyed(state, k)), AmbientStateName.keyed(state, UnknownKey)];
}

/** Options that affect how values are printed and formatted (read by `print`, `format`, and `cat`). */
export const PrintingOptions: readonly string[] = ['digits', 'width', 'max.print', 'digits.secs', 'useFancyQuotes'];

/** How a call accesses the {@link AmbientStateName|ambient state}. */
export const enum AmbientStateAccessType {
	/** `options(...)`: named arguments set options, unnamed strings query them, anything else sets unknown options */
	SetOptions   = 'set-options',
	/** `getOption(x)`: reads the option named by the first argument */
	GetOption    = 'get-option',
	/** reads the given options, like `cat` reads `digits` (see {@link AmbientStateAccess#dispatchOn} for `print`) */
	ReadOptions  = 'read-options',
	/** writes the graphics state, unless all arguments are unnamed strings (see {@link AmbientStateAccess#queryOnUnnamedStrings}) */
	SetGraphics  = 'set-graphics',
	/** writes the palette, which all devices share; without arguments it only reads it */
	SetPalette   = 'set-palette',
	/** reads the graphics state and the palette, like every plot does */
	ReadGraphics = 'read-graphics',
	/** opens a device, which starts with a fresh graphics state */
	OpenDevice   = 'open-device',
	/** closes a device (or all of them), returning to the state of another open device */
	CloseDevice  = 'close-device',
	/** makes another open device the active one */
	SwitchDevice = 'switch-device',
	/** evaluates its unevaluated argument, like `evalq`, see {@link evaluatesCapturedCode} */
	EvaluateQuoted = 'evaluate-quoted',
	/** sets the state of the random number generator, like `set.seed`, and its kind from the arguments at {@link AmbientStateAccess#kindFrom} on */
	SetRng       = 'set-rng',
	/** draws from the random number generator, which reads its state and advances it, like `runif` */
	DrawRng      = 'draw-rng',
	/** reads a file, like `read.csv`, so it sees what was written to the files before */
	ReadFiles    = 'read-files',
	/** writes a file, like `write.csv` */
	WriteFiles   = 'write-files',
	/** `setwd(dir)`: changes the working directory, returning the previous one */
	SetWorkingDirectory = 'set-working-directory',
	/** `getwd()`: reads the working directory */
	GetWorkingDirectory = 'get-working-directory',
	/** `textConnection(object, open)`: opened for writing, it binds the variable `object` names to what is written to it */
	OpenTextConnection = 'open-text-connection',
	/** `reg.finalizer(e, f)`: registers `f` to run once `e` is released */
	RegisterFinalizer = 'register-finalizer',
	/** `gc()`: may run every registered finalizer whose object is released */
	RunFinalizers = 'run-finalizers',
	/** sets entries of a keyed state, like `Sys.setenv(A = "1")` sets the environment variable `A`, see {@link AmbientKeys} */
	SetKeyed     = 'set-keyed',
	ReadKeyed    = 'read-keyed',
	/** sets a state without entries, like `sink(file)` diverts the output */
	SetState     = 'set-state',
	/** reads a state without entries, like `search()` reads the search path */
	ReadState    = 'read-state'
}

/** An {@link AmbientStateAccessType} together with what refines it for some of the types. */
export type AmbientStateAccess = {
	readonly type: AmbientStateAccessType.SetOptions | AmbientStateAccessType.GetOption | AmbientStateAccessType.ReadGraphics
		| AmbientStateAccessType.SetPalette | AmbientStateAccessType.OpenDevice | AmbientStateAccessType.SwitchDevice
		| AmbientStateAccessType.DrawRng | AmbientStateAccessType.SetWorkingDirectory | AmbientStateAccessType.GetWorkingDirectory | AmbientStateAccessType.OpenTextConnection | AmbientStateAccessType.RegisterFinalizer | AmbientStateAccessType.RunFinalizers
} | {
	readonly type:      AmbientStateAccessType.ReadFiles | AmbientStateAccessType.WriteFiles
	/** the signature whose {@link ArgProp.Resource} arguments name the files, absent if they do not name them exactly (like a glob) */
	readonly sig?:      FnSig
	/** a device numbers the files of its pages with a `%d` in the name (`plot%03d.png`) */
	readonly numbered?: boolean
} | {
	readonly type:      AmbientStateAccessType.SetRng
	/** the position from which on (unnamed) arguments, and every argument named other than `seed`, set the kind of generator */
	readonly kindFrom?: number
} | {
	readonly type:        AmbientStateAccessType.ReadOptions
	readonly keys:        readonly string[]
	/** the argument `print(x)` dispatches on: a package method may read any option unless the value is plain */
	readonly dispatchOn?: number
} | {
	readonly type: AmbientStateAccessType.EvaluateQuoted
} | {
	readonly type: AmbientStateAccessType.CloseDevice
	/** `graphics.off()` closes every device */
	readonly all?: boolean
} | {
	readonly type:  AmbientStateAccessType.SetKeyed
	readonly state: KeyedState
	readonly keys:  AmbientKeys
} | {
	readonly type:  AmbientStateAccessType.ReadState
	readonly state: string
} | {
	/** reads the entries the call names, like `Sys.getenv("HOME")`, all of them if it names none */
	readonly type:  AmbientStateAccessType.ReadKeyed
	readonly state: KeyedState
	readonly keys:  AmbientKeys
} | {
	readonly type:                   AmbientStateAccessType.SetState
	/** the pseudo variable the call sets, like {@link AmbientStateName.sink} */
	readonly state:                  string
	/** `Sys.umask()` only queries the state */
	readonly queryWithoutArguments?: boolean
} | {
	readonly type:                   AmbientStateAccessType.SetGraphics
	/** `par()` and `par("mar")` only query the state */
	readonly queryOnUnnamedStrings?: boolean
	/** the parameters the call sets, which each have a pseudo variable of their own, see {@link KeyedState.Par} */
	readonly keys?:                  AmbientKeys
	/** a query also reads what the last plot left behind (`par("usr")`), linked like an unknown side effect */
	readonly queryLinksTo?:          LinkTo<RegExp | string>
};

/** Whether a call drawing on a device writes its canvas, see `semantics.ambient.drawingWritesDevice`. */
export function drawingWritesDevice(config: FlowrConfig): boolean {
	return config.semantics.ambient?.drawingWritesDevice === true;
}

/** Wires the {@link AmbientStateAccess} of a call into its dataflow information: reads become unknown references, writes define the pseudo variable globally. */
export function applyAmbientStateAccess<OtherInfo>(
	res: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] | UnknownArguments,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	access: AmbientStateAccess | readonly AmbientStateAccess[]
): DataflowInformation {
	if(!('type' in access)) {
		return access.reduce((r, a) => applyAmbientStateAccess(r, args, rootId, data, a), res);
	} else if(args === UnknownArguments) {
		return applyWithUnknownArguments(res, rootId, data, access);
	}
	const reads: string[] = [];
	const writes: string[] = [];
	switch(access.type) {
		case AmbientStateAccessType.ReadGraphics:
			reads.push(AmbientStateName.graphics, AmbientStateName.palette);
			if(drawingWritesDevice(data.ctx.config)) {
				writes.push(AmbientStateName.canvas);
			}
			break;
		case AmbientStateAccessType.SetGraphics:
			/* the call returns the previous state */
			reads.push(AmbientStateName.graphics);
			if(onlyQueries(access, args)) {
				if(access.queryLinksTo) {
					handleUnknownSideEffect(res.graph, res.environment, rootId, access.queryLinksTo);
				}
			} else {
				writes.push(AmbientStateName.graphics, ...access.keys === undefined ? [] : keyedWrites(KeyedState.Par, keysOf(access.keys, args, data)));
			}
			break;
		case AmbientStateAccessType.SetPalette:
			reads.push(AmbientStateName.palette);
			if(!onlyQueries(access, args)) {
				writes.push(AmbientStateName.palette);
			}
			break;
		case AmbientStateAccessType.ReadOptions: {
			const dispatched = access.dispatchOn === undefined ? undefined : RArgument.valueOf(args[access.dispatchOn]);
			reads.push(...printingReads(dispatched, access.dispatchOn !== undefined, access.keys, data));
			break;
		}
		case AmbientStateAccessType.GetOption: {
			const first = args.find(a => a !== EmptyArgument && (a.name === undefined || Identifier.getName(a.name.content) === 'x'));
			reads.push(...optionReads(stringValuesOf(RArgument.valueOf(first), data)));
			break;
		}
		case AmbientStateAccessType.SetOptions:
			return setOptions(res, args, rootId, data);
		case AmbientStateAccessType.SetKeyed: {
			const keys = keysOf(access.keys, args, data);
			/* a variable R or a child process reads by itself is read by calls we cannot name */
			if(access.state === KeyedState.Env && keys.some(k => k === UnknownKey || GlobalEffectEnv.test(k))) {
				res.graph.markIdForUnknownSideEffects(rootId);
			}
			writes.push(...keyedWrites(access.state, keys));
			break;
		}
		case AmbientStateAccessType.ReadKeyed:
			reads.push(...keyedReads(access.state, keysOf(access.keys, args, data)));
			break;
		case AmbientStateAccessType.SetState:
			if(!onlyQueries(access, args)) {
				writes.push(access.state);
			}
			break;
		case AmbientStateAccessType.ReadState:
			reads.push(access.state);
			break;
		case AmbientStateAccessType.OpenDevice:
			return deviceAccess(res, rootId, data, 'open');
		case AmbientStateAccessType.CloseDevice:
			/* `dev.off(which)` may close a device other than the active one, which keeps its state then */
			return deviceAccess(res, rootId, data, access.all ? 'close-all' : args.length > 0 ? 'switch' : 'close');
		case AmbientStateAccessType.SwitchDevice:
			return deviceAccess(res, rootId, data, 'switch');
		case AmbientStateAccessType.EvaluateQuoted:
			return evaluatesCapturedCode(res, rootId, data);
		case AmbientStateAccessType.SetRng: {
			const kindFrom = access.kindFrom ?? 1;
			reads.push(AmbientStateName.rngKind);
			if(kindFrom > 0) {
				writes.push(AmbientStateName.rng);
			}
			/* a new kind reseeds the generator from its current state, so it changes the stream as well */
			if(args.some((a, i) => a !== EmptyArgument && (a.name === undefined ? i >= kindFrom : Identifier.getName(a.name.content) !== 'seed'))) {
				reads.push(AmbientStateName.rng);
				writes.push(AmbientStateName.rngKind, AmbientStateName.rng);
			}
			break;
		}
		case AmbientStateAccessType.DrawRng:
			reads.push(AmbientStateName.rng);
			writes.push(AmbientStateName.rng);
			break;
		case AmbientStateAccessType.ReadFiles: {
			const stems = fileStems(res, rootId, data, access);
			if(stems?.length === 0) {
				break;
			}
			reads.push(AmbientStateName.workingDirectory, ...stems === undefined ? [AmbientStateName.files] : [...stems.map(AmbientStateName.file), AmbientStateName.anyFile]);
			/* a read through a connection the program holds moves its position, so the next read depends on this one */
			if(readsThroughHandle(res, rootId, data, access.sig)) {
				writes.push(...stems === undefined ? [AmbientStateName.anyFile, AmbientStateName.files] : stems.map(AmbientStateName.file));
			}
			break;
		}
		case AmbientStateAccessType.WriteFiles: {
			const stems = fileStems(res, rootId, data, access);
			if(stems?.length === 0) {
				break;
			}
			reads.push(AmbientStateName.workingDirectory);
			writes.push(...stems === undefined ? [AmbientStateName.anyFile] : stems.map(AmbientStateName.file), AmbientStateName.files);
			break;
		}
		case AmbientStateAccessType.SetWorkingDirectory:
			/* a relative `dir` resolves against the current one, which the call also returns */
			reads.push(AmbientStateName.workingDirectory);
			writes.push(AmbientStateName.workingDirectory);
			break;
		case AmbientStateAccessType.GetWorkingDirectory:
			reads.push(AmbientStateName.workingDirectory);
			break;
		case AmbientStateAccessType.OpenTextConnection:
			return openTextConnection(res, args, rootId, data);
		case AmbientStateAccessType.RegisterFinalizer:
			return registerFinalizer(res, args, rootId, data);
		case AmbientStateAccessType.RunFinalizers: {
			const registered = (Resolve.byName(AmbientStateName.finalizers, data.environment) ?? []) as (InGraphIdentifierDefinition & { writes?: readonly string[] })[];
			for(const fn of registered.flatMap(d => d.value ?? [])) {
				res.graph.addEdge(rootId, fn, EdgeType.Calls);
			}
			return withAccess(res, rootId, data, [AmbientStateName.finalizers], registered.flatMap(d => d.writes ?? []).map(maybe));
		}
	}
	return withAccess(res, rootId, data, reads, uniqueArray(writes));
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
	return (Resolve.byName(node.content, data.environment) ?? []).flatMap(d => (d as { value?: readonly NodeId[] }).value ?? [])
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

/**
 * The stems of the files the call names, `undefined` unless every file argument is a known path to a file with an extension (a device's `plot%03d.png` or a directory may stand for others).
 * Empty if the call names no file, as `cat(x)` and `writeLines(x, stdout())`, which print, do.
 */
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
function printingReads<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, dispatches: boolean, keys: readonly string[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] {
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

function applyWithUnknownArguments<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, access: AmbientStateAccess): DataflowInformation {
	switch(access.type) {
		case AmbientStateAccessType.CloseDevice:
			return deviceAccess(res, rootId, data, access.all ? 'close-all' : 'switch');
		/* the arguments handed on (`do.call(readLines, list("a.txt"))`, `lapply(files, readLines)`) may still name the files */
		case AmbientStateAccessType.OpenDevice:
		case AmbientStateAccessType.SwitchDevice:
		case AmbientStateAccessType.ReadFiles:
		case AmbientStateAccessType.WriteFiles:
			return applyAmbientStateAccess(res, [], rootId, data, access);
		case AmbientStateAccessType.SetOptions:
			/* like `options(op)`: it may set anything */
			res.graph.markIdForUnknownSideEffects(rootId);
	}
	const { reads, writes } = unknownArgumentAccess(access, drawingWritesDevice(data.ctx.config));
	return withAccess(res, rootId, data, reads, writes);
}

const Devices = { reads: [], writes: [AmbientStateName.graphics, AmbientStateName.device] };
/* evaluated code may attach a package as well, which every call nothing else resolves reads */
const Quoted = { reads: [AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette], writes: [AmbientStateName.unknownOption, AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette, AmbientStateName.allOf(KeyedState.SearchPath)] };

/** What a call of the given kind may read and write when its arguments are unknown, as when only linking reveals it. */
const UnknownArgumentAccess: Record<Exclude<AmbientStateAccessType, AmbientStateAccessType.ReadKeyed | AmbientStateAccessType.ReadOptions | AmbientStateAccessType.SetKeyed | AmbientStateAccessType.SetState | AmbientStateAccessType.ReadState>, { readonly reads: readonly string[], readonly writes: readonly string[] }> = {
	[AmbientStateAccessType.SetOptions]:          { reads: [AmbientStateName.allOptions], writes: [AmbientStateName.unknownOption, AmbientStateName.allOptions, AmbientStateName.warnsAsErrors] },
	[AmbientStateAccessType.GetOption]:           { reads: [AmbientStateName.allOptions], writes: [] },
	[AmbientStateAccessType.SetGraphics]:         { reads: [AmbientStateName.graphics], writes: [AmbientStateName.graphics] },
	[AmbientStateAccessType.ReadGraphics]:        { reads: [AmbientStateName.graphics, AmbientStateName.palette], writes: [] },
	[AmbientStateAccessType.SetPalette]:          { reads: [AmbientStateName.palette], writes: [AmbientStateName.palette] },
	[AmbientStateAccessType.OpenDevice]:          Devices,
	[AmbientStateAccessType.CloseDevice]:         Devices,
	[AmbientStateAccessType.SwitchDevice]:        Devices,
	[AmbientStateAccessType.EvaluateQuoted]:      Quoted,
	[AmbientStateAccessType.SetRng]:              { reads: [AmbientStateName.rngKind], writes: [AmbientStateName.rng, AmbientStateName.rngKind] },
	[AmbientStateAccessType.DrawRng]:             { reads: [AmbientStateName.rng], writes: [AmbientStateName.rng] },
	[AmbientStateAccessType.ReadFiles]:           { reads: [AmbientStateName.workingDirectory, AmbientStateName.files], writes: [] },
	[AmbientStateAccessType.WriteFiles]:          { reads: [AmbientStateName.workingDirectory], writes: [AmbientStateName.anyFile, AmbientStateName.files] },
	[AmbientStateAccessType.SetWorkingDirectory]: { reads: [AmbientStateName.workingDirectory], writes: [AmbientStateName.workingDirectory] },
	[AmbientStateAccessType.GetWorkingDirectory]: { reads: [AmbientStateName.workingDirectory], writes: [] },
	[AmbientStateAccessType.OpenTextConnection]:  { reads: [], writes: [] },
	[AmbientStateAccessType.RegisterFinalizer]:   { reads: [], writes: [AmbientStateName.finalizers] },
	[AmbientStateAccessType.RunFinalizers]:       { reads: [AmbientStateName.finalizers], writes: [] }
};

function unknownArgumentAccess(access: AmbientStateAccess, drawing: boolean): { readonly reads: readonly string[], readonly writes: readonly string[] } {
	switch(access.type) {
		case AmbientStateAccessType.ReadOptions:
			return { reads: optionReads(access.dispatchOn === undefined ? access.keys : undefined), writes: [] };
		case AmbientStateAccessType.SetKeyed:
			return { reads: [], writes: keyedWrites(access.state, [UnknownKey]) };
		case AmbientStateAccessType.ReadKeyed:
			return { reads: [AmbientStateName.allOf(access.state)], writes: [] };
		case AmbientStateAccessType.SetState:
			return { reads: [], writes: [access.state] };
		case AmbientStateAccessType.ReadState:
			return { reads: [access.state], writes: [] };
		case AmbientStateAccessType.ReadGraphics:
			return { reads: UnknownArgumentAccess[access.type].reads, writes: drawing ? [AmbientStateName.canvas] : [] };
		default:
			return UnknownArgumentAccess[access.type];
	}
}

/** Graphics parameters are per device; within a function the open devices are unknown, so a device call only adds. */
function deviceAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, kind: 'open' | 'close' | 'close-all' | 'switch'): DataflowInformation {
	/* only a switch reads the state; what a closed device holds reaches its file through the plots on it (see LinkToLastPlot) */
	const reads = kind === 'switch' ? [AmbientStateName.graphics] : [];
	/* closing writes the file of the device, which its opening names unless we do not know the device closed */
	const unnamedFile = kind === 'open' ? [] : [AmbientStateName.anyFile, AmbientStateName.files];
	const cds = data.cds ? [...data.cds] : undefined;
	if(data.environment.level > 0) {
		/* a device the body opened itself is the one a later close in the same body closes:
		   `f <- function() { pdf("a.pdf"); plot(1); dev.off() }` writes `a.pdf` and no other file */
		const here = kind === 'close' ? res.environment.current.memory.get(AmbientStateName.deviceOpenedHere) ?? [] : [];
		for(const open of here) {
			res.graph.addEdge(open.nodeId, rootId, EdgeType.Reads);
		}
		let environment = { ...res.environment, current: res.environment.current.removeAll([{ name: AmbientStateName.deviceOpenedHere }]) };
		if(kind === 'open') {
			environment = defineAmbient(environment, rootId, cds, [{ name: AmbientStateName.deviceOpenedHere, mode: 'local' }]);
		}
		return withAccess({ ...res, environment }, rootId, data, reads, [AmbientStateName.graphics, AmbientStateName.device, ...here.length > 0 ? [] : unnamedFile]);
	}
	const lookup = (name: string) => Resolve.byName(name, res.environment) ?? [];
	const current = lookup(AmbientStateName.graphics);
	const others = lookup(AmbientStateName.otherDevices);
	const opener = lookup(AmbientStateName.device);
	const otherOpeners = lookup(AmbientStateName.otherDevicesOpenedBy);
	let environment = res.environment;
	const reset = (name: string) => defineAmbient(environment, rootId, cds, [{ name, mode: 'reset' }]);
	/* a later plot depends on neither the close nor the closed device's state; a device only depends on its close so it does not catch later plots */
	const closes = (openers: readonly IdentifierDefinition[]) => {
		for(const open of openers) {
			res.graph.addEdge(open.nodeId, rootId, EdgeType.Reads);
		}
	};
	/* in a loop, an earlier round may have opened a device this one leaves behind, or a close may leave one open */
	const repeats = RLoopConstructs.encloses(rootId, data.completeAst.idMap);
	const earlierRound: IdentifierDefinition[] = repeats ? [{ nodeId: rootId, name: AmbientStateName.device, type: ReferenceType.Variable, definedAt: rootId, cds: cds ?? [] }] : [];
	switch(kind) {
		case 'open':
			environment = setAmbient(environment, AmbientStateName.otherDevices, [...others, ...current, ...earlierRound]);
			environment = setAmbient(environment, AmbientStateName.otherDevicesOpenedBy, [...otherOpeners, ...opener, ...earlierRound]);
			environment = reset(AmbientStateName.graphics);
			environment = reset(AmbientStateName.device);
			break;
		case 'close':
			closes(opener);
			environment = setAmbient(environment, AmbientStateName.graphics, repeats ? [...others, ...current] : others);
			environment = setAmbient(environment, AmbientStateName.device, repeats ? [...otherOpeners, ...opener] : otherOpeners);
			break;
		case 'close-all':
			closes([...opener, ...otherOpeners]);
			for(const name of DeviceStates) {
				environment = setAmbient(environment, name, []);
			}
			break;
		case 'switch':
			environment = defineAmbient(environment, rootId, cds, [AmbientStateName.graphics, AmbientStateName.device]);
			environment = setAmbient(environment, AmbientStateName.graphics, others, true);
			environment = setAmbient(environment, AmbientStateName.otherDevices, current, true);
			environment = setAmbient(environment, AmbientStateName.device, otherOpeners, true);
			environment = setAmbient(environment, AmbientStateName.otherDevicesOpenedBy, opener, true);
			break;
	}
	recordAmbient(res.graph, rootId, res.environment, [], kind === 'close-all' ? DeviceStates : [AmbientStateName.graphics, AmbientStateName.device]);
	const known = kind === 'close' ? opener.length > 0 : kind === 'close-all' && opener.length + otherOpeners.length > 0;
	return withAccess({ ...res, environment }, rootId, data, reads, kind === 'open' || known ? [] : unnamedFile);
}

/** A call to `fn` made on our behalf (`do.call(fn, args)`, `sapply(x, fn)`): it accesses the state as `fn` does, or reads all of it if `fn` is opaque. */
export function applyAmbientStateOfCallee<OtherInfo>(res: DataflowInformation, callId: NodeId, fn: Identifier, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const targets = Resolve.byNameAndType(fn, data.environment, ReferenceType.Function) ?? [];
	res = applyAmbientStateAccess(res, UnknownArguments, callId, data, targets.flatMap(hiddenAccess));
	hiddenSideEffects(res.graph, res.environment, callId, targets);
	const unknown = (targets.length === 0 && data.environment.level === 0) || targets.some(t => t.type !== ReferenceType.BuiltInFunction && hidesBody(t));
	return unknown ? readsAllAmbientState(res, callId, data, true) : res;
}

/**
 * The processors that write the environment from their arguments (define, remove, evaluate code): called through a
 * parameter, `do.call`, or an apply function, what they write is unknown, so the values known so far may be stale.
 */
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
		const effect = (builtIn?.config as { hasUnknownSideEffects?: boolean | LinkTo<RegExp | string> } | undefined)?.hasUnknownSideEffects
			?? (processor !== undefined && WritesEnvironment.has(processor));
		if(effect) {
			handleUnknownSideEffect(graph, environment, callId, effect === true ? undefined : effect);
		} else if(processor !== undefined && WritesSearchPath.has(processor)) {
			graph.markIdForUnknownSideEffects(callId);
		}
	}
}

function hiddenAccess(target: IdentifierDefinition): readonly AmbientStateAccess[] {
	const access = target.type === ReferenceType.BuiltInFunction ? (target.config as { ambient?: AmbientStateAccess | readonly AmbientStateAccess[] } | undefined)?.ambient : undefined;
	return [access ?? []].flat();
}

/** The (maybe) writes of the call `callId` to the built-in `target` through a parameter, like `g <- function(f, ...) f(...); g(options, digits = 3)`. */
export function writesOfHiddenBuiltIn(target: IdentifierDefinition, callId: NodeId, drawing = false): (InGraphIdentifierDefinition & { name: string })[] {
	return hiddenAccess(target).flatMap(a => unknownArgumentAccess(a, drawing).writes).map(name => ({ nodeId: callId, name, type: ReferenceType.Variable, definedAt: callId, cds: [] }));
}

/** The states the call to the built-in `target` through a parameter reads, see {@link writesOfHiddenBuiltIn}. */
export function readsOfHiddenBuiltIn(target: IdentifierDefinition): string[] {
	return hiddenAccess(target).flatMap(a => unknownArgumentAccess(a, false).reads);
}

function setOptions<OtherInfo>(
	res: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const queried: string[] = [];
	const written: string[] = [];
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
			warnsAsErrors ||= key === 'warn' && !NodeValue.setOf(arg.value?.info.id, data)?.elements.every(belowTwo);
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
	const reads: string[] = [...queried.map(AmbientStateName.option), ...previous];
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

/**
 * Whether the call to `fn` only queries the state it may set, as `par("mar")`, `options("digits")` and `palette()`
 * do, which hand that state back visibly where setting it returns the previous one invisibly.
 */
export function callOnlyQueries<OtherInfo>(fn: Identifier, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], environment: REnvironmentInformation): boolean {
	const targets = Resolve.byNameAndType(fn, environment, ReferenceType.Function) ?? [];
	return targets.length > 0 && targets.every(t => hiddenAccess(t).some(a => onlyQueries(a, args)));
}

function onlyQueries<OtherInfo>(access: AmbientStateAccess, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): boolean {
	switch(access.type) {
		case AmbientStateAccessType.SetGraphics:
			return args.length === 0 || (access.queryOnUnnamedStrings === true && isQuery(args));
		case AmbientStateAccessType.SetOptions:
			return isQuery(args);
		case AmbientStateAccessType.SetPalette:
			return args.length === 0;
		case AmbientStateAccessType.SetState:
			return access.queryWithoutArguments === true && args.length === 0;
		default:
			return false;
	}
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
	const ambient = reads.filter(r => AmbientStateName.is(r.name));
	for(const r of ambient) {
		for(const def of Resolve.byName(r.name as string, body.environment) ?? []) {
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
	readonly state:     'options' | 'graphics' | 'device' | 'rng' | 'wd' | KeyedState.Env | KeyedState.Locale
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
export function processAmbientScope<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	scope: AmbientScope
): DataflowInformation {
	const bound = MatchArgs.toNames(args, scope.params);
	const code = scope.code === undefined ? undefined : bound.get(scope.code);
	const codeIndex = code === undefined ? -1 : args.findIndex(a => a !== EmptyArgument && a.info.id === code.info.id);
	const local = code === undefined && data.environment.level > 0;
	const { writes, unknown } = scope.preserve ? { writes: local ? [{ name: singleStateOf(scope.state as 'rng'), mode: 'local' } as const] : [], unknown: false } : scopedWrites(scope, args, bound, local);
	const cds = data.cds ? [...data.cds] : undefined;
	const apply = (environment: REnvironmentInformation): REnvironmentInformation =>
		scope.state === 'device' ? deviceAccess({ ...DataflowInformation.initialize(rootId, data), environment }, rootId, data, local ? 'switch' : 'open').environment
			: defineAmbient(environment, rootId, cds, writes);

	const { information } = processKnownFunctionCall({
		name, args, rootId, data, origin:    BuiltInProcName.Default,
		patchData: (d, i) => i === codeIndex ? { ...d, environment: apply(d.environment) } : d
	});
	if(unknown) {
		information.graph.markIdForUnknownSideEffects(rootId);
	}
	/* the state a scope changes around its code is back afterward */
	const changed = scope.state === 'device' ? [AmbientStateName.graphics, AmbientStateName.device] : writes;
	recordAmbient(information.graph, rootId, information.environment, [], code === undefined && !(scope.state === 'device' && local) ? changed : changed.map(w => ({ name: typeof w === 'string' ? w : w.name, mode: 'local' as const })));
	if(code === undefined) {
		const applied = { ...information, environment: apply(information.environment) };
		/* the frame starts out with the state as it was */
		return scope.preserve && local ? withAccess(applied, rootId, data, [singleStateOf(scope.state as 'rng')]) : applied;
	}
	/* afterward, what the scope changed is back to what it was before */
	let environment = information.environment;
	const keyed = keyedStateOf(scope);
	const restored = scope.state === 'device' ? DeviceStates
		: scope.state === 'rng' || scope.state === 'wd' ? [singleStateOf(scope.state)]
			: writes.map(w => typeof w === 'string' ? w : w.name).filter(n => keyed !== undefined && n.startsWith(AmbientStateName.keyed(keyed, '')) && n !== AmbientStateName.keyed(keyed, UnknownKey));
	for(const state of restored) {
		const before = Resolve.byName(state, data.environment);
		/* an entry nothing set before keeps the scope's definition, we cannot tell R's default apart */
		if((before !== undefined && before.length > 0) || ((scope.state === 'device' || scope.state === 'rng' || scope.state === 'wd') && data.environment.level === 0)) {
			environment = setAmbient(environment, state, before ?? []);
		}
	}
	if(scope.state === 'graphics') {
		/* `with_par` restores the parameters it set, what its code set with `par` stays */
		const kept = (Resolve.byName(AmbientStateName.graphics, environment) ?? []).filter(d => d.nodeId !== rootId);
		environment = setAmbient(environment, AmbientStateName.graphics, kept);
	}
	return { ...information, environment };
}

/** The keyed state an {@link AmbientScope} changes the entries of, `undefined` for a state without entries. */
function keyedStateOf(scope: AmbientScope): KeyedState | undefined {
	return scope.state === 'options' ? KeyedState.Option : scope.state === KeyedState.Env || scope.state === KeyedState.Locale ? scope.state : undefined;
}

/** The pseudo variable of a scoped state without entries. */
function singleStateOf(state: 'graphics' | 'device' | 'rng' | 'wd'): string {
	return state === 'rng' ? AmbientStateName.rng : state === 'wd' ? AmbientStateName.workingDirectory : AmbientStateName.graphics;
}

/** what a scope call writes: the entries of a keyed state it names, or the state it changes as a whole */
function scopedWrites<OtherInfo>(scope: AmbientScope, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], bound: ReadonlyMap<string, RArgument<OtherInfo & ParentInformation>>, local: boolean): { writes: (string | AmbientWrite)[], unknown: boolean } {
	const keyed = keyedStateOf(scope);
	if(keyed === undefined) {
		const name = singleStateOf(scope.state as 'graphics' | 'device' | 'rng' | 'wd');
		/* only the directory is restored as a whole (withr's `local_seed` leaves the generator where the function's draws took it) */
		return { writes: [local && scope.state === 'wd' ? { name, mode: 'local' } : name], unknown: false };
	}
	const keys: string[] = [];
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
	const names = keys.map(k => AmbientStateName.keyed(keyed, k)).concat(options && keys.includes('warn') ? [AmbientStateName.warnsAsErrors] : []);
	if(unknown) {
		names.push(AmbientStateName.keyed(keyed, UnknownKey));
	}
	names.push(AmbientStateName.allOf(keyed));
	const writes: (string | AmbientWrite)[] = names.map(name => local ? { name, mode: 'local' } as const : name);
	return { writes, unknown: unknown || (options && keys.some(k => GlobalEffectOptions.has(k))) };
}

/** Evaluating captured code may access any state; `Quoted.finalize` drops the writes again once the code is known to change none. */
export function evaluatesCapturedCode<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	return withAccess(res, rootId, data, Quoted.reads, Quoted.writes);
}

/** R prints every visible top-level value (see {@link autoPrints}) by an implicit `print`, which reads the options the configured `print` reads for that value. */
export function readsOfAutoPrint<OtherInfo>(processed: DataflowInformation, expression: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const print = Resolve.byNameAndType('print', { current: REnvironment.findBuiltIn(data.environment.current), level: 0 }, ReferenceType.Function)?.slice(0, 1) ?? [];
	const reads = print.flatMap(hiddenAccess).flatMap(access => access.type === AmbientStateAccessType.ReadOptions
		? printingReads(expression, access.dispatchOn !== undefined, access.keys, data) : []);
	return withAccess(processed, expression.info.id, data, reads, []);
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
		res = applyAmbientStateAccess(res, call.arguments, callId, data, targets.flatMap(hiddenAccess));
		hiddenSideEffects(graph, before, callId, targets);
	}
	const access = res.graph.ambientAccessOf(callId);
	if(access !== undefined && res.graph !== graph) {
		graph.recordAmbientAccess(callId, access);
	}
	for(const read of res.unknownReferences.slice(known)) {
		for(const def of Resolve.byName(read.name as Identifier, before) ?? []) {
			graph.addEdge(read.nodeId, def.nodeId, EdgeType.Reads);
		}
	}
	return res;
}

/** whether R reads the value as a `warn` level below 2, so warnings stay warnings */
function belowTwo(value: Value): boolean {
	return value.type === 'logical' || (RValue.numberOf(value) ?? 2) < 2;
}

/** With `warn >= 2` R turns warnings into errors, so whatever may warn in `block` is a maybe error exit reading the options that may set `warn`. */
export function errorsOfWarnings<OtherInfo>(block: RNode<OtherInfo & ParentInformation>, after: REnvironmentInformation, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): ExitPoint[] {
	const lookup = (name: string) => [...Resolve.byName(name, data.environment) ?? [], ...Resolve.byName(name, after) ?? []];
	const marked = new Set(lookup(AmbientStateName.warnsAsErrors).map(d => d.nodeId));
	const sources = new Set([...lookup(AmbientStateName.option('warn')).filter(d => marked.has(d.nodeId)), ...lookup(AmbientStateName.unknownOption)].map(d => d.nodeId));
	if(sources.size === 0) {
		return [];
	}
	const cds = data.cds ? [...data.cds] : [];
	return warningSites(block, graph, data, new Map()).map(site => {
		for(const source of sources) {
			graph.addEdge(site, source, EdgeType.Reads);
		}
		return { type: ExitPointType.Error, nodeId: site, cds };
	});
}

/** what may warn when `root` runs, `bodies` holds what may in the bodies of the closures seen so far */
function warningSites<OtherInfo>(root: RNode<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, bodies: Map<NodeId, readonly NodeId[]>): NodeId[] {
	const sites: NodeId[] = [];
	RNode.visitAst(root, node => {
		if(RFunctionDefinition.is(node)) {
			return true;
		} else if(RBinaryOp.is(node) ? RBinaryOp.getOperatorInfo(node)?.usedAs !== OperatorUsedAs.Assignment : RUnaryOp.is(node) || RAccess.is(node)) {
			sites.push(node.info.id);
		} else if(RFunctionCall.is(node)) {
			const targets = node.named ? Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function) ?? [] : [];
			if(RFunctionCall.isNamed(node, 'suppressWarnings') && targets.every(t => NodeId.isBuiltIn(t.nodeId))) {
				return true;
			}
			const handlers = muffledHandlers(node, graph, data);
			if(handlers !== undefined) {
				sites.push(...handlers.flatMap(h => warningSites(h, graph, data, bodies)));
				return true;
			}
			const callees = targets.flatMap(t => hidesBody(t) ? [undefined] : (t as Partial<InGraphIdentifierDefinition>).value?.map(id => data.completeAst.idMap.get(id)) ?? [undefined]);
			if(callees.length === 0 || !callees.every(RFunctionDefinition.is)) {
				sites.push(node.info.id);
				return false;
			}
			/* the body runs in the function's own scope, we resolve what it calls where the construct is, which is where most functions live */
			const within = callees.flatMap(c => bodySites(c, graph, data, bodies));
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
function callsBuiltIn<OtherInfo>(call: RFunctionCall<OtherInfo & ParentInformation>, name: string, origin: BuiltInProcName, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(!DfgVertex.hasOrigin(graph.getVertex(call.info.id), origin)) {
		return false;
	}
	const targets = call.named ? Resolve.byNameAndType(call.functionName.content, data.environment, ReferenceType.Function) : undefined;
	return targets !== undefined && targets.length > 0 && targets.every(t => t.nodeId === NodeId.toBuiltIn(name));
}

/** what may warn in the body of the closure `definition`, cached in `bodies` */
function bodySites<OtherInfo>(definition: RFunctionDefinition<OtherInfo & ParentInformation>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, bodies: Map<NodeId, readonly NodeId[]>): readonly NodeId[] {
	let sites = bodies.get(definition.info.id);
	if(sites === undefined) {
		/* a recursive call adds nothing to what the body may warn about */
		bodies.set(definition.info.id, []);
		sites = warningSites(definition.body, graph, data, bodies);
		bodies.set(definition.info.id, sites);
	}
	return sites;
}
