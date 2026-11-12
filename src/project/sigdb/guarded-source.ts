import type { PackageSignatureSource } from './reader';
import type { DecodedFunction } from './decode';
import type { BrandedNamespace } from '../../dataflow/environments/identifier';
import { builtInGuards } from '../../dataflow/fn/guards/built-in-guards';

/**
 * The source answering every function with its {@link DecodedFunction.guards}, taken from {@link builtInGuards} for a
 * base package where the source itself records none, so a reader sees them the same way whichever source they come from.
 */
export function withGuards(this: void, source: PackageSignatureSource): PackageSignatureSource {
	const add = (pkg: BrandedNamespace, fn: DecodedFunction | undefined): DecodedFunction | undefined => {
		const guards = fn === undefined || fn.guards !== undefined || !source.isBaseR(pkg) ? undefined : builtInGuards(fn.name, pkg);
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
