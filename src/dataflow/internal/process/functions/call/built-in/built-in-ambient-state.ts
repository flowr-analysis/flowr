import type { DataflowProcessorInformation } from '../../../../../processor';
import { type ControlDependency, DataflowInformation } from '../../../../../info';
import type { ParentInformation, RNodeWithParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { DfgVertex } from '../../../../../graph/vertex';
import { CallProp } from '../../../../../environments/built-in-props';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { Identifier, type IdentifierDefinition, type IdentifierReference, type InGraphIdentifierDefinition, isReferenceType, ReferenceType } from '../../../../../environments/identifier';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { define } from '../../../../../environments/define';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RConstant } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { MatchArgs } from '../../../../../graph/match-args';
import { processKnownFunctionCall } from '../known-call-handling';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import type { LinkTo } from '../../../../../../queries/catalog/call-context-query/call-context-query-format';
import type { DataflowGraph } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

/**
 * Graphics parameters and options, tracked as global pseudo variables (`#...`) so readers link to the calls that set them.
 * Accumulating states only grow: `par(mar = ...)` keeps an earlier `par(mfrow = ...)`.
 */
export const AmbientStateName = {
	/** the graphics state (`par`, `layout`, ...) of the active device, which a new device starts afresh */
	graphics:             '#graphics',
	/** the graphics states of the other open devices, the active one returns to one of them once it closes */
	otherDevices:         '#graphics:other',
	/** the call that opened the active device, and those of the other open devices */
	device:               '#device',
	otherDevicesOpenedBy: '#device:other',
	/** the color palette, which, other than the graphics parameters, all devices share */
	palette:              '#palette',
	/** every option write, for readers that may read any option (`getOption(k)` with an unknown `k`, library functions) */
	allOptions:           '#options',
	/** written by an `options(...)` call whose keys we cannot name, like the common `options(op)` restore */
	unknownOption:        '#option:*',
	/** the pseudo variable holding the option `key`; setting the option replaces it */
	option(this: void, key: string): string {
		return `#option:${key}`;
	}
} as const;

const Accumulating: ReadonlySet<string> = new Set([AmbientStateName.graphics, AmbientStateName.otherDevices, AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy, AmbientStateName.palette, AmbientStateName.allOptions, AmbientStateName.unknownOption]);

/** A write other than the default: `local` binds in the current frame only (`withr::local_options`), `reset` replaces an accumulating state (a new device). */
interface AmbientWrite {
	readonly name: string
	readonly mode: 'local' | 'reset'
}

/** A call into code flowR cannot see may read any option and draw on the device. */
export function readsAllAmbientState<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, graphics: boolean): DataflowInformation {
	return withAccess(res, rootId, data, graphics ? [AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette] : [AmbientStateName.allOptions], []);
}

/** Adds the reads and writes of the ambient state to what a call does, see {@link AmbientStateName}. */
function withAccess<OtherInfo>(
	res: DataflowInformation,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	reads: readonly string[],
	writes: readonly (string | AmbientWrite)[]
): DataflowInformation {
	if(reads.length === 0 && writes.length === 0) {
		return res;
	}
	const cds = data.cds ? [...data.cds] : undefined;
	const readRefs: IdentifierReference[] = reads.map(name => ({ nodeId: rootId, name, type: ReferenceType.Variable, cds }));
	/* the writes stay out of `out`: an assignment reads whatever else its source writes (`x <- y <- 3`) */
	return {
		...res,
		unknownReferences: readRefs.length > 0 ? [...res.unknownReferences, ...readRefs] : res.unknownReferences,
		environment:       defineAmbient(res.environment, rootId, cds, writes)
	};
}

