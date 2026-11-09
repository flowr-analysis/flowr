import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import { PkgName } from '../../environments/identifier';
import { baseRExportOwner } from '../../../util/r-base-packages';
import type { FunctionGuards } from './function-guards';
import { claimsOf, type FormalClaim } from './guard-claims';
import { defaultGuardFacts, Demands } from './guard-knowledge';
import { namesWithGuardFacts } from '../../environments/default-builtin-config/guards';
import { RBaseGuards, RBaseGuardsVersion } from '../../../data/r-base-guards.generated';
import { GuardTerm } from './guard-term';

/** What is known about a function without a program to read it from: {@link FunctionGuards} without the clauses, which point at code. */
export interface StatedGuards extends Pick<FunctionGuards, 'requires'> {
	/** see {@link FunctionGuards.required} */
	readonly required?: readonly BrandedIdentifier[]
	/** see {@link FunctionGuards.formals} */
	readonly formals?:  Readonly<Record<BrandedIdentifier, FormalClaim>>
	/** the R version they were read off, for what a closure checks, which another version may check differently */
	readonly readOff?:  string
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

/** Everything with stated guards, as `[package, name]`. */
export function namesWithGuards(this: void): [pkg: BrandedNamespace, name: BrandedIdentifier][] {
	const table = RBaseGuards;
	const inTable = Object.entries(table).flatMap(([pkg, names]) => Object.keys(names).map(name => [pkg, name] as [BrandedNamespace, BrandedIdentifier]));
	const known = new Set(inTable.map(([pkg, name]) => `${pkg}::${name}`));
	return [...inTable, ...namesWithGuardFacts().filter(([, name]) => defaultGuardFacts()(name)?.asks !== undefined).map(([, name]) => [baseRExportOwner(name) ?? PkgName.Base, name] as [BrandedNamespace, BrandedIdentifier]).filter(([pkg, name]) => !known.has(`${pkg}::${name}`))];
}

/**
 * What a function of the base packages asks of the calls returning from it: what its closure checks, and else what is known of it being written in C.
 * Like any guard this says nothing of the defaults of its formals: `n = 5L` does not make `n` an integer.
 * @param name   - the function
 * @param pkg    - the package providing it, by default the one R finds the name in
 */
export function builtInGuards(this: void, name: BrandedIdentifier, pkg: BrandedNamespace | undefined = baseRExportOwner(name)): StatedGuards | undefined {
	const owner = pkg ?? PkgName.Base;
	const read = RBaseGuards[String(owner)]?.[String(name)];
	return read !== undefined ? { ...read, readOff: RBaseGuardsVersion } : (baseRExportOwner(name) === owner || owner === PkgName.Base ? requirementsOf(name) : undefined);
}
