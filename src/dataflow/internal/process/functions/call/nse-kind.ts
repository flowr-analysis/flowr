/**
 * Which arguments of a call {@link markArgumentsAsNonStandardEvaluation|are non-standardly evaluated}:
 * every argument, all but the (data) first one, or only the first one.
 */
export enum NseArguments {
	/** every argument, e.g. the operands of a formula `~` or `aes(x, y)` */
	All         = 'all',
	/** all but the first, e.g. `subset(data, col > 1)` where the first argument is the data object */
	AllButFirst = 'all-but-first',
	/** only the first, e.g. the native routine name in `.C(routine, ...)` */
	First       = 'first'
}

/**
 * How an argument escapes standard evaluation, which decides what is marked
 * {@link EdgeType.NonStandardEvaluation}.
 */
export enum NseKind {
	/** the argument is not evaluated at all (`quote(x + y)`), so nothing within it is */
	Quoted      = 'quoted',
	/** the argument is evaluated in a data mask (`subset(d, a > k)`), where only its symbols may name columns */
	DataMasked  = 'data-masked',
	/** evaluated, just not exactly once (a loop body), so only the argument itself is marked */
	Reevaluated = 'reevaluated'
}