/** Applies the writes of the call `rootId` to the environment, see {@link withAccess}. */
function defineAmbient(environment: REnvironmentInformation, rootId: NodeId, cds: ControlDependency[] | undefined, writes: readonly (string | AmbientWrite)[]): REnvironmentInformation {
	for(const write of writes) {
		const name = typeof write === 'string' ? write : write.name;
		const mode = typeof write === 'string' ? undefined : write.mode;
		const accumulates = Accumulating.has(name);
		/* an accumulating state only ever grows, its definitions are maybe so merging environments keeps them all; a reset is definite */
		const def: InGraphIdentifierDefinition & { name: string } = { nodeId: rootId, name, type: ReferenceType.Variable, definedAt: rootId, cds: accumulates && mode !== 'reset' ? cds ?? [] : cds };
		/* the state is global, wherever the call happens, unless the call scopes it to the current frame */
		environment = define(def, mode !== 'local', environment, accumulates && mode === undefined);
	}
	return environment;
}

/** Binds `name` (globally) to the given definitions, in addition to what it holds with `keep`, so `#graphics` can become what another state holds. */
function setAmbient(environment: REnvironmentInformation, name: string, definitions: readonly IdentifierDefinition[], keep = false): REnvironmentInformation {
	if(definitions.length === 0 && !keep) {
		return { ...environment, current: environment.current.removeAll([{ name }]) };
	}
	for(const [i, def] of definitions.entries()) {
		environment = define({ ...def, name }, true, environment, keep || i > 0);
	}
	return environment;
}

/** `.Options$digits` (or `.Options[["digits"]]`) reads that option, anything else done with `.Options` reads all of them. */
export function readsOfOptionsVariable<OtherInfo>(symbol: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): IdentifierReference[] {
	const parent = symbol.info.parent === undefined ? undefined : data.completeAst.idMap.get(symbol.info.parent);
	let key: string | undefined;
	if(RAccess.is(parent) && parent.accessed.info.id === symbol.info.id && (parent.operator === '$' || parent.operator === '[[')) {
		const first = parent.access[0];
		const value = first === EmptyArgument ? undefined : first.value;
		key = RString.is(value) ? value.content.str : parent.operator === '$' && RSymbol.is(value) ? Identifier.getName(value.content) : undefined;
	}
	const names = key === undefined ? [AmbientStateName.allOptions] : [AmbientStateName.option(key), AmbientStateName.unknownOption];
	return names.map(name => ({ nodeId: symbol.info.id, name, type: ReferenceType.Variable, cds: data.cds }));
}

/** Options affecting calls we cannot name (`scipen` changes every number-to-string conversion), so setting one stays an unknown side effect. */
const GlobalEffectOptions: ReadonlySet<string> = new Set([
	'scipen', 'OutDec', 'warn', 'error', 'expressions', 'encoding', 'stringsAsFactors', 'timeout', 'HTTPUserAgent',
	'download.file.method', 'download.file.extra', 'internet.info', 'warnPartialMatchArgs', 'warnPartialMatchAttr',
	'warnPartialMatchDollar', 'keep.source', 'keep.parse.data', 'check.bounds', 'CBoundsCheck', 'catch.script.errors',
	'defaultPackages', 'topLevelEnvironment', 'java.parameters'
]);

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
	EvaluateQuoted = 'evaluate-quoted'
}

export type AmbientStateAccess = {
	readonly type: AmbientStateAccessType.SetOptions | AmbientStateAccessType.GetOption | AmbientStateAccessType.ReadGraphics
		| AmbientStateAccessType.SetPalette | AmbientStateAccessType.OpenDevice | AmbientStateAccessType.SwitchDevice
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
	readonly type:                   AmbientStateAccessType.SetGraphics
	/** `par()` and `par("mar")` only query the state */
	readonly queryOnUnnamedStrings?: boolean
	/** a query also reads what the last plot left behind (`par("usr")`), linked like an unknown side effect */
	readonly queryLinksTo?:          LinkTo<RegExp | string>
};

