/* The kinds the built-in configuration states, kept free of runtime imports so loading the configuration stays cheap. */

/** Options that affect how values are printed and formatted (read by `print`, `format`, and `cat`). */
export const PrintingOptions: readonly string[] = ['digits', 'width', 'max.print', 'digits.secs', 'useFancyQuotes'];

/** The parts of the ambient state with a single value a scoped call (`withr::with_dir`) may change, other than the entries of a {@link KeyedState}. */
export enum AmbientSingleState {
	Graphics = 'graphics',
	Device = 'device',
	Rng = 'rng',
	WorkingDirectory = 'wd'
}

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
