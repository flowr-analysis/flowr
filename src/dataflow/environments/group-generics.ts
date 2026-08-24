/**
 * R's group generics, kept apart from the builtin configuration so anything may ask about them without pulling
 * the whole dataflow setup in (the signature database does, and that would be a cycle).
 */

const Arith = ['+', '-', '*', '/', '^', '**', '%%', '%/%'] as const;
const Compare = ['==', '!=', '<', '<=', '>', '>='] as const;
const Logic = ['&', '|'] as const;

/**
 * R's group generics: a class claims every member of a group at once, with an `Ops.cls` (S3) or a
 * `setMethod('Arith', ...)` (S4), so a call to any member may dispatch to a method named after the group.
 * `Ops` is what S3 calls the union of the three S4 groups it splits into.
 */
export const RGroupGenerics = {
	Arith, Compare, Logic,
	Ops:  [...Arith, ...Compare, ...Logic, '!'],
	Math: ['abs', 'sign', 'sqrt', 'floor', 'ceiling', 'trunc', 'exp', 'expm1', 'log', 'log2', 'log10', 'log1p',
		'cos', 'sin', 'tan', 'cosh', 'sinh', 'tanh', 'acos', 'asin', 'atan', 'acosh', 'asinh', 'atanh',
		'cospi', 'sinpi', 'tanpi', 'gamma', 'lgamma', 'digamma', 'trigamma',
		'cumsum', 'cumprod', 'cummax', 'cummin'],
	Math2:     ['round', 'signif'],
	Summary:   ['any', 'all', 'sum', 'prod', 'min', 'max', 'range'],
	Complex:   ['Re', 'Im', 'Mod', 'Arg', 'Conj'],
	matrixOps: ['%*%']
} as const satisfies Record<string, readonly string[]>;

/** what an S3 `Math.<class>` answers for: S3 has no `Math2`, so `round`/`signif` dispatch to it as well */
const MathS3: readonly string[] = [...RGroupGenerics.Math, ...RGroupGenerics.Math2];

/** the name of a group in {@link RGroupGenerics} */
export type RGroupGeneric = keyof typeof RGroupGenerics;

/** the S4 groups, i.e. {@link RGroupGenerics} without `Ops`, which only S3 knows */
const S4Groups = ['Arith', 'Compare', 'Logic', 'Math', 'Math2', 'Summary', 'Complex', 'matrixOps'] as const;

/**
 * Member name to its S4 group (`sin` to `Math`, `+` to `Arith`). `Ops` is left out so `+` answers `Arith`
 * rather than both. A package exporting such a name usually does so because it registered a method for one of
 * its classes, so the name says far less about the package than an ordinary export would.
 */
export const S4GroupOfMember: ReadonlyMap<string, string> = new Map(
	S4Groups.flatMap(group => RGroupGenerics[group].map(member => [member as string, group as string])));

/** The S4 group generic `name` is a member of, `undefined` for a name that is in none. */
export function groupGenericOf(name: string): string | undefined {
	return S4GroupOfMember.get(name);
}

/** The members a method registered on `name` answers for, `undefined` when `name` names no group (`Ops` flattened to its operators). */
export function groupGenericMembers(name: string): readonly string[] | undefined {
	return RGroupGenerics[name as RGroupGeneric];
}

/** The members an S3 `<group>.<class>` method answers for; S3 has no `Math2`, so `Math` covers both (see {@link MathS3}). */
export function s3GroupGenericMembers(name: string): readonly string[] | undefined {
	return name === 'Math' ? MathS3 : groupGenericMembers(name);
}

/** Whether `name` is one of R's group generics (see {@link RGroupGenerics}). */
export function isGroupGeneric(name: string): name is RGroupGeneric {
	return Object.hasOwn(RGroupGenerics, name);
}
