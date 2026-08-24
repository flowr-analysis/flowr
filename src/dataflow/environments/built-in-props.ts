import type { DecodedFunction } from '../../project/sigdb/decode';

/**
 * What a single argument of a call is used for, as a bitmask ({@link ArgProp.Forced}/{@link ArgProp.NoDefault}
 * lead, being the two bits the signature database can also state).
 * @see {@link BuiltInFnInfo#sig}
 */
export enum ArgProp {
	/** evaluated whenever the call happens, even if the result goes unused, like `x` in `force(x)` */
	Forced    = 1 << 0,
	/** declared without a default value, like `x` in `nchar(x, type)`; says nothing about whether a call must supply it */
	NoDefault = 1 << 1,
	/** the result is this argument, handed back unchanged, like `x` in `identity(x)`; this is what draws the `Returns` edge */
	Alias     = 1 << 2,
	/** the result is computed from the argument's value, like `x` in `sum(x)` */
	Value     = 1 << 3,
	/** only the shape is used (length, dimensions, names, other attributes), like `x` in `nrow(x)` */
	Shape     = 1 << 4,
	/** selects a behavior instead of carrying data, like `na.rm` in `sum(x, na.rm = TRUE)` */
	Flag      = 1 << 5,
	/** names the resource the call reads or writes, like `file` in `write.csv(x, file)` */
	Resource  = 1 << 6,
	/** what it refers to may be modified, like `envir` in `assign(x, v, envir = e)` */
	Written   = 1 << 7,
	/** quoted or evaluated in another frame, like `expr` in `quote(expr)` */
	Nse       = 1 << 8,
	/** called as a function, like `FUN` in `lapply(x, FUN)` */
	Callee    = 1 << 9,
	/** only whether it was supplied matters, as with `missing()` */
	Presence  = 1 << 10,
	/**
	 * the result is one of this argument's values, like `choices` in `match.arg(arg, choices)`. The bounding
	 * argument of a {@link CallProp.Narrows} call; without one such a call yields a value of its own making.
	 */
	Bounds    = 1 << 11,
	/**
	 * only atomic data works here, never a closure, as with `e1` in `e1 > e2`. A bare symbol in such an
	 * argument therefore names a variable even when a function of that name is in scope.
	 */
	Atomic    = 1 << 12,
	/** the open handle the call acts on, like `con` in `close(con)` */
	Handle    = 1 << 13,
	/** never evaluated, the definite counterpart of {@link ArgProp.Forced}: no path of the body reads it */
	Lazy      = 1 << 14
}

/**
 * What the call as a whole does, as a bitmask. The resource bits ({@link CallProp.File} and its neighbors)
 * say where the call gets its data from, which is what {@link InputProps} collects.
 * @see {@link BuiltInFnInfo#props}
 */
