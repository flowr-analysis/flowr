import type { BrandedIdentifier, BrandedNamespace } from './identifier';

/** The type of a value as R's `typeof` tells it, as a bitfield, with the three kinds of functions as one and the rest of what R has as {@link RValueType.Other}. */
export enum RValueType {
	Null        = 1 << 0,
	Logical     = 1 << 1,
	Integer     = 1 << 2,
	Double      = 1 << 3,
	Complex     = 1 << 4,
	Character   = 1 << 5,
	Raw         = 1 << 6,
	List        = 1 << 7,
	Pairlist    = 1 << 8,
	Function    = 1 << 9,
	Environment = 1 << 10,
	Symbol      = 1 << 11,
	Language    = 1 << 12,
	Expression  = 1 << 13,
	/** `S4`, `externalptr`, and the like */
	Other       = 1 << 14
}

/** a bitfield of {@link RValueType} */
export type RValueTypes = number;

/** What R has as a value at all. */
export const AnyType: RValueTypes = (1 << 15) - 1;

/** What a predicate over one value says about the type of the value. */
export interface TypePredicate {
	/** the types it can be true for */
	readonly yes:         RValueTypes
	/** it tells these types and no other, so finding it false rules them out as well, or does so only for a value without a class attribute, as `is.integer` is false for a factor */
	readonly exact?:      boolean | 'unclassed'
	/** a value with a class attribute of these types passes as well, like an S4 object holding an environment does for `is.environment` */
	readonly classedToo?: RValueTypes
	/** true for every value of these types without attributes, other than `NULL` */
	readonly plain?:      boolean
	/** only true for a value with a class attribute, like `is.data.frame` */
	readonly classed?:    boolean
	/** only true for something of length one */
	readonly scalar?:     boolean
	/** being true makes the value usable as a function */
	readonly callable?:   boolean
}

/** What not failing says about the argument a checking call was handed. */
export interface CheckingCall {
	readonly types?:              RValueTypes
	readonly classed?:            boolean
	/** the argument naming the only values allowed */
	readonly choices?:            BrandedIdentifier
	/** without that argument, the default of the formal it was handed states the choices */
	readonly choicesFromDefault?: boolean
	/** partial matches of the choices also pass */
	readonly partial?:            boolean
	/** a length-one value is all that passes */
	readonly scalar?:             boolean
	/** the arguments that let more through, each with the types it may add; anything else they take (`len`, `lower`) only narrows */
	readonly loosens?:            Readonly<Record<BrandedIdentifier, RValueTypes>>
	/** the arguments that keep it from failing at once, so not even the check itself is a guard, like `add` */
	readonly defers?:             readonly BrandedIdentifier[]
	/** failing is all it does when the argument was not given */
	readonly present?:            boolean
}

/** A condition R checks of the value bound to a formal, stated as data so that a configuration can change it. */
export type RCondition =
	/** the predicate holds of the value, or of what `of` reads off it, like `is.null(dim(x))` */
	| { readonly is: BrandedIdentifier, readonly of?: BrandedIdentifier }
	| { readonly not: RCondition }
	| { readonly any: readonly RCondition[] }
	| { readonly all: readonly RCondition[] }
	/** the length of the value compares to the given one */
	| { readonly length: '==' | '<=' | '>=', readonly to: number }
	/** the value can be applied as a function, which depends on the functions around */
	| { readonly callable: true };

/** The R versions something holds for, from `since` on and before `until`, either end open if left out. */
export interface RVersions {
	readonly since?: string
	readonly until?: string
}

/** A failure R raises by itself if the value bound to a formal does not pass a condition. */
export interface RFailure extends RVersions {
	readonly requires:    RCondition
	/** what R says, with `%s` for the value */
	readonly message:     string
	/** a value with a class attribute, or a classed other operand, may bring a method of its own, which lets anything through */
	readonly dispatches?: boolean
}

/** What the value a function returns is like, whatever it was handed. */
export interface ReturnedValue {
	readonly types:   RValueTypes
	/** it is a single value */
	readonly scalar?: boolean
	/** no element of it is `NA` */
	readonly notNA?:  boolean
	/** it counts something, so it holds whole numbers none of which is negative */
	readonly count?:  boolean
}

/** What a function has to do with the guards of what calls it, all read off the built-in definitions rather than its name. */
export interface GuardFacts {
	/** the package providing it, none for what R ships with */
	readonly pkg?:          BrandedNamespace
	/** it tells something about the type of its argument */
	readonly predicate?:    TypePredicate
	/** what it returns, with the types it returns that for, as `typeof` does */
	readonly reads?:        Readonly<Record<string, RValueTypes>>
	/** it reads whole numbers off its argument, which a comparison can bound: always one if `single`, one per element if `elementwise`, and one or none at all (`NULL`) if `nullable`, so `stopifnot` lets the latter pass without bounding anything */
	readonly measures?:     'single' | 'elementwise' | 'nullable'
	/** its not failing says something about its first argument */
	readonly check?:        CheckingCall
	/** it fails unless each of its arguments is a single `TRUE`, as `stopifnot` does elsewhere, with the arguments that are no conditions */
	readonly asserts?:      readonly BrandedIdentifier[]
	/** what R fails on for the value of each formal on top of evaluating it, a `callable` condition marking the formal holding what it applies at once */
	readonly asks?:         Readonly<Record<BrandedIdentifier, readonly RFailure[]>>
	/** it yields one logical, no matter how long its arguments are */
	readonly singleResult?: boolean
	/** what it returns, or `argument` for the one argument it was handed, as `invisible` returns it; a predicate, a measure, and what {@link GuardFacts.reads} need not state it */
	readonly returns?:      ReturnedValue | 'argument'
	/** it does not do anything but compute, whatever else is stated of it */
	readonly computes?:     boolean
	/** the formals a missing formal can be handed to without an error, as the special primitives matching their arguments themselves take it as not given */
	readonly missingOk?:    readonly BrandedIdentifier[]
	/** it hands out a frame or writes to one in a way the dataflow does not see */
	readonly opensFrame?:   boolean
	/** what holds instead for some R versions, in place of what is stated above */
	readonly changed?:      readonly (RVersions & { readonly facts: Omit<GuardFacts, 'changed'> })[]
}

/** What is stated about a function by its name alone, see {@link GuardFacts}. */
export type GuardFactsLookup = (name: BrandedIdentifier) => GuardFacts | undefined;
