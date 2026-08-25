import type { DecodedFunction } from '../../project/sigdb/decode';
import { Record } from '../../util/record';

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
	 * argument of a {@link SemanticCallTag.Narrows} call; without one such a call yields a value of its own making.
	 */
	Bounds    = 1 << 11,
	/**
	 * only atomic data works here, never a closure, as with `e1` in `e1 > e2`. A bare symbol in such an
	 * argument therefore names a variable even when a function of that name is in scope.
	 */
	Atomic    = 1 << 12,
	/** the open handle the call acts on, like `con` in `close(con)` */
	Handle     = 1 << 13,
	/** never evaluated, the definite counterpart of {@link ArgProp.Forced}: no path of the body reads it */
	Lazy       = 1 << 14,
	/**
	 * open to injection, so a call handing it unescaped data is a finding: system commands, R expressions,
	 * database queries, HTML, or JavaScript.
	 */
	Injectable = 1 << 15
}

/**
 * The properties of the behavior of a call, as a bitmask.
 * @see {@link BuiltInFnInfo#props}
 */
export enum CallProp {
	/** computes a result and nothing else, the positive counterpart of `hasUnknownSideEffects` (excludes {@link ImpureProps}) */
	Pure       = 1 << 0,
	/**
	 * pure on its own, but it runs code it is handed, so whatever that code does happens too.
	 * The parameter it runs is marked {@link ArgProp.Callee} or {@link ArgProp.Nse}, as with `lapply(x, f)`.
	 */
	MayPure    = 1 << 1,
	/** may signal an error, like `stop()` (see {@link SigDbInferable}) */
	Throws     = 1 << 2,
	/** returns invisibly, so the result is not auto-printed */
	Invisible  = 1 << 3,
	/** dispatches on the class of an argument (S3, S4, or S7), a group generic like `+` on either operand */
	Generic    = 1 << 4,
	/** a method that is reached by dispatch, like `print.foo` (see {@link SigDbInferable}) */
	Method     = 1 << 5,
	/** binds, rebinds, or removes names outside of its own frame, like `assign` or `library` */
	Scope      = 1 << 6,
	/** the result may differ between two identical calls for a reason neither `Random` nor `Ambient` covers (see {@link SigDbInferable}) */
	NonDet     = 1 << 7,
	/** depends on ambient state like the clock, the locale, environment variables, or global options (stated instead of `NonDet`) */
	Ambient    = 1 << 8,
	/**
	 * sets ambient state later calls read back: the working directory, environment variables, options, the
	 * locale, the RNG seed. The counterpart of {@link CallProp.Ambient}; a call doing both states both.
	 */
	Configures = 1 << 9,
	/** calls native code through the foreign function interface, like `.Call` */
	Ffi        = 1 << 10,
	/** produces a language object, like `quote` or `deparse` */
	Lang       = 1 << 11,
	/** calling it forces every parameter, so nothing it is handed stays a promise (see {@link strictnessOfFunction}) */
	Strict     = 1 << 12,
	/**
	 * runs its work in parallel (workers, a cluster, a future/promise backend); says nothing about purity, only
	 * reproducibility and where an error surfaces.
	 */
	Concurrent = 1 << 13
}

/**
 * The semantic properties of the behavior of a call.
 * @see {@link BuiltInFnInfo#tags}
 */