export enum CallProp {
	/** computes a result and nothing else, the positive counterpart of `hasUnknownSideEffects` (excludes {@link ImpureProps}) */
	Pure      = 1 << 0,
	/**
	 * pure on its own, but it runs code it is handed, so whatever that code does happens too.
	 * The parameter it runs is marked {@link ArgProp.Callee} or {@link ArgProp.Nse}, as with `lapply(x, f)`.
	 */
	MayPure   = 1 << 1,
	/** may signal an error, like `stop()` (see {@link SigDbInferable}) */
	Throws    = 1 << 2,
	/** returns invisibly, so the result is not auto-printed */
	Invisible = 1 << 3,
	/** dispatches on the class of an argument (S3, S4, or S7), a group generic like `+` on either operand */
	Generic   = 1 << 4,
	/** a method that is reached by dispatch, like `print.foo` (see {@link SigDbInferable}) */
	Method    = 1 << 5,
	/** binds, rebinds, or removes names outside of its own frame, like `assign` or `library` */
	Scope     = 1 << 6,
	/** the result may differ between two identical calls for a reason neither `Random` nor `Ambient` covers (see {@link SigDbInferable}) */
	NonDet    = 1 << 7,
	/** draws from the random number generator, or sets its state (stated instead of `NonDet`) */
	Random    = 1 << 8,
	/** depends on ambient state like the clock, the locale, environment variables, or global options (stated instead of `NonDet`) */
	Ambient   = 1 << 9,
	/** touches the file system */
	File      = 1 << 10,
	/** produces a temporary path; on its own this touches no file system, so a call that also does states `File` too */
	TempFile  = 1 << 11,
	/**
	 * always reaches the network, like `curl::curl_download`. Calls that only do so for some arguments, like
	 * `read.csv` of a URL, are left to the `network-functions` rule, which decides that per call site.
	 */
	Network   = 1 << 12,
	/** runs a system command */
	Process   = 1 << 13,
	/** calls native code through the foreign function interface, like `.Call` */
	Ffi       = 1 << 14,
	/** produces a language object, like `quote` or `deparse` */
	Lang      = 1 << 15,
	/** asks the user, like `readline` or a file chooser */
	User      = 1 << 16,
	/** draws on a graphics device */
	Graphics  = 1 << 17,
	/** talks to a database */
	Database  = 1 << 18,
	/** reads the resource its `Resource` arguments name */
	Reads     = 1 << 19,
	/** writes the resource its `Resource` arguments name */
	Writes    = 1 << 20,
	/** may emit to standard output, like `print` or a `cat` without a `file`, and follows a `sink` when one is active */
	Prints    = 1 << 21,
	/**
	 * the result is bounded no matter what flows in: a count, an index, a logical, or one of the values of the
	 * argument marked {@link ArgProp.Bounds}. So nothing an argument carries reaches the result, which is what
	 * lets the input-sources query stop tracing at `length(x)` or `match.arg(arg, choices)`.
	 */
	Narrows   = 1 << 22,
	/**
	 * sets ambient state later calls read back: the working directory, environment variables, options, the
	 * locale, the RNG seed. The counterpart of {@link CallProp.Ambient}; a call doing both states both.
	 */
	Configures = 1 << 23,
	/** ends what an opener started: a graphics device, a connection, a sink. Narrower than {@link CallProp.Graphics}. */
	Closes     = 1 << 24,
	/** yields the paths it matches at run time rather than one it was handed (`list.files`, `Sys.glob`); empty is an answer */
	Glob       = 1 << 25,
	/** hands back what the program was invoked with, as `commandArgs` and the option parsers built on it do */
	CommandLine = 1 << 26,
	/** hands back a handle the program is expected to close again, like `file` or `DBI::dbConnect` */
	Opens       = 1 << 27,
	/** performs a statistical test, so its result is the test statistic a reader is meant to see (`t.test`, `anova`) */
	Statistics  = 1 << 28,
	/** marked for removal, with a better alternative available, like `dplyr::funs` */
	Deprecated  = 1 << 29,
	/** calling it forces every parameter, so nothing it is handed stays a promise (see {@link strictnessOfFunction}) */
	Strict      = 1 << 30,
	/**
	 * runs its work in parallel (workers, a cluster, a future/promise backend); says nothing about purity, only
	 * reproducibility and where an error surfaces. The last bit of the 32 a JS bitfield holds, so stay bitwise.
	 */
	Concurrent  = 1 << 31
}

/**
 * The {@link CallProp} bits that state an effect beyond computing a result, so no {@link CallProp.Pure}
 * definition may carry any of them.
 */
export const ImpureProps = CallProp.MayPure | CallProp.Scope | CallProp.NonDet | CallProp.Random | CallProp.Ambient | CallProp.File
	| CallProp.TempFile | CallProp.Network | CallProp.Process | CallProp.Ffi | CallProp.Lang | CallProp.User | CallProp.Graphics
	| CallProp.Database | CallProp.Reads | CallProp.Writes | CallProp.Prints | CallProp.Configures | CallProp.Closes | CallProp.Opens | CallProp.CommandLine;

/**
 * Which {@link CallProp} bits rule each other out, as `[bit, everything stating it forbids]`. A definition
 * that carries the left bit must carry none of the right ones; a test checks the {@link DefaultBuiltinConfig}
 * (and any configured built-ins) against this. Every other pair of bits combines freely.
 */
export const ExclusiveCallProps: readonly (readonly [bit: CallProp, forbidden: CallProps])[] = [
	[CallProp.Pure, ImpureProps],
	[CallProp.NonDet, CallProp.Random | CallProp.Ambient],
	[CallProp.Random, CallProp.Ambient]
];

/**
 * The {@link CallProp} bits of calls that bring in data of their own. A function that states its props and
 * carries none of these derives its result from its arguments, which is what {@link BuiltInIndex#without}
 * looks for.
 */
