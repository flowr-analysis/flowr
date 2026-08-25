import type { DecodedFunction } from '../../project/sigdb/decode';
import { Record } from '../../util/record';

/**
 * What a single argument of a call is used for, as a bitmask.
 * @see {@link BuiltInFnInfo#sig}
 */
export enum ArgProp {
	/** the result is this argument, handed back unchanged, like `x` in `identity(x)`; this is what draws the `Returns` edge */
	Alias    = 1 << 0,
	/** the result is computed from the argument's value, like `x` in `sum(x)` */
	Value    = 1 << 1,
	/** only the shape is used (length, dimensions, names, other attributes), like `x` in `nrow(x)` */
	Shape    = 1 << 2,
	/** selects a behavior instead of carrying data, like `na.rm` in `sum(x, na.rm = TRUE)` */
	Flag     = 1 << 3,
	/** names the resource the call reads or writes, like `file` in `write.csv(x, file)` */
	Resource = 1 << 4,
	/** what it refers to may be modified, like `envir` in `assign(x, v, envir = e)` */
	Written  = 1 << 5,
	/** evaluated whenever the call happens, even if the result goes unused, like `x` in `force(x)` */
	Forced   = 1 << 6,
	/** quoted or evaluated in another frame, like `expr` in `quote(expr)` */
	Nse      = 1 << 7,
	/** called as a function, like `FUN` in `lapply(x, FUN)` */
	Callee   = 1 << 8,
	/** only whether it was supplied matters, as with `missing()` */
	Presence = 1 << 9,
	/**
	 * the result is one of this argument's values, like `choices` in `match.arg(arg, choices)`. The bounding
	 * argument of a {@link SemanticCallTag.Narrows} call; without one such a call yields a value of its own making.
	 */
	Bounds   = 1 << 10,
	/**
	 * only atomic data works here, never a closure, as with `e1` in `e1 > e2`. A bare symbol in such an
	 * argument therefore names a variable even when a function of that name is in scope.
	 */
	Atomic   = 1 << 11,
	/** the open handle the call acts on, like `con` in `close(con)` */
	Handle   = 1 << 12
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
	Lang       = 1 << 11
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
	Deprecated  = 'deprecated'
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
export const SigDbInferable: CallProps = CallProp.Throws | CallProp.NonDet | CallProp.Method | CallProp.Generic;

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
	CallProp.Throws | CallProp.Scope | CallProp.NonDet | CallProp.Ambient | CallProp.Configures | CallProp.Ffi | CallProp.Lang,
	SemanticCallTag.Prints, SemanticCallTag.Random, SemanticCallTag.File, SemanticCallTag.TempFile, SemanticCallTag.Network,
	SemanticCallTag.Process, SemanticCallTag.User, SemanticCallTag.CommandLine, SemanticCallTag.Graphics,
	SemanticCallTag.Database, SemanticCallTag.Reads, SemanticCallTag.Writes
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
	name: 'Props',
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
	labels(stated: StatedProps | undefined): string[] {
		if(stated === undefined) {
			return [];
		}
		const callProps = Record.keys(CallPropLabels).filter(prop => ((stated?.props ?? 0) & prop) !== 0).map(prop => CallPropLabels[prop]);
		const semanticProps = stated.tags ?? [];

		return [...callProps, ...semanticProps];
	}
} as const;

/**
 * The formals of a built-in, in the order they are declared in, each with what its argument is used for.
 * A `...` entry stands for every argument from the position it appears at, and the entries behind it are matched
 * by their full name only.
 */
export type FnSig = [name: string, props: ArgProps][];

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
	posWith: argsWith
} as const;

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
	[CallProp.Lang]:       'produces language object'
};

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
	's3-method':         CallProp.Method
};

/** the callees that make the calling function itself a generic ({@link CallProp.Generic}) */
export const DispatchCallees: ReadonlySet<string> = new Set(['UseMethod', 'standardGeneric', 'S7_dispatch']);

/**
 * The part of a {@link BuiltInFnInfo} that the signature database already knows: the parameter names in order
 * (`...` included) with the ones R always forces, plus the properties listed in {@link SigDbProps}. Everything
 * else the database records (`higher-order`, `deprecated`, `recursive`, ...) has no counterpart here and is
 * dropped, and anything it cannot see (purity, resources, what an argument is used for) stays unset.
 */
export function fnInfoFromSignature(fn: DecodedFunction): BuiltInFnInfo {
	let props = 0;
	for(const name of fn.props) {
		props |= SigDbProps[name] ?? 0;
	}
	/* a function whose own body dispatches is the generic, which no property of the database states */
	if(fn.callees.some(c => DispatchCallees.has(c))) {
		props |= CallProp.Generic;
	}
	return {
		sig: fn.signature.map(p => [p.name,
			(p.forced ? ArgProp.Forced : 0) | (p.default === 'TRUE' || p.default === 'FALSE' ? ArgProp.Flag : 0)]),
		props
	};
}