export enum SemanticCallTag {
	/** draws from the random number generator, or sets its state (stated instead of `NonDet`) */
	Random      = 'random',
	/** touches the file system */
	File        = 'file',
	/** produces a temporary path; on its own this touches no file system, so a call that also does states `File` too */
	TempFile    = 'temp-file',
	/**
	 * always reaches the network, like `curl::curl_download`. Calls that only do so for some arguments, like
	 * `read.csv` of a URL, are left to the `network-functions` rule, which decides that per call site.
	 */
	Network     = 'network',
	/** runs a system command */
	Process     = 'process',
	/** asks the user, like `readline` or a file chooser */
	User        = 'asks-user',
	/** hands back what the program was invoked with, as `commandArgs` and the option parsers built on it do */
	CommandLine = 'command-line',
	/** yields the paths it matches at run time rather than one it was handed (`list.files`, `Sys.glob`); empty is an answer */
	Glob        = 'glob',
	/** draws on a graphics device */
	Graphics    = 'draws-graphics',
	/** talks to a database */
	Database    = 'database',
	/** hands back a handle the program is expected to close again, like `file` or `DBI::dbConnect` */
	Opens       = 'opens-handle',
	/** ends what an opener started: a graphics device, a connection, a sink. Narrower than {@link SemanticCallTag.Graphics}. */
	Closes      = 'closes-handle',
	/** reads the resource its `Resource` arguments name */
	Reads       = 'reads',
	/** writes the resource its `Resource` arguments name */
	Writes      = 'writes',
	/** may emit to standard output, like `print` or a `cat` without a `file`, and follows a `sink` when one is active */
	Prints      = 'prints',
	/**
	 * the result is bounded no matter what flows in: a count, an index, a logical, or one of the values of the
	 * argument marked {@link ArgProp.Bounds}. So nothing an argument carries reaches the result, which is what
	 * lets the input-sources query stop tracing at `length(x)` or `match.arg(arg, choices)`.
	 */
	Narrows     = 'narrows-args',
	/** performs a statistical test, so its result is the test statistic a reader is meant to see (`t.test`, `anova`) */
	Statistics  = 'statistics',
	/** marked for removal, with a better alternative available, like `dplyr::funs` */
	Deprecated  = 'deprecated',
	/** dynamically executes R code or returns the value of dynamically computed identifiers, like `eval`, `do.call`, or `get` */
	Eval        = 'eval',
	/** produces raw HTML or JavaScript, such as `shiny::HTML` */
	Html        = 'html',
	/** produces raw JavaScript code, such as `shinyjs::runjs` */
	JavaScript  = 'javascript'
}

/** a bitfield of {@link ArgProp} */
export type ArgProps = number;
/** a bitfield of {@link CallProp} */
export type CallProps = number;
/** the {@link SemanticCallTag} entries of a call, in the order they were stated */
export type SemanticCallTags = SemanticCallTag[];

/**
 * The stated properties of a call, including the {@link CallProp} bitfield and {@link SemanticCallTag} array.
 */
export interface StatedProps {
	/** the bitfield of {@link CallProp} */
	readonly props?: CallProps
	/** the array of {@link SemanticCallTag} */
	readonly tags?:  SemanticCallTags
}

/**
 * A selector to check for {@link CallProp}s or {@link SemanticCallTag}s
 */
export type PropSelector = CallProp | CallProps | SemanticCallTag | readonly (CallProps | SemanticCallTag)[] | PropMask;

/**
 * A selector in the form the {@link CallProps} helpers work with, including the {@link CallProp} bitfield and {@link SemanticCallTag} set.
 */
export interface PropMask {
	readonly props: CallProps
	readonly tags:  ReadonlySet<SemanticCallTag>
}

/**
 * The properties that state an effect beyond computing a result, so no {@link CallProp.Pure} definition may carry any of them.
 */
export const ImpureProps: PropMask = getPropMask([
	CallProp.MayPure | CallProp.Scope | CallProp.NonDet | CallProp.Ambient | CallProp.Configures | CallProp.Ffi | CallProp.Lang,
	SemanticCallTag.Random, SemanticCallTag.File, SemanticCallTag.TempFile, SemanticCallTag.Network, SemanticCallTag.Process,
	SemanticCallTag.User, SemanticCallTag.CommandLine, SemanticCallTag.Graphics, SemanticCallTag.Database,
	SemanticCallTag.Opens, SemanticCallTag.Closes, SemanticCallTag.Reads, SemanticCallTag.Writes, SemanticCallTag.Prints
]);

/**
 * Which properties rule each other out, as `[property, everything stating it forbids]`. A definition that
 * carries the left one must carry none of the right ones; a test checks the {@link DefaultBuiltinConfig}
 * (and any configured built-ins) against this. Every other pair combines freely.
 */
export const ExclusiveCallProps: readonly (readonly [prop: PropMask, forbidden: PropMask])[] = [
	[getPropMask(CallProp.Pure), ImpureProps],
	[getPropMask(CallProp.NonDet), getPropMask([SemanticCallTag.Random, CallProp.Ambient])],
	[getPropMask(SemanticCallTag.Random), getPropMask(CallProp.Ambient)]
];

/**
 * The properties of calls that bring in data of their own. A function that states its props and carries none
 * of these derives its result from its arguments, which is what {@link BuiltInIndex#without} looks for.
 */
export const InputProps: PropMask = getPropMask([
	CallProp.NonDet | CallProp.Ambient | CallProp.Ffi | CallProp.Lang,
	SemanticCallTag.Random, SemanticCallTag.File, SemanticCallTag.TempFile, SemanticCallTag.Network, SemanticCallTag.Process,
	SemanticCallTag.User, SemanticCallTag.CommandLine
]);