export const InputProps = CallProp.NonDet | CallProp.Random | CallProp.Ambient | CallProp.File | CallProp.TempFile
	| CallProp.Network | CallProp.Process | CallProp.Ffi | CallProp.Lang | CallProp.User | CallProp.CommandLine;

/**
 * The {@link CallProp} bits the signature database states itself, so {@link fnInfoFromSignature} can read them
 * off any package function without anyone writing them down.
 */
export const SigDbInferable = CallProp.Throws | CallProp.NonDet | CallProp.Method | CallProp.Generic | CallProp.Concurrent;

/**
 * The {@link CallProp} bits that say a call takes its data from a file, as {@link CallProp.File} alone also
 * covers the calls that only write one.
 */
export const FileInputProps = CallProp.File | CallProp.Reads;

/**
 * The {@link CallProp} bits that carry over from a callee to its caller: what the called function does, the
 * calling one does too. Purity does not travel this way, which is why it is not in here.
 */
export const PropagatedProps = CallProp.Throws | CallProp.Scope | CallProp.NonDet | CallProp.Prints | CallProp.Random | CallProp.Ambient
	| CallProp.File | CallProp.TempFile | CallProp.Network | CallProp.Process | CallProp.Ffi | CallProp.Lang | CallProp.User
	| CallProp.Graphics | CallProp.Database | CallProp.Reads | CallProp.Writes | CallProp.Configures | CallProp.CommandLine | CallProp.Concurrent;

/** a bitfield of {@link ArgProp} */
export type ArgProps = number;
/** a bitfield of {@link CallProp} */
export type CallProps = number;

/**
 * The formals of a built-in, in the order they are declared in, each with what its argument is used for.
 * A `...` entry stands for every argument from the position it appears at, and the entries behind it are matched
 * by their full name only.
 */
export type FnSig = [name: string, props: ArgProps][];

/**
 * The signature of a call that evaluates every argument and states nothing else, which is all that is known
 * about a callee flowR cannot resolve.
 */
const ForcingEvery: FnSig = [['...', ArgProp.Forced]];

/**
 * Utility functions for {@link FnSig|function signatures}.
 */
export const FnSig = {
	name:    'FnSig',
	/** The positional view of a signature; see {@link sigLayout}. */
	layout:  sigLayout,
	/** The roles of the argument at a position; see {@link argProp}. */
	propAt:  argProp,
	/** The positions carrying any of the given roles; see {@link argsWith}. */
	posWith: argsWith,
	/** Which of the first `count` arguments a call evaluates; see {@link forcedArgs}. */
	forced:  forcedArgs,
	/** A signature saying only that the call evaluates every argument; see {@link ForcingEvery}. */
	every:   ForcingEvery,
	/** A signature saying only that the call evaluates one argument; see {@link forcingOnly}. */
	only:    forcingOnly
} as const;

/** the {@link ArgProp} bit to its name; integer keys iterate in ascending bit order */
const ArgPropNames: Readonly<Record<ArgProp, string>> = {
	[ArgProp.Forced]:    'forced',
	[ArgProp.NoDefault]: 'no default',
	[ArgProp.Alias]:     'alias',
	[ArgProp.Value]:     'value',
	[ArgProp.Shape]:     'shape',
	[ArgProp.Flag]:      'flag',
	[ArgProp.Resource]:  'resource',
	[ArgProp.Written]:   'written',
	[ArgProp.Nse]:       'nse',
	[ArgProp.Callee]:    'callee',
	[ArgProp.Presence]:  'presence',
	[ArgProp.Bounds]:    'bounds',
	[ArgProp.Atomic]:    'atomic',
	[ArgProp.Handle]:    'handle',
	[ArgProp.Lazy]:      'lazy'
};

/** The bitfield the given {@link ArgProp}/{@link CallProp} member names stand for, unknown ones ignored. */
function maskOfNames(this: void, of: Record<string, string | number>, names: readonly string[]): number {
	let mask = 0;
	for(const name of names) {
		const bit = of[name];
		mask |= typeof bit === 'number' ? bit : 0;
	}
	return mask;
}

