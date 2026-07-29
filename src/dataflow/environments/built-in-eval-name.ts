/**
 * The names of all value-solver handlers a built-in function may declare with
 * {@link BuiltInFunctionDefinition#evalHandler}, see {@link BuiltInEvalHandlerMapper} for the implementations.
 */
export enum BuiltInEvalName {
	/** `c(...)`, see {@link resolveAsVector} */
	Vector = 'eval:vector',
	/** the sequence operator `:`, see {@link resolveAsSeq} */
	Seq = 'eval:seq',
	/** every numeric operator and function, from `+` to `sqrt`, see {@link resolveAsNumeric} */
	Numeric = 'eval:numeric',
	/** the comparison operators, see {@link resolveAsComparison} */
	Comparison = 'eval:cmp',
	/** `!` and the binary logical operators, see {@link resolveAsLogical} */
	Logical = 'eval:logical',
	/** every string function, from `paste` to `basename`, see {@link resolveAsStringFn} */
	StringFn = 'eval:string-fn',
	/** the grouping `(`, see {@link resolveAsGroup} */
	Group = 'eval:group'
}