/** Wires the {@link AmbientStateAccess} of a call into its dataflow information: reads become unknown references, writes define the pseudo variable globally. */
export function applyAmbientStateAccess<OtherInfo>(
	res: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] | UnknownArguments,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	access: AmbientStateAccess
): DataflowInformation {
	if(args === UnknownArguments) {
		return applyWithUnknownArguments(res, rootId, data, access);
	}
	const reads: string[] = [];
	const writes: string[] = [];
	switch(access.type) {
		case AmbientStateAccessType.ReadGraphics:
			reads.push(AmbientStateName.graphics, AmbientStateName.palette);
			break;
		case AmbientStateAccessType.SetGraphics:
			/* the call returns the previous state */
			reads.push(AmbientStateName.graphics);
			if(args.length === 0 || (access.queryOnUnnamedStrings && isQuery(args))) {
				if(access.queryLinksTo) {
					handleUnknownSideEffect(res.graph, res.environment, rootId, access.queryLinksTo);
				}
			} else {
				writes.push(AmbientStateName.graphics);
			}
			break;
		case AmbientStateAccessType.SetPalette:
			reads.push(AmbientStateName.palette);
			if(args.length > 0) {
				writes.push(AmbientStateName.palette);
			}
			break;
		case AmbientStateAccessType.ReadOptions: {
			const dispatched = access.dispatchOn === undefined ? undefined : args[access.dispatchOn];
			reads.push(...printingReads(dispatched === undefined || dispatched === EmptyArgument ? undefined : dispatched.value, access.dispatchOn !== undefined, access.keys, data));
			break;
		}
		case AmbientStateAccessType.GetOption: {
			const first = args.find(a => a !== EmptyArgument && (a.name === undefined || Identifier.getName(a.name.content) === 'x'));
			const keys = first === undefined || first === EmptyArgument ? undefined : stringsOf(first.value, data);
			if(keys === undefined) {
				reads.push(AmbientStateName.allOptions);
			} else {
				reads.push(...keys.map(AmbientStateName.option), AmbientStateName.unknownOption);
			}
			break;
		}
		case AmbientStateAccessType.SetOptions:
			return setOptions(res, args, rootId, data);
		case AmbientStateAccessType.OpenDevice:
			return deviceAccess(res, rootId, data, 'open');
		case AmbientStateAccessType.CloseDevice:
			/* `dev.off(which)` may close a device other than the active one, which keeps its state then */
			return deviceAccess(res, rootId, data, access.all ? 'close-all' : args.length > 0 ? 'switch' : 'close');
		case AmbientStateAccessType.SwitchDevice:
			return deviceAccess(res, rootId, data, 'switch');
		case AmbientStateAccessType.EvaluateQuoted:
			return evaluatesCapturedCode(res, rootId, data);
	}
	return withAccess(res, rootId, data, reads, writes);
}

/** What printing `value` reads: the printing `keys` for a plain value, all options for an unknown one (a tibble reads the pillar options). */
function printingReads<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, dispatches: boolean, keys: readonly string[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] {
	if(dispatches && (value === undefined || !isPlainValue(value, data))) {
		return [AmbientStateName.allOptions];
	}
	return [...keys.map(AmbientStateName.option), AmbientStateName.unknownOption];
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
		case AmbientStateAccessType.SetOptions:
			/* like `options(op)`: it may set anything */
			res.graph.markIdForUnknownSideEffects(rootId);
			return withAccess(res, rootId, data, [AmbientStateName.allOptions], [AmbientStateName.unknownOption, AmbientStateName.allOptions]);
		case AmbientStateAccessType.GetOption:
			return withAccess(res, rootId, data, [AmbientStateName.allOptions], []);
		case AmbientStateAccessType.SetGraphics:
			return withAccess(res, rootId, data, [AmbientStateName.graphics], [AmbientStateName.graphics]);
		case AmbientStateAccessType.SetPalette:
			return withAccess(res, rootId, data, [AmbientStateName.palette], [AmbientStateName.palette]);
		case AmbientStateAccessType.ReadOptions:
			return withAccess(res, rootId, data, access.dispatchOn === undefined ? printingReads(undefined, false, access.keys, data) : [AmbientStateName.allOptions], []);
		case AmbientStateAccessType.CloseDevice:
			return deviceAccess(res, rootId, data, access.all ? 'close-all' : 'switch');
		default:
			return applyAmbientStateAccess(res, [], rootId, data, access);
	}
}