/** The words for whichever of `mask`'s bits appear in `entries`, shared by {@link ArgProps.words} and {@link CallProps.words}. */
function wordsOf(this: void, entries: readonly (readonly [number, string])[], mask: number | undefined): string[] {
	return mask === undefined ? [] : entries.filter(([bit]) => (mask & bit) !== 0).map(([, word]) => word);
}

/** A bit-keyed word table as `[bit, word]` pairs in ascending bit order, for {@link wordsOf}; shared by {@link ArgProps} and {@link CallProps}. */
function bitEntries(this: void, byBit: Readonly<Record<number, string>>): readonly (readonly [number, string])[] {
	return Object.entries(byBit).map(([bit, word]) => [Number(bit), word] as const);
}

const ArgPropEntries = bitEntries(ArgPropNames);

/**
 * Utility functions for {@link ArgProps|argument property bitfields}.
 */
export const ArgProps = {
	name:  'ArgProps',
	/** the {@link ArgProp} bit to its name, in ascending bit order */
	names: ArgPropNames,
	/** What an argument is used for, as words; see {@link wordsOf}. */
	words: (props: ArgProps | undefined): string[] => wordsOf(ArgPropEntries, props),
	/** The mask the given {@link ArgProp} member names stand for; see {@link maskOfNames}. */
	mask:  (names: readonly string[]): ArgProps => maskOfNames(ArgProp, names)
} as const;

/** the {@link CallProp} bit to the word a reader wants for it; keyed by bit rather than listed, so a bit added to the enum without a word here does not compile */
const CallPropWord: Readonly<Record<CallProp, string>> = {
	[CallProp.Pure]:        'pure',
	[CallProp.MayPure]:     'pure but runs what it is handed',
	[CallProp.Throws]:      'can throw',
	[CallProp.Invisible]:   'invisible',
	[CallProp.Generic]:     'generic',
	[CallProp.Method]:      's3 method',
	[CallProp.Scope]:       'changes scope',
	[CallProp.NonDet]:      'non deterministic',
	[CallProp.Random]:      'random',
	[CallProp.Ambient]:     'ambient state',
	[CallProp.File]:        'file system',
	[CallProp.TempFile]:    'temporary path',
	[CallProp.Network]:     'network',
	[CallProp.Process]:     'runs a process',
	[CallProp.Ffi]:         'foreign function interface',
	[CallProp.Lang]:        'language object',
	[CallProp.User]:        'asks the user',
	[CallProp.Graphics]:    'graphics',
	[CallProp.Database]:    'database',
	[CallProp.Reads]:       'reads',
	[CallProp.Writes]:      'writes',
	[CallProp.Prints]:      'prints',
	[CallProp.Narrows]:     'narrows',
	[CallProp.Configures]:  'configures',
	[CallProp.Closes]:      'closes',
	[CallProp.Glob]:        'glob',
	[CallProp.CommandLine]: 'command line',
	[CallProp.Opens]:       'opens',
	[CallProp.Statistics]:  'statistical test',
	[CallProp.Deprecated]:  'deprecated',
	[CallProp.Strict]:      'strict',
	[CallProp.Concurrent]:  'concurrent'
};

const CallPropEntries = bitEntries(CallPropWord);

/**
 * Utility functions for {@link CallProps|call property bitfields}.
 */
export const CallProps = {
	name:  'CallProps',
	/** What a call states about itself, as words; see {@link wordsOf}. */
	words: (props: CallProps | undefined): string[] => wordsOf(CallPropEntries, props),
	/** The mask the given {@link CallProp} member names stand for; see {@link maskOfNames}. */
	mask:  (names: readonly string[]): CallProps => maskOfNames(CallProp, names)
} as const;

/**
 * Semantics of a built-in that hold no matter which processor handles the call. The remaining facts already
 * have a home: the exit behavior in `cfg`, whether flowR can fold the call in the `evalHandler` of the
 * definition, and the fallback for everything unmodelled in `hasUnknownSideEffects`.
 */
export interface BuiltInFnInfo {
	/** the parameters and what each of their arguments is used for */
	readonly sig?:             FnSig
	/** bitfield of {@link CallProp} */
	readonly props?:           CallProps
	/** keep the environment on the call vertex, for a later pass to look names up in */
	readonly keepEnvironment?: boolean
	/**
	 * What this call lets the function around it reach about its own formals without naming one of them, e.g.
	 * `match.call()` ({@link ArgProp.Nse}) or `nargs()` ({@link ArgProp.Presence}); see {@link reflectiveRoles}.
	 */
	readonly frame?:           ArgProps
}