/**
 * The {@link CallProp} bits the signature database states itself, so {@link fnInfoFromSignature} can read them
 * off any package function without anyone writing them down.
 */
export const SigDbInferable: CallProps = CallProp.Throws | CallProp.NonDet | CallProp.Method | CallProp.Generic | CallProp.Concurrent;

/**
 * The properties that say a call takes its data from a file, as {@link SemanticCallTag.File} alone also covers
 * the calls that only write one.
 */
export const FileInputProps: PropMask = getPropMask([SemanticCallTag.File, SemanticCallTag.Reads]);

/**
 * The properties that carry over from a callee to its caller: what the called function does, the calling one
 * does too. Purity does not travel this way, which is why it is not in here.
 */
export const PropagatedProps: PropMask = getPropMask([
	CallProp.Throws | CallProp.Scope | CallProp.NonDet | CallProp.Ambient | CallProp.Configures | CallProp.Ffi | CallProp.Lang | CallProp.Concurrent,
	SemanticCallTag.Random, SemanticCallTag.File, SemanticCallTag.TempFile, SemanticCallTag.Network,
	SemanticCallTag.Process, SemanticCallTag.User, SemanticCallTag.CommandLine, SemanticCallTag.Graphics,
	SemanticCallTag.Database, SemanticCallTag.Reads, SemanticCallTag.Writes, SemanticCallTag.Prints,
	SemanticCallTag.Eval, SemanticCallTag.Html, SemanticCallTag.JavaScript
]);

/** Checks whether a {@link PropSelector} is a bitfield of {@link CallProp}s */
function isCallProp(this: void, selector: PropSelector): selector is CallProp | CallProps {
	return typeof selector === 'number';
}

/** Checks whether a {@link PropSelector} is a {@link SemanticCallTag} */
function isSemanticTag(this: void, selector: PropSelector): selector is SemanticCallTag {
	return typeof selector === 'string';
}

/** Checks whether a {@link PropSelector} is an already computed {@link PropMask} */
function isPropMask(this: void, selector: PropSelector): selector is PropMask {
	return typeof selector === 'object' && 'props' in selector && 'tags' in selector;
}

/** Generates a {@link PropMask} for a property selector. */
function getPropMask(this: void, selector: PropSelector): PropMask {
	if(isCallProp(selector)) {
		return { props: selector, tags: new Set() };
	} else if(isSemanticTag(selector)) {
		return { props: 0, tags: new Set([selector]) };
	} else if(isPropMask(selector)) {
		return selector;
	}
	let props = 0;
	const tags = new Set<SemanticCallTag>();

	for(const prop of selector) {
		if(typeof prop === 'number') {
			props |= prop;
		} else {
			tags.add(prop);
		}
	}
	return { props, tags };
}

/**
 * Helper functions to work with {@link CallProp}s and {@link SemanticCallTag}s of calls.
 * All helpers use {@link PropSelector}s to identify call properties.
 */