/** Graphics parameters are per device; within a function the open devices are unknown, so a device call only adds. */
function deviceAccess<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, kind: 'open' | 'close' | 'close-all' | 'switch'): DataflowInformation {
	/* only a switch reads the state; what a closed device holds reaches its file through the plots on it (see LinkToLastPlot) */
	const reads = kind === 'switch' ? [AmbientStateName.graphics] : [];
	if(data.environment.level > 0) {
		return withAccess(res, rootId, data, reads, [AmbientStateName.graphics]);
	}
	const cds = data.cds ? [...data.cds] : undefined;
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
	switch(kind) {
		case 'open':
			environment = setAmbient(environment, AmbientStateName.otherDevices, [...others, ...current]);
			environment = setAmbient(environment, AmbientStateName.otherDevicesOpenedBy, [...otherOpeners, ...opener]);
			environment = reset(AmbientStateName.graphics);
			environment = reset(AmbientStateName.device);
			break;
		case 'close':
			closes(opener);
			environment = setAmbient(environment, AmbientStateName.graphics, others);
			environment = setAmbient(environment, AmbientStateName.device, otherOpeners);
			break;
		case 'close-all':
			closes([...opener, ...otherOpeners]);
			for(const name of [AmbientStateName.graphics, AmbientStateName.otherDevices, AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy]) {
				environment = setAmbient(environment, name, []);
			}
			break;
		case 'switch':
			environment = defineAmbient(environment, rootId, cds, [AmbientStateName.graphics]);
			environment = setAmbient(environment, AmbientStateName.graphics, others, true);
			environment = setAmbient(environment, AmbientStateName.otherDevices, current, true);
			environment = setAmbient(environment, AmbientStateName.device, otherOpeners, true);
			environment = setAmbient(environment, AmbientStateName.otherDevicesOpenedBy, opener, true);
			break;
	}
	return withAccess({ ...res, environment }, rootId, data, reads, []);
}

/** A call to `fn` made on our behalf (`do.call(fn, args)`, `sapply(x, fn)`): it accesses the state as `fn` does, or reads all of it if `fn` is opaque. */
export function applyAmbientStateOfCallee<OtherInfo>(res: DataflowInformation, callId: NodeId, fn: Identifier, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const targets = Resolve.byNameAndType(fn, data.environment, ReferenceType.Function) ?? [];
	res = applyAmbientStateOfTargets(res, targets, UnknownArguments, callId, data);
	const unknown = (targets.length === 0 && data.environment.level === 0)
		|| targets.some(t => t.type !== ReferenceType.BuiltInFunction && (NodeId.isBuiltIn(t.nodeId) || isReferenceType(t.type, ReferenceType.Parameter | ReferenceType.Argument)));
	return unknown ? readsAllAmbientState(res, callId, data, true) : res;
}

/** applies what the built-ins among `targets` state about the ambient state */
function applyAmbientStateOfTargets<OtherInfo>(res: DataflowInformation, targets: readonly IdentifierDefinition[], args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[] | UnknownArguments, callId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	for(const target of targets) {
		const access = target.type === ReferenceType.BuiltInFunction ? (target.config as { ambient?: AmbientStateAccess } | undefined)?.ambient : undefined;
		if(access !== undefined) {
			res = applyAmbientStateAccess(res, args, callId, data, access);
		}
	}
	return res;
}

function setOptions<OtherInfo>(
	res: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const queried: string[] = [];
	const written: string[] = [];
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
	if(writes.length > 0) {
		writes.push(AmbientStateName.allOptions);
	}
	return withAccess(res, rootId, data, reads, writes);
}

/** `par()`, `par("mar", "usr")`, and `par(no.readonly = TRUE)` only query the graphics state */
function isQuery<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]): boolean {
	return args.every(a => a === EmptyArgument
		|| (a.name === undefined ? RString.is(a.value) : Identifier.getName(a.name.content) === 'no.readonly'));
}

