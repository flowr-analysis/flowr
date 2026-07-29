import type { DecodedFunction } from '../../project/sigdb/decode';

/**
 * What a single argument of a call is used for, as a bitmask.
 * @see {@link BuiltInFnInfo#sig}
 */
export enum ArgProp {
	/** the result is this argument, handed back unchanged, like `x` in `identity(x)` */
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
	Presence = 1 << 9
}

/**
 * What the call as a whole does, as a bitmask. The resource bits ({@link CallProp.File} and its neighbors)
 * say where the call gets its data from, which is what {@link InputProps} collects.
 * @see {@link BuiltInFnInfo#props}
 */
export enum CallProp {
	/** computes a result and nothing else, the positive counterpart of `hasUnknownSideEffects` */
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
	/** dispatches on the class of its first argument (S3, S4, or S7) */
	Generic   = 1 << 4,
	/** a method that is reached by dispatch, like `print.foo` (see {@link SigDbInferable}) */
	Method    = 1 << 5,
	/** binds, rebinds, or removes names outside of its own frame, like `assign` or `library` */
	Scope     = 1 << 6,
	/** the result may differ between two identical calls, refined by `Random` and `Ambient` (see {@link SigDbInferable}) */
	NonDet    = 1 << 7,
	/** draws from the random number generator, or sets its state */
	Random    = 1 << 8,
	/** depends on ambient state like the clock, the locale, environment variables, or global options */
	Ambient   = 1 << 9,
	/** touches the file system */
	File      = 1 << 10,
	/** produces a temporary path, the narrower case of `File` */
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
	Prints    = 1 << 21
}

/**
 * The {@link CallProp} bits of calls that bring in data of their own. A function that states its props and
 * carries none of these derives its result from its arguments, which is what {@link builtInsWithout} looks for.
 */
export const InputProps = CallProp.NonDet | CallProp.Random | CallProp.Ambient | CallProp.File
	| CallProp.TempFile | CallProp.Network | CallProp.Process | CallProp.Ffi | CallProp.Lang | CallProp.User;

/**
 * The {@link CallProp} bits the signature database states itself, so {@link fnInfoFromSignature} can read them
 * off any package function without anyone writing them down.
 */
export const SigDbInferable = CallProp.Throws | CallProp.NonDet | CallProp.Method | CallProp.Generic;

/**
 * The {@link CallProp} bits that say a call takes its data from a file, as {@link CallProp.File} alone also
 * covers the calls that only write one.
 */
export const FileInputProps = CallProp.File | CallProp.Reads;

/**
 * The {@link CallProp} bits that carry over from a callee to its caller: what the called function does, the
 * calling one does too. Purity does not travel this way, which is why it is not in here.
 */
export const PropagatedProps = CallProp.Throws | CallProp.Scope | CallProp.NonDet | CallProp.Prints
	| CallProp.Random | CallProp.Ambient | CallProp.File | CallProp.TempFile | CallProp.Network | CallProp.Process
	| CallProp.Ffi | CallProp.Lang | CallProp.User | CallProp.Graphics | CallProp.Database | CallProp.Reads | CallProp.Writes;

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
 * Semantics of a built-in that hold no matter which processor handles the call. The remaining facts already
 * have a home: the exit behavior in `cfg`, whether flowR can fold the call in the `evalHandler` of the
 * definition, and the fallback for everything unmodelled in `hasUnknownSideEffects`.
 */
export interface BuiltInFnInfo {
	/** the parameters and what each of their arguments is used for */
	readonly sig?:   FnSig
	/** bitfield of {@link CallProp} */
	readonly props?: CallProps
}

/** A {@link FnSig} in the form the call processors use it, see {@link sigLayout}. */
export interface SigLayout {
	/** the props of each declared parameter, in order */
	readonly props: readonly ArgProps[]
	/** the position of the `...` parameter, `-1` if there is none */
	readonly rest:  number
	/** every bit some parameter carries, so a call can skip the bits nobody uses */
	readonly any:   ArgProps
	/** the position of the argument handed back as the result, `-1` if there is none */
	readonly alias: number
}

const layouts = new WeakMap<FnSig, SigLayout>();

/**
 * The positional view of a {@link FnSig}, computed on first use and cached per signature object,
 * so declaring a signature costs nothing until a call actually needs it.
 */
export function sigLayout(sig: FnSig): SigLayout {
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
export function argProp({ props, rest }: SigLayout, index: number): ArgProps {
	return (rest >= 0 && index >= rest ? props[rest] : props[index]) ?? 0;
}

/** The positions of the first `count` arguments that carry any of `prop`. */
export function argsWith(layout: SigLayout, count: number, prop: ArgProps): number[] {
	const found: number[] = [];
	for(let i = 0; i < count; i++) {
		if((argProp(layout, i) & prop) !== 0) {
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
const DispatchCallees: ReadonlySet<string> = new Set(['UseMethod', 'standardGeneric', 'S7_dispatch']);

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
