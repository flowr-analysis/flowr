import type { BuiltInConstantDefinition, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from '../built-in-config';
import type { BuiltInProcessorMapper } from '../built-in';
import type { BrandedIdentifier, BrandedNamespace, Identifier, PkgName } from '../identifier';
import { CallProp, type FnSig, SemanticCallTag } from '../built-in-props';
import { Forced, sig } from './signatures';

type Processor = keyof typeof BuiltInProcessorMapper;
type FnConfig<P extends Processor> = NonNullable<BuiltInFunctionDefinition<P>['config']>;
type FnMore<P extends Processor> = Partial<Pick<BuiltInFunctionDefinition<P>, 'assumePrimitive' | 'overrides' | 'evalHandler' | 'operators'>>;

/**
 * The definition models a primitive, which is available even in an empty environment.
 * Pass it as the last argument of {@link fn} or {@link constant}.
 * Keep in mind that this is about the environment only: whether R lists a name as primitive
 * (and so labels the call with {@link CallProp.Primitive}) is decided separately from R's own list of primitives.
 * @example
 * ```ts
 * constant(base('Inf'), Infinity, Primitive)
 * ```
 */
export const Primitive = { assumePrimitive: true } as const;
/**
 * The definition replaces an earlier one of the same name.
 * Without it, a name defined twice is taken for an accident, and a test fails. Prefer a
 * more specific definition that sets this over deleting the earlier one, and pass it as the last argument of {@link fn}.
 * @example
 * ```ts
 * fn(stats('rnorm'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.Random] }, Overrides)
 * ```
 */
export const Overrides = { overrides: true } as const;

/**
 * The names `names` exported by the package `namespace`, e.g. `pkg(PkgName.Base, 'length', 'nrow')`.
 * The result is a fresh list of identifiers, so it is safe to spread into other lists. There are shortcuts for the
 * most frequent packages ({@link base}, {@link utils}, {@link stats}, {@link methods}). Names do not take backticks,
 * and the same name may be defined for several packages with several calls (e.g., for re-exports).
 * @example
 * ```ts
 * pkg(PkgName.Haven, 'read_sas', 'read_sav') // [['read_sas', 'haven'], ['read_sav', 'haven']]
 * ```
 */
export function pkg(namespace: PkgName | string, ...names: string[]): Identifier[] {
	/* `Identifier.fromAll`, without loading the identifier helpers: the parser loads the operator definitions */
	return names.map(n => [n as BrandedIdentifier, namespace as BrandedNamespace]);
}

/**
 * `pkg(PkgName.Base, ...)`, the most frequent package
 * @example
 * ```ts
 * base('length', 'nrow') // [['length', 'base'], ['nrow', 'base']]
 * ```
 */
export const base = (...names: string[]): Identifier[] => pkg('base', ...names);
/** `pkg(PkgName.Utils, ...)`, see {@link base} */
export const utils = (...names: string[]): Identifier[] => pkg('utils', ...names);
/** `pkg(PkgName.Stats, ...)`, see {@link base} */
export const stats = (...names: string[]): Identifier[] => pkg('stats', ...names);
/** `pkg(PkgName.Methods, ...)`, see {@link base} */
export const methods = (...names: string[]): Identifier[] => pkg('methods', ...names);

/**
 * A built-in function: what it is called, the processor handling its calls, the processor's configuration, and more.
 * The type of `config` follows the `processor`, so the compiler tells you what the processor accepts.
 * Keep in mind that the position in the list of definitions matters, as a later definition of a name shadows an earlier
 * one only if it states {@link Overrides}, and that a function without a `sig` has its arguments treated as plain values.
 * @param names     - what the function is called, see {@link pkg}
 * @param processor - the processor handling the calls, see {@link BuiltInProcName}
 * @param config    - the configuration of the processor, such as the `sig` and the `props`
 * @param more      - {@link Primitive} or {@link Overrides}
 * @example
 * ```ts
 * fn(base('nrow', 'ncol'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: ArgProp.Forced | ArgProp.Shape }) })
 * ```
 */
export function fn<P extends Processor>(names: readonly Identifier[], processor: P, config?: FnConfig<P>, more?: FnMore<P>): BuiltInFunctionDefinition<P> {
	return { type: 'function', names: names as Identifier[], processor, config, ...more };
}

/**
 * A built-in constant like `TRUE` or `pi`. The value is what flowR assumes the constant evaluates to,
 * which is what value resolution reports for a read of it, so give the R value, or `Top` if it is unknown (like `NA`).
 * @example
 * ```ts
 * constant(base('TRUE', 'T'), true, Primitive)
 * ```
 */
export function constant<T>(names: readonly Identifier[], value: T, more?: Pick<BuiltInConstantDefinition<T>, 'assumePrimitive' | 'overrides'>): BuiltInConstantDefinition<T> {
	return { type: 'constant', names: names as Identifier[], value, ...more };
}

/**
 * Replacement functions like `names(x) <- v`, defined for each of the assignment `suffixes`.
 * The name is the one of the getter (`names`), and the definition covers the replacement forms (`names<-`), so do not
 * add the suffix to the names. `<<-` is a suffix on its own, so list it as well if the replacement may be a super-assignment.
 * @example
 * ```ts
 * replacement(base('names', 'dim'), ['<-', '<<-'], { readIndices: false })
 * ```
 */
export function replacement(names: readonly Identifier[], suffixes: BuiltInReplacementDefinition['suffixes'], config: BuiltInReplacementDefinition['config']): BuiltInReplacementDefinition {
	return { type: 'replacement', names: names as Identifier[], suffixes, config };
}

/**
 * A package function reading the file its `arg` argument names, all other arguments are values.
 * The result is the configuration of {@link fn} (with {@link BuiltInProcName.DefaultReadAllArgs}). It marks the function as
 * a library function (`libFn`) tagged to read a file, and the dependency query reports `arg` as the read file.
 * @example
 * ```ts
 * fn(pkg(PkgName.Haven, 'read_sas'), BuiltInProcName.DefaultReadAllArgs, readsFile('file'))
 * ```
 */
export function readsFile(arg: string): { libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ [arg]: Forced.Resource, '...': Forced.Value }) };
}

/**
 * A package function writing its `x` argument (or the one named `value`) to the file its `arg` argument names, invisibly.
 * Pass the name of the data argument as `value` if it is not `x`. It is the counterpart of {@link readsFile},
 * and also states that the function returns invisibly, as most writers do.
 * @example
 * ```ts
 * fn(pkg(PkgName.Qs, 'qsave'), BuiltInProcName.DefaultReadAllArgs, writesFile('file'))
 * fn(pkg(PkgName.Arrow, 'write_parquet'), BuiltInProcName.DefaultReadAllArgs, writesFile('sink'))
 * ```
 */
export function writesFile(arg: string, value = 'x'): { props: CallProp, libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ [value]: Forced.Value, [arg]: Forced.Resource, '...': Forced.Value }) };
}

/**
 * A deprecated function flowR states nothing else about, which the deprecated-functions linting rule reports.
 * Pass it as the `config` of {@link fn} only if there is no other configuration, otherwise add {@link SemanticCallTag.Deprecated} to its `tags`.
 * @example
 * ```ts
 * fn(pkg(PkgName.Dplyr, 'funs'), BuiltInProcName.Default, Deprecated)
 * ```
 */
export const Deprecated = { tags: [SemanticCallTag.Deprecated] };