function stringsOf<OtherInfo>(value: RNodeWithParent<OtherInfo> | undefined, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): string[] | undefined {
	if(value === undefined) {
		return undefined;
	} else if(RString.is(value)) {
		return [value.content.str];
	}
	const strings = NodeValue.stringsOf(value.info.id, data);
	return strings === undefined || strings.length === 0 ? undefined : strings;
}

/** Whether the call's value may be used: anything but a non-final statement or the script's last statement (the last of a block is its value). */
function resultIsUsed<OtherInfo>(rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	const parentId = data.completeAst.idMap.get(rootId)?.info.parent;
	const parent = parentId === undefined ? undefined : data.completeAst.idMap.get(parentId);
	if(parent === undefined || !RExpressionList.is(parent)) {
		return parent !== undefined;
	}
	const isLast = parent.children.at(-1)?.info.id === rootId;
	return isLast && !data.completeAst.ast.files.some(f => f.root.info.id === parent.info.id);
}

/** Links state reads in a loop body to the body's own writes of a later iteration; the loops' circular linking only sees uses. */
export function linkAmbientStateWithinLoop(graph: DataflowGraph, reads: readonly IdentifierReference[], body: DataflowInformation): void {
	for(const r of reads) {
		if(typeof r.name !== 'string' || !r.name.startsWith('#')) {
			continue;
		}
		for(const def of Resolve.byName(r.name, body.environment) ?? []) {
			if(body.graph.hasVertex(def.nodeId)) {
				graph.addEdge(r.nodeId, def.nodeId, EdgeType.Reads);
			}
		}
	}
}

/** A scoped state change (`withr`, `rlang`): `with_*` undoes it after its code, `local_*` when the calling function returns. */
export interface AmbientScope {
	readonly state:  'options' | 'graphics' | 'device'
	/** the formals in order, used to bind the arguments */
	readonly params: readonly string[]
	/** the formal evaluated with the change in effect, absent for the `local_*` variants */
	readonly code?:  string
	/** the formal holding a list of the new values (`list(digits = 3)`), other named arguments are values too */
	readonly new?:   string
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
	const { writes, unknown } = scopedWrites(scope, args, bound, local);
	const cds = data.cds ? [...data.cds] : undefined;
	const apply = (environment: REnvironmentInformation): REnvironmentInformation =>
		scope.state === 'device' ? deviceAccess({ ...DataflowInformation.initialize(rootId, data), environment }, rootId, data, local ? 'switch' : 'open').environment
			: defineAmbient(environment, rootId, cds, writes);

	let { information } = processKnownFunctionCall({
		name, args, rootId, data, origin:    BuiltInProcName.Default,
		patchData: (d, i) => i === codeIndex ? { ...d, environment: apply(d.environment) } : d
	});
	if(unknown) {
		information.graph.markIdForUnknownSideEffects(rootId);
	}
	if(code === undefined) {
		return { ...information, environment: apply(information.environment) };
	}
	/* afterward, what the scope changed is back to what it was before */
	let environment = information.environment;
	const restored = scope.state === 'device' ? [AmbientStateName.graphics, AmbientStateName.otherDevices, AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy]
		: writes.map(w => typeof w === 'string' ? w : w.name).filter(n => n.startsWith('#option:') && n !== AmbientStateName.unknownOption);
	for(const state of restored) {
		const before = Resolve.byName(state, data.environment);
		/* an option nothing set before keeps the scope's definition, we cannot tell R's default apart */
		if((before !== undefined && before.length > 0) || (scope.state === 'device' && data.environment.level === 0)) {
			environment = setAmbient(environment, state, before ?? []);
		}
	}
	if(scope.state === 'graphics') {
		/* `with_par` restores the parameters it set, what its code set with `par` stays */
		const kept = (Resolve.byName(AmbientStateName.graphics, environment) ?? []).filter(d => d.nodeId !== rootId);
		environment = setAmbient(environment, AmbientStateName.graphics, kept);
	}
	information = { ...information, environment };
	return information;
}

