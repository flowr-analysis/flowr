import type { BuiltInConstantDefinition, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from '../built-in-config';
import type { BuiltInProcessorMapper } from '../built-in';
import type { BrandedIdentifier, BrandedNamespace, Identifier, PkgName } from '../identifier';
import { CallProp, type FnSig, SemanticCallTag } from '../built-in-props';
import { Forced, sig } from './shared-signatures';

type Processor = keyof typeof BuiltInProcessorMapper;
type FnConfig<P extends Processor> = NonNullable<BuiltInFunctionDefinition<P>['config']>;
type FnMore<P extends Processor> = Partial<Pick<BuiltInFunctionDefinition<P>, 'assumePrimitive' | 'overrides' | 'evalHandler' | 'operators'>>;

/** The definition models a primitive, available even in an empty environment (R's own list decides {@link CallProp.Primitive}). */
export const Primitive = { assumePrimitive: true } as const;
/** The definition replaces an earlier one of the same name, without it a test flags the duplicate. */
export const Overrides = { overrides: true } as const;

/** The `names` exported by `namespace`, e.g. `pkg(PkgName.Haven, 'read_sas')`. */
export function pkg(namespace: PkgName | string, ...names: string[]): Identifier[] {
	return names.map(n => [n as BrandedIdentifier, namespace as BrandedNamespace]);
}

export const base = (...names: string[]): Identifier[] => pkg('base', ...names);
export const utils = (...names: string[]): Identifier[] => pkg('utils', ...names);
export const stats = (...names: string[]): Identifier[] => pkg('stats', ...names);
export const methods = (...names: string[]): Identifier[] => pkg('methods', ...names);

/** A built-in function: its names, the processor handling its calls and that processor's configuration (a function without `sig` reads plain values). */
export function fn<P extends Processor>(names: readonly Identifier[], processor: P, config?: FnConfig<P>, more?: FnMore<P>): BuiltInFunctionDefinition<P> {
	return { type: 'function', names: names as Identifier[], processor, config, ...more };
}

/** A built-in constant like `TRUE`, with the value flowR assumes for it (`Top` if unknown). */
export function constant<T>(names: readonly Identifier[], value: T, more?: Pick<BuiltInConstantDefinition<T>, 'assumePrimitive' | 'overrides'>): BuiltInConstantDefinition<T> {
	return { type: 'constant', names: names as Identifier[], value, ...more };
}

/** Replacement functions like `names(x) <- v`, named by the getter and defined for each assignment suffix. */
export function replacement(names: readonly Identifier[], suffixes: BuiltInReplacementDefinition['suffixes'], config: BuiltInReplacementDefinition['config']): BuiltInReplacementDefinition {
	return { type: 'replacement', names: names as Identifier[], suffixes, config };
}

/** A package function reading the file its `arg` argument names. */
export function readsFile(arg: string): { libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ [arg]: Forced.Resource, '...': Forced.Value }) };
}

/** A package function invisibly writing `value` to the file its `arg` argument names. */
export function writesFile(arg: string, value = 'x'): { props: CallProp, libFn: true, tags: SemanticCallTag[], sig: FnSig } {
	return { props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ [value]: Forced.Value, [arg]: Forced.Resource, '...': Forced.Value }) };
}

/** A deprecated function flowR states nothing else about. */
export const Deprecated = { tags: [SemanticCallTag.Deprecated] };