export const CallProps = {
	name: 'CallProps',
	/** Checks whether a {@link PropSelector} is a bitfield of {@link CallProp}s. */
	isCallProp,
	/** Checks whether a {@link PropSelector} is a {@link SemanticCallTag}. */
	isSemanticTag,
	/** Whether stated properties carry at least one property of a selector, or any property at all. */
	hasAny(this: void, stated: StatedProps | undefined, selector?: PropSelector): boolean {
		if(selector === undefined) {
			return stated?.props !== undefined || stated?.tags !== undefined;
		}
		const mask = getPropMask(selector);

		return ((stated?.props ?? 0) & mask.props) !== 0 || (stated?.tags?.some(prop => mask.tags.has(prop)) ?? false);
	},
	/** Whether stated properties carry every property of a selector. */
	hasAll(this: void, stated: StatedProps | undefined, selector: PropSelector): boolean {
		const mask = getPropMask(selector);

		return ((stated?.props ?? 0) & mask.props) === mask.props && mask.tags.values().every(prop => stated?.tags?.includes(prop));
	},
	/** Joins the {@link CallProp}s and {@link SemanticCallTag}s of two stated properties */
	join(this: void, props1: StatedProps | undefined, props2: StatedProps | undefined): StatedProps {
		const props = props1?.props === undefined ? props2?.props : (props2?.props === undefined ? props1.props : props1.props | props2.props);
		const tags = props1?.tags === undefined ? props2?.tags :
			(props2?.tags === undefined ? props1.tags : [...new Set([...props1.tags, ...props2.tags])]);

		return { props, tags };
	},
	/** Keep only the properties in the stated properties that are in the property selector. */
	filter(this: void, stated: StatedProps | undefined, selector: PropSelector): StatedProps {
		const mask = getPropMask(selector);

		return {
			props: (stated?.props ?? 0) & mask.props,
			tags:  stated?.tags?.filter(prop => mask.tags.has(prop))
		};
	},
	/** Transforms a property selector into a unique string identifier. */
	key(this: void, selector: PropSelector): string {
		const mask = getPropMask(selector);

		return `${mask.props}|${[...mask.tags].sort().join(',')}`;
	},
	/** Gets the property names for a property selector. */
	names(this: void, selector: PropSelector): string[] {
		const mask = getPropMask(selector);

		return [
			...Record.entries(CallProp).filter(([, prop]) => (prop & mask.props) !== 0).map(([name]) => name),
			...Record.entries(SemanticCallTag).filter(([, prop]) => mask.tags.has(prop)).map(([name]) => name)
		];
	},
	/** Gets the string labels for stated properties {@link CallPropLabels}. */
	labels(this: void, stated: StatedProps | undefined): string[] {
		if(stated === undefined) {
			return [];
		}
		const callProps = Record.keys(CallPropLabels).filter(prop => ((stated?.props ?? 0) & prop) !== 0).map(prop => CallPropLabels[prop]);
		const semanticProps = stated.tags ?? [];

		return [...callProps, ...semanticProps];
	},
	/** The {@link CallPropLabels} words for a bare {@link CallProps} bitfield, as inferred functions carry one. */
	words(this: void, props: CallProps | undefined): string[] {
		return props === undefined ? [] : Record.keys(CallPropLabels).filter(prop => (props & prop) !== 0).map(prop => CallPropLabels[prop]);
	},
	/** The {@link PropMask} the given {@link CallProp}/{@link SemanticCallTag} member names stand for, unknown ones ignored. */
	mask(this: void, names: readonly string[]): PropMask {
		const tags = new Set<SemanticCallTag>();
		for(const name of names) {
			const tag = (SemanticCallTag as Record<string, SemanticCallTag | undefined>)[name];
			if(tag !== undefined) {
				tags.add(tag);
			}
		}
		return { props: maskOfNames(CallProp, names), tags };
	},
	/** Whether a {@link PropMask} names nothing at all, so filtering by it can only answer with nothing. */
	isEmptyMask(this: void, mask: PropMask): boolean {
		return mask.props === 0 && mask.tags.size === 0;
	}
} as const;

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
	[ArgProp.Forced]:     'forced',
	[ArgProp.NoDefault]:  'no default',
	[ArgProp.Alias]:      'alias',
	[ArgProp.Value]:      'value',
	[ArgProp.Shape]:      'shape',
	[ArgProp.Flag]:       'flag',
	[ArgProp.Resource]:   'resource',
	[ArgProp.Written]:    'written',
	[ArgProp.Nse]:        'nse',
	[ArgProp.Callee]:     'callee',
	[ArgProp.Presence]:   'presence',
	[ArgProp.Bounds]:     'bounds',
	[ArgProp.Atomic]:     'atomic',
	[ArgProp.Handle]:     'handle',
	[ArgProp.Lazy]:       'lazy',
	[ArgProp.Injectable]: 'injectable'
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

/** the properties as the words a reader wants, in the order they are declared */
const CallPropLabels: Readonly<Record<CallProp, string>> = {
	[CallProp.Pure]:       'pure',
	[CallProp.MayPure]:    'maybe pure',
	[CallProp.Throws]:     'can throw',
	[CallProp.Invisible]:  'invisible',
	[CallProp.Generic]:    'generic',
	[CallProp.Method]:     's3 method',
	[CallProp.Scope]:      'changes scope',
	[CallProp.NonDet]:     'non deterministic',
	[CallProp.Ambient]:    'ambient state',
	[CallProp.Configures]: 'sets ambient state',
	[CallProp.Ffi]:        'calls native code',
	[CallProp.Lang]:       'produces language object',
	[CallProp.Strict]:     'strict',
	[CallProp.Concurrent]: 'concurrent'
};

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

/**
 * Semantics of a built-in that hold no matter which processor handles the call. The remaining facts already
 * have a home: the exit behavior in `cfg`, whether flowR can fold the call in the `evalHandler` of the
 * definition, and the fallback for everything unmodelled in `hasUnknownSideEffects`.
 */
export interface BuiltInFnInfo extends StatedProps {
	/** the parameters and what each of their arguments is used for */
	readonly sig?:             FnSig
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