/** what a scope call writes: the options it names, or the graphics state */
function scopedWrites<OtherInfo>(scope: AmbientScope, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], bound: ReadonlyMap<string, RArgument<OtherInfo & ParentInformation>>, local: boolean): { writes: (string | AmbientWrite)[], unknown: boolean } {
	if(scope.state !== 'options') {
		return { writes: [AmbientStateName.graphics], unknown: false };
	}
	const keys: string[] = [];
	let unknown = false;
	/* what falls to `...` names options, it is no formal of its own */
	const formals = new Set([...bound.entries()].filter(([param]) => param !== '...').map(([, arg]) => arg.info.id));
	const fromList = (value: RNode<OtherInfo & ParentInformation> | undefined) => {
		if(RFunctionCall.isNamed(value) && ['list', 'c'].includes(Identifier.getName(value.functionName.content))) {
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
	const writes: (string | AmbientWrite)[] = keys.map(k => local ? { name: AmbientStateName.option(k), mode: 'local' } as const : AmbientStateName.option(k));
	if(unknown) {
		writes.push(AmbientStateName.unknownOption);
	}
	writes.push(AmbientStateName.allOptions);
	return { writes, unknown: unknown || keys.some(k => GlobalEffectOptions.has(k)) };
}

/** Evaluating captured code may access any state; `Quoted.finalize` drops the writes again once the code is known to change none. */
export function evaluatesCapturedCode<OtherInfo>(res: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	return withAccess(res, rootId, data,
		[AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette],
		[AmbientStateName.unknownOption, AmbientStateName.allOptions, AmbientStateName.graphics, AmbientStateName.palette]);
}

/** R prints every visible top-level value, which reads the printing options like `print` does. */
export function readsOfAutoPrint<OtherInfo>(processed: DataflowInformation, expression: RNode<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	if(!autoPrints(expression, processed, data)) {
		return processed;
	}
	return withAccess(processed, expression.info.id, data, printingReads(expression, true, PrintingOptions, data), []);
}

/** the processors whose calls return invisibly, although their configuration states no {@link CallProp.Invisible} */
const InvisibleProcessors: ReadonlySet<string> = new Set([BuiltInProcName.ForLoop, BuiltInProcName.WhileLoop, BuiltInProcName.RepeatLoop,
	BuiltInProcName.Assignment, BuiltInProcName.SuperAssignment, BuiltInProcName.FunctionDefinition]);

/** whether the value of the top-level `expression` is visible, so that R prints it, decided on its vertex */
function autoPrints<OtherInfo>(expression: RNode<OtherInfo & ParentInformation>, processed: DataflowInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
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
	return targets === undefined || targets.length === 0 || !targets.every(t => t.type === ReferenceType.BuiltInFunction
		&& ((t.config as { props?: number } | undefined)?.props ?? 0) & CallProp.Invisible);
}

/** A call through a variable bound to a built-in (`p <- par; p(...)`), only revealed when linking the statement's calls. */
export function applyAmbientStateOfCalledBuiltIns<OtherInfo>(res: DataflowInformation, callId: NodeId, builtIns: readonly NodeId[], before: REnvironmentInformation, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const call = data.completeAst.idMap.get(callId);
	if(!RFunctionCall.is(call)) {
		return res;
	}
	const known = res.unknownReferences.length;
	for(const builtIn of builtIns) {
		const targets = NodeId.isBuiltIn(builtIn) ? Resolve.byNameAndType(NodeId.fromBuiltIn(builtIn), before, ReferenceType.Function) : undefined;
		res = applyAmbientStateOfTargets(res, targets ?? [], call.arguments, callId, data);
	}
	for(const read of res.unknownReferences.slice(known)) {
		for(const def of Resolve.byName(read.name as string, before) ?? []) {
			graph.addEdge(read.nodeId, def.nodeId, EdgeType.Reads);
		}
	}
	return res;
}
