import type { BuiltInConstantDefinition, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from '../built-in-config';
import type { BuiltInProcessorMapper } from '../built-in';
import type { BrandedIdentifier, BrandedNamespace, Identifier, PkgName } from '../identifier';
import { CallProp, type FnSig, SemanticCallTag } from '../built-in-props';
import { Forced, sig } from './signatures';

type Processor = keyof typeof BuiltInProcessorMapper;
type FnConfig<P extends Processor> = NonNullable<BuiltInFunctionDefinition<P>['config']>;
type FnMore<P extends Processor> = Partial<Pick<BuiltInFunctionDefinition<P>, 'assumePrimitive' | 'overrides' | 'evalHandler' | 'operators'>>;

/** the definition models a primitive, which is available even in an empty environment */
export const Primitive = { assumePrimitive: true } as const;
/** the definition replaces an earlier one of the same name */
export const Overrides = { overrides: true } as const;

/** The names `names` exported by the package `namespace`, e.g. `pkg(PkgName.Base, 'length', 'nrow')`. */
export function pkg(namespace: PkgName | string, ...names: string[]): Identifier[] {
	/* `Identifier.fromAll`, without loading the identifier helpers: the parser loads the operator definitions */
	return names.map(n => [n as BrandedIdentifier, namespace as BrandedNamespace]);
}

/** `pkg(PkgName.Base, ...)`, the most frequent package */
export const base = (...names: string[]): Identifier[] => pkg('base', ...names);
/** `pkg(PkgName.Utils, ...)` */
export const utils = (...names: string[]): Identifier[] => pkg('utils', ...names);
/** `pkg(PkgName.Stats, ...)` */
export const stats = (...names: string[]): Identifier[] => pkg('stats', ...names);
/** `pkg(PkgName.Methods, ...)` */
export const methods = (...names: string[]): Identifier[] => pkg('methods', ...names);

/** A built-in function: what it is called, the processor handling its calls, the processor's configuration, and more. */
export function fn<P extends Processor>(names: readonly Identifier[], processor: P, config?: FnConfig<P>, more?: FnMore<P>): BuiltInFunctionDefinition<P> {
	return { type: 'function', names: names as Identifier[], processor, config, ...more };
}

/** A built-in constant like `TRUE` or `pi`. */
export function constant<T>(names: readonly Identifier[], value: T, more?: Pick<BuiltInConstantDefinition<T>, 'assumePrimitive' | 'overrides'>): BuiltInConstantDefinition<T> {
	return { type: 'constant', names: names as Identifier[], value, ...more };
}

/** Replacement functions like `names(x) <- v`, defined for each of the assignment `suffixes`. */
export function replacement(names: readonly Identifier[], suffixes: BuiltInReplacementDefinition['suffixes'], config: BuiltInReplacementDefinition['config']): BuiltInReplacementDefinition {
	return { type: 'replacement', names: names as Identifier[], suffixes, config };
}

/** A package function reading the file its `arg` argument names, all other arguments are values. */
export function readsFile(arg: string): { libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ [arg]: Forced.Resource, '...': Forced.Value }) };
}

/** A package function writing its `x` argument (or the one named `value`) to the file its `arg` argument names, invisibly. */
export function writesFile(arg: string, value = 'x'): { props: CallProp, libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ [value]: Forced.Value, [arg]: Forced.Resource, '...': Forced.Value }) };
}

/** A deprecated function flowR states nothing else about. */
export const Deprecated = { tags: [SemanticCallTag.Deprecated] };
