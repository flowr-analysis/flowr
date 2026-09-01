import type { Identifier } from '../../dataflow/environments/identifier';
import { Identifier as IdentifierHelper } from '../../dataflow/environments/identifier';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { fnInfo } from '../../dataflow/environments/query-fn-props';
import type { UnresolvedDataType } from '../subtyping/types';

/** The corpus type signatures for a name, keyed by the bare name and, where known, by {@link qualifiedTypeKey|`pkg::name`}. */
export type KnownTypes = Map<string, Set<UnresolvedDataType>>;

/** The key holding the types of `name` as `pkg` defines it, spelled the way R source qualifies a name. */
export function qualifiedTypeKey(pkg: string, name: string): string {
	return `${pkg}::${name}`;
}

/**
 * The type signatures known for `id`, answered for the package it resolves to (its own namespace, else the one
 * the signature database names), falling back to the bare name when no package can be pinned down.
 * @param knownTypes - The loaded corpus, see {@link KnownTypes}.
 * @param id         - The identifier to answer for.
 * @param ctx        - The analyzer context the signature database and the assumed versions come from.
 */
export function knownTypesOf(knownTypes: KnownTypes, id: Identifier, ctx: ReadOnlyFlowrAnalyzerContext): Set<UnresolvedDataType> | undefined {
	const name = IdentifierHelper.getName(id);
	const pkg = IdentifierHelper.getNamespace(id) ?? fnInfo(id, ctx)?.package;
	if(pkg !== undefined) {
		const qualified = knownTypes.get(qualifiedTypeKey(pkg, name));
		if(qualified !== undefined && qualified.size > 0) {
			return qualified;
		}
	}
	return knownTypes.get(name);
}
