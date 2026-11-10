import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import { Identifier, PkgName } from '../../environments/identifier';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { messageOf, type FunctionGuards, type GuardClause } from './function-guards';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { claimsOf, readingOf, type FormalClaim } from './guard-claims';
import { defaultGuardFacts, passes } from './guard-knowledge';
import { namesWithGuardFacts } from '../../environments/default-builtin-config/guards';
import { RBaseGuards, RBaseGuardsVersion } from '../../../data/r-base-guards.generated';
import { GuardTerm } from './guard-term';
import { uniqueArray } from '../../../util/collections/arrays';

/** What is known about a function without a program to read it from: {@link FunctionGuards} without the clauses, which point at code. */
export interface StatedGuards extends Pick<FunctionGuards, 'requires'>, Partial<Pick<FunctionGuards, 'relations' | 'conditional' | 'returns' | 'passes'>> {
	/** see {@link FunctionGuards.required} */
	readonly required?:   readonly BrandedIdentifier[]
	/** see {@link FunctionGuards.formals} */
	readonly formals?:    Readonly<Record<BrandedIdentifier, FormalClaim>>
	/** the R version they were read off, for what a closure checks, which another version may check differently */
	readonly readOff?:    string
	/** why each part of {@link StatedGuards.requires} is in effect */
	readonly because?:    readonly GuardReason[]
	/** the S3 generic it is a method of, written `pkg::name`, and the class it is the method for */
	readonly methodOf?:   { readonly generic: string, readonly class: string }
	/** for an S3 generic, the formal it dispatches on */
	readonly dispatches?: BrandedIdentifier
	/** for an S3 generic, its methods, each written `pkg::name` */
	readonly methods?:    readonly string[]
	/** every function the conditions call, written `pkg::name` where the package is known, the base packages R attaches on startup included, which the conditions leave out */
	readonly calls?:      readonly string[]
}

/** The functions the terms call, see {@link StatedGuards.calls}. */
export function callsOfTerms(this: void, terms: readonly GuardTerm[]): string[] {
	return uniqueArray(terms.flatMap(term => GuardTerm.callsOf(term).map(id => Identifier.toString(id))));
}

/** Why a condition is in effect: the code that fails if it does not hold, see {@link GuardClause}. */
export interface GuardReason {
	/** the condition in R syntax */
	readonly requires: string
	/** see {@link GuardClause.kind} */
	readonly kind:     GuardClause['kind']
	/** the code that fails, as it is written */
	readonly fails:    string
	/** the same, shortened to what a reader needs next to the message: `stop(...)` for a call raising it, or the `if (cond) ...` whose condition R rejects */
	readonly brief?:   string
	/** the condition in words, where it uses notation of flowR's own, see {@link readingOf} */
	readonly reads?:   string
	/** the formals the condition speaks of */
	readonly formals?: readonly BrandedIdentifier[]
	/** the calls the condition is inherited through, outermost first, by the function they call, written `pkg::name` where the package is known */
	readonly via?:     readonly string[]
	/** see {@link GuardClause.message} */
	readonly message?: string
}

const MaxReasonLength = 160;

function written(this: void, node: RNodeWithParent | undefined): string {
	const text = RNode.lexeme(node)?.split('\n')[0] ?? '';
	return text.length > MaxReasonLength ? `${text.slice(0, MaxReasonLength)}...` : text;
}

/** The failing code shortened, see {@link GuardReason.brief}. */
function briefOf(this: void, node: RNodeWithParent | undefined, message: string | undefined, idMap: AstIdMap): string | undefined {
	if(node === undefined) {
		return undefined;
	} else if(RFunctionCall.isNamed(node) && message !== undefined && messageOf(node) === message) {
		return `${RNode.ownLexeme(node) ?? ''}(...)`;
	}
	const parent = RNode.directParent(node, idMap);
	return (RIfThenElse.is(parent) || RWhileLoop.is(parent)) && parent.condition === node ? `${RIfThenElse.is(parent) ? 'if' : 'while'} (${written(node)}) ...` : undefined;
}

/**
 * The {@link GuardReason} of each of the clauses, reading the code they point at from `idMap`.
 * @param ownerOf - the package defining a function of the program, to qualify {@link GuardReason.via} with
 */
export function reasonsOf(this: void, clauses: readonly GuardClause[], idMap: AstIdMap, ownerOf: (name: string) => string | undefined = () => undefined): GuardReason[] {
	const qualified = (name: string) => {
		const owner = ownerOf(name);
		return owner === undefined ? name : `${owner}::${name}`;
	};
	return clauses.map(({ requires, rendered, kind, at, via, message }) => {
		const node = idMap.get(at);
		const brief = briefOf(node, message, idMap);
		const reads = readingOf(requires, defaultGuardFacts());
		const formals = [...GuardTerm.formalsOf(requires)];
		return {
			requires: rendered,
			kind,
			fails:    written(node),
			...(brief === undefined ? {} : { brief }),
			...(reads === undefined ? {} : { reads }),
			...(formals.length === 0 ? {} : { formals }),
			...(via === undefined || via.length === 0 ? {} : { via: via.map(id => qualified(RNode.ownLexeme(idMap.get(id)) ?? '')) }),
			...(message === undefined ? {} : { message })
		};
	});
}

/** {@link StatedGuards} per package and name. */
export type BaseGuards = Readonly<Record<string, Readonly<Record<string, StatedGuards>>>>;

/** What R fails on for a function written in C, as the built-in definitions state it, `undefined` if flowR does not know of any. */
function requirementsOf(this: void, name: BrandedIdentifier): StatedGuards | undefined {
	const asks = defaultGuardFacts()(name)?.asks;
	if(asks === undefined) {
		return undefined;
	}
	const formals = Object.keys(asks);
	const stated = Object.entries(asks).flatMap(([formal, failures]) => {
		/* what the dots hold is several values, none of which a formal of the name `...` could stand for in R code */
		const other = formals.find(f => f !== formal);
		return formal === '...' ? [] : failures.map(f => [formal, passes(f, GuardTerm.formal(formal), () => false, other === undefined ? undefined : GuardTerm.formal(other))] as const);
	});
	if(stated.length === 0) {
		return undefined;
	}
	const claims = claimsOf(stated.map(([, term]) => term), stated.map(([formal]) => formal), defaultGuardFacts());
	const calls = callsOfTerms(stated.map(([, term]) => term));
	return { requires: GuardTerm.render(GuardTerm.all(...stated.map(([, term]) => term))), ...(Object.keys(claims).length > 0 ? { formals: claims } : {}), ...(calls.length > 0 ? { calls } : {}) };
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
