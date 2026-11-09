import type { PackageSignatureSource } from './reader';
import type { DecodedFunction } from './decode';
import type { BrandedIdentifier, BrandedNamespace } from '../../dataflow/environments/identifier';
import type { StatedGuards } from '../../dataflow/fn/guards/built-in-guards';
import { builtInGuards } from '../../dataflow/fn/guards/built-in-guards';

/** What is known of what the calls of a function have to fulfill, beyond what a source itself records. */
export type GuardsOf = (pkg: BrandedNamespace, name: BrandedIdentifier) => StatedGuards | undefined;

/**
 * The source answering every function with its {@link DecodedFunction.guards}, taken from `guardsOf` where the
 * source itself records none, so a reader sees them the same way whichever source they come from.
 */
export function withGuards(this: void, source: PackageSignatureSource, guardsOf: GuardsOf = baseGuardsOf(source)): PackageSignatureSource {
	const add = (pkg: BrandedNamespace, fn: DecodedFunction | undefined): DecodedFunction | undefined => {
		const guards = fn === undefined || fn.guards !== undefined ? undefined : guardsOf(pkg, fn.name);
		return guards === undefined ? fn : { ...fn as DecodedFunction, guards };
	};
	const overrides: Partial<PackageSignatureSource> = {
		functionByName: (pkg, name, version) => add(pkg, source.functionByName(pkg, name, version)),
		functions:      (pkg, version) => source.functions(pkg, version)?.map(fn => add(pkg, fn) as DecodedFunction)
	};
	return new Proxy(source, {
		get(target, property, receiver) {
			const own = overrides[property as keyof PackageSignatureSource];
			if(own !== undefined) {
				return own;
			}
			const value = Reflect.get(target, property, receiver) as unknown;
			return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
		}
	});
}

/** What flowR read off the closures of the base packages and knows of those written in C, see {@link builtInGuards}. */
function baseGuardsOf(this: void, source: PackageSignatureSource): GuardsOf {
	return (pkg, name) => source.isBaseR(pkg) ? builtInGuards(name, pkg) : undefined;
}
