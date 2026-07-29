/**
 * The names of all value-solver handlers a built-in function may declare with
 * {@link BuiltInFunctionDefinition#evalHandler}, see {@link BuiltInEvalHandlerMapper} for the implementations.
 */
export enum BuiltInEvalName {
	/** `c(...)`, see {@link resolveAsVector} */
	Vector = 'eval:vector',
	/** the sequence operator `:`, see {@link resolveAsSeq} */
	Seq = 'eval:seq',
	/** the unary and binary arithmetic operators, see {@link resolveAsArithmetic} */
	Arithmetic = 'eval:arith',
	/** the comparison operators, see {@link resolveAsComparison} */
	Comparison = 'eval:cmp',
	/** `!` and the binary logical operators, see {@link resolveAsLogical} */
	Logical = 'eval:logical',
	/** the one-argument math functions, see {@link resolveAsMath} */
	Math = 'eval:math',
	/** the string-joining calls, see {@link resolveAsPaste} */
	Paste = 'eval:paste',
	/** the one-string-argument functions like `basename` or `toupper`, see {@link resolveAsStringFn} */
	StringFn = 'eval:string-fn',
	/** the grouping `(`, see {@link resolveAsGroup} */
	Group = 'eval:group'
}
