/* The kinds the built-in configuration states, kept free of runtime imports so loading the configuration stays cheap. */

/** Options that affect how values are printed and formatted (read by `print`, `format`, and `cat`). */
export const PrintingOptions: readonly string[] = ['digits', 'width', 'max.print', 'digits.secs', 'useFancyQuotes', 'scipen', 'OutDec'];

/** Options that affect how a number turns into text, even outside printing (`paste(1e5)` reads `scipen`, `as.character(1.5)` reads `OutDec`). */
export const NumberFormatOptions: readonly string[] = ['scipen', 'OutDec'];

/** The parts of the ambient state with a single value a scoped call (`withr::with_dir`) may change, other than the entries of a {@link KeyedState}. */
export enum AmbientSingleState {
	Graphics = 'graphics',
	Device = 'device',
	/** the console output, which `capture.output` diverts for its code */
	Sink = 'sink',
	Rng = 'rng',
	WorkingDirectory = 'wd'
}

/** The escape a quoting function offers, a property of the function: `quote(!!x)` negates, `expr(!!x)` splices. */
export enum Unquote {
	/** no escape at all, everything within the argument stays unevaluated */
	None   = 'none',
	/** rlang's `!!` and `!!!` splice in the value of their operand */
	Rlang  = 'rlang',
	/** `bquote`'s `.(x)` evaluates its operand */
	Bquote = 'bquote'
}

/**
 * Classifies the type of exit point encountered.
 * @see {@link ExitPoint}
 */
export const enum ExitPointType {
	/** The exit point is the implicit (last executed expression of a function/block) */
	Default = 0,
	/** The exit point is an explicit `return` call (or an alias of it) */
	Return = 1,
	/** The exit point is an explicit `break` call (or an alias of it) */
	Break = 2,
	/** The exit point is an explicit `next` call (or an alias of it) */
	Next = 3,
	/** The exit point is caused by an error being thrown, e.g., by `stop` or `stopifnot` */
	Error = 4
}

export enum KnownHooks {
	/** Triggers on the exit of a function, no matter how this exit is enforced. */
	OnFnExit = 'fn-exit',
}

/** The object system a declaration belongs to. */
export const enum ClassSystem {
	/** `setClass`, `setClassUnion`, `setIs`, `setValidity` */
	S4 = 's4',
	/** Reference Classes, `setRefClass` */
	RefClass = 'rc',
	/** `S7::new_class` */
	S7 = 's7',
	/** `R6::R6Class` */
	R6 = 'r6'
}

/** Where a member of an R6/Reference class lives; R6 also has active bindings, which read like fields. */
export const enum MemberVisibility {
	Public  = 'public',
	Private = 'private',
	/** an R6 active binding: a function that is read and written like a field */
	Active  = 'active'
}

export const UnnamedFunctionCallPrefix = 'unnamed-fc-';

export const Top = { type: Symbol('⊤') };
export const Bottom = { type: Symbol('⊥') };

/** The access operators that name what they access, `$` and `@`. */
export const NamedAccessOperators = ['$', '@'] as const;
