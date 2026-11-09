import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import { PkgName } from '../../environments/identifier';
import { baseRExportOwner } from '../../../util/r-base-packages';
import type { FunctionGuards } from './function-guards';
import { claimsOf, type FormalClaim } from './guard-claims';
import { defaultGuardFacts, Demands } from './guard-knowledge';
import { namesWithGuardFacts } from '../../environments/default-builtin-config/guards';
import { GuardTerm } from './guard-term';

/** What is known about a function without a program to read it from: {@link FunctionGuards} without the clauses, which point at code. */
export interface StatedGuards extends Pick<FunctionGuards, 'requires'> {
	/** see {@link FunctionGuards.required} */
	readonly required?: readonly BrandedIdentifier[]
	/** see {@link FunctionGuards.formals} */
	readonly formals?:  Readonly<Record<BrandedIdentifier, FormalClaim>>
}

/** {@link StatedGuards} per package and name. */
export type BaseGuards = Readonly<Record<string, Readonly<Record<string, StatedGuards>>>>;

/** What R fails on for a function written in C, as the built-in definitions state it, `undefined` if flowR does not know of any. */
function requirementsOf(this: void, name: BrandedIdentifier): StatedGuards | undefined {
	const requirements = defaultGuardFacts()(name)?.asks;
	if(requirements === undefined) {
		return undefined;
	}
	const formals = Object.keys(requirements);
	const stated = Object.entries(requirements).flatMap(([formal, demand]) => {
		/* what the dots hold is several values, none of which a formal of the name `...` could stand for in R code */
		const other = formals.find(f => f !== formal);
		return formal === '...' ? [] : [[formal, Demands[demand](GuardTerm.formal(formal), other === undefined ? undefined : GuardTerm.formal(other))] as const];
	});
	if(stated.length === 0) {
		return undefined;
	}
	const claims = claimsOf(stated.map(([, term]) => term), stated.map(([formal]) => formal), defaultGuardFacts());
	return { requires: GuardTerm.render(GuardTerm.all(...stated.map(([, term]) => term))), ...(Object.keys(claims).length > 0 ? { formals: claims } : {}) };
}

/** The table of what the closures of the base packages ask for, loaded on request as it is sizable. */
export async function loadBaseGuards(this: void): Promise<BaseGuards> {
	return (await import('../../../data/r-base-guards.generated')).RBaseGuards;
}

/** Everything with stated guards, as `[package, name]`. */
export function namesWithGuards(this: void, table: BaseGuards): [pkg: BrandedNamespace, name: BrandedIdentifier][] {
	const inTable = Object.entries(table).flatMap(([pkg, names]) => Object.keys(names).map(name => [pkg, name] as [BrandedNamespace, BrandedIdentifier]));
	const known = new Set(inTable.map(([pkg, name]) => `${pkg}::${name}`));
	return [...inTable, ...namesWithGuardFacts().filter(([, name]) => defaultGuardFacts()(name)?.asks !== undefined).map(([, name]) => [baseRExportOwner(name) ?? PkgName.Base, name] as [BrandedNamespace, BrandedIdentifier]).filter(([pkg, name]) => !known.has(`${pkg}::${name}`))];
}

/**
 * What a function of the base packages asks of the calls returning from it: what its closure checks, and else what is known of it being written in C.
 * Like any guard this says nothing of the defaults of its formals: `n = 5L` does not make `n` an integer.
 * @param table  - the guards read off the closures, see {@link loadBaseGuards}
 * @param name   - the function
 * @param pkg    - the package providing it, by default the one R finds the name in
 */
export function builtInGuards(this: void, table: BaseGuards, name: BrandedIdentifier, pkg: BrandedNamespace | undefined = baseRExportOwner(name)): StatedGuards | undefined {
	const owner = pkg ?? PkgName.Base;
	return table[String(owner)]?.[String(name)] ?? (baseRExportOwner(name) === owner || owner === PkgName.Base ? requirementsOf(name) : undefined);
}