/** A {@link FnSig} in the form the call processors use it, see {@link sigLayout}. */
export interface SigLayout {
	/** the props of each declared parameter, in order */
	readonly props: readonly ArgProps[]
	/** the position of the `...` parameter, `-1` if there is none */
	readonly rest:  number
	/** every bit some parameter carries, so a call can skip the bits nobody uses */
	readonly any:   ArgProps
	/** the position of the {@link ArgProp.Alias} argument, handed back as the result, `-1` if there is none */
	readonly alias: number
}

const layouts = new WeakMap<FnSig, SigLayout>();

/**
 * The positional view of a {@link FnSig}, computed on first use and cached per signature object,
 * so declaring a signature costs nothing until a call actually needs it.
 */
function sigLayout(this: void, sig: FnSig): SigLayout {
	let layout = layouts.get(sig);
	if(layout === undefined) {
		const props = sig.map(p => p[1]);
		layout = {
			props,
			rest:  sig.findIndex(p => p[0] === '...'),
			any:   props.reduce((acc, p) => acc | p, 0),
			alias: props.findIndex(p => (p & ArgProp.Alias) !== 0)
		};
		layouts.set(sig, layout);
	}
	return layout;
}

/** The {@link ArgProp} bits of the argument at `index`, with `...` covering every position from where it appears. */
function argProp(this: void, { props, rest }: SigLayout, index: number): ArgProps {
	return (rest >= 0 && index >= rest ? props[rest] : props[index]) ?? 0;
}

/**
 * The signature of a call that evaluates the argument at `index` and states nothing else, as the apply family
 * does for the function it is handed. The positions before it are named for their place, having nothing to say.
 */
function forcingOnly(this: void, index: number, name: string): FnSig {
	return [...Array.from({ length: index }, (_, i) => [`..${i + 1}`, 0] as [string, ArgProps]), [name, ArgProp.Forced]];
}

/**
 * Which of the first `count` arguments the call evaluates, `undefined` when the signature states it of none.
 * A signature is the one place that says so, which is why nothing else may state it alongside.
 */
function forcedArgs(this: void, sig: FnSig | undefined, count: number): readonly boolean[] | undefined {
	if(sig === undefined) {
		return undefined;
	}
	const layout = sigLayout(sig);
	if((layout.any & ArgProp.Forced) === 0) {
		return undefined;
	}
	return Array.from({ length: count }, (_, i) => (argProp(layout, i) & ArgProp.Forced) !== 0);
}

/** The positions of the first `count` arguments that carry any of `prop`. */
function argsWith(this: void, layout: SigLayout, count: number, prop: ArgProps): number[] {
	const found: number[] = [];
	for(let i = 0; i < count; i++) {
		if((FnSig.propAt(layout, i) & prop) !== 0) {
			found.push(i);
		}
	}
	return found;
}

/** the {@link DecodedFunction#props} names that have a {@link CallProp} counterpart, together {@link SigDbInferable} */
const SigDbProps: Readonly<Record<string, CallProp>> = {
	'can-throw':         CallProp.Throws,
	'non-deterministic': CallProp.NonDet,
	's3-method':         CallProp.Method,
	'generic':           CallProp.Generic
};

/** the callees that make the calling function itself a generic ({@link CallProp.Generic}) */
export const DispatchCallees: ReadonlySet<string> = new Set(['UseMethod', 'standardGeneric', 'S7_dispatch']);

/**
 * The part of a {@link BuiltInFnInfo} the signature database already knows: the parameter names in order with
 * the {@link ArgProp} bits stored for each, plus the {@link SigDbProps} properties; everything else is dropped.
 */
export function fnInfoFromSignature(fn: DecodedFunction): BuiltInFnInfo {
	let props = 0;
	for(const name of fn.props) {
		props |= SigDbProps[name] ?? 0;
	}
	/* the `generic` property settles it; without one (an older bundle, or none stored) the dispatching callee does */
	if(!(props & CallProp.Generic) && fn.callees.some(c => DispatchCallees.has(c))) {
		props |= CallProp.Generic;
	}
	return { sig: fn.signature.map(p => [p.name, p.props]), props };
}
