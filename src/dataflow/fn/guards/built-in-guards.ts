import type { BrandedIdentifier, BrandedNamespace } from '../../environments/identifier';
import { Identifier, PkgName } from '../../environments/identifier';
import { baseRExportOwner } from '../../../util/r-base-packages';
import { messageOf, type FunctionGuards, type GuardClause } from './function-guards';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { claimsOf, conditionalClaimsOf, readingOf, relationsOf, returnedClaimOf, type FormalClaim } from './guard-claims';
import { defaultGuardFacts, messageFor, passes } from './guard-knowledge';
import type { GuardFactsLookup } from '../../environments/guard-facts';
import { namesWithGuardFacts } from '../../environments/default-builtin-config/guards';
import { RBaseGuards, RBaseGuardsDate, RBaseGuardsVersion } from '../../../data/r-base-guards.generated';
import { GuardTerm } from './guard-term';
import { parseGuardTerm } from './guard-term-syntax';
import { groupMethodConditions } from './group-method-guards';
import { s3GroupGenericOf } from '../../environments/group-generics';
import { uniqueArray, uniqueArrayMerge } from '../../../util/collections/arrays';
import type { Column } from '../../../util/range';

/**
 * Where a {@link StatedGuards} comes from: read off the closure of a function (by `scripts/gen-base-guards.ts` into the base table, or when the signature
 * database was built), or stated by flowR for a function written in C. Another version of R may check less or more.
 */
export interface GuardOrigin {
	readonly source:   'base-table' | 'sigdb' | 'builtin'
	/** the R version the closure was read off, or for `builtin` the one the stated facts are taken for */
	readonly r:        string
	/** when it was read off, as an ISO date, absent if unknown */
	readonly date?:    string
	/** the package the function is of, and its version */
	readonly pkg?:     BrandedNamespace
	readonly version?: string
}

/** What is known about a function without a program to read it from: {@link FunctionGuards} without the clauses, which point at code. */
export interface StatedGuards extends Pick<FunctionGuards, 'requires'>, Partial<Pick<FunctionGuards, 'relations' | 'conditional' | 'returns' | 'passes'>> {
	/** see {@link FunctionGuards.required} */
	readonly required?:   readonly BrandedIdentifier[]
	/** see {@link FunctionGuards.formals} */
	readonly formals?:    Readonly<Record<BrandedIdentifier, FormalClaim>>
	/** where they come from and which R they hold for, see {@link GuardOrigin} */
	readonly origin?:     GuardOrigin
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
	/**
	 * Where the failing code is: the function it is written in (`pkg::name` where the package is known, a helper for a condition inherited
	 * through {@link GuardReason.via}) and its line and column counted from the line that function's definition starts on, in the code
	 * analyzed. For the base table that is the closure as R prints it, since base R keeps no source references.
	 */
	readonly loc?:     { readonly fn: string, readonly line: number, readonly column: Column }
}

/** {@link GuardReason.loc} of `node`, by the outermost function definition around it and the name it is assigned to. */
function locationOf(this: void, node: RNodeWithParent | undefined, idMap: AstIdMap, qualified: (name: string) => string): GuardReason['loc'] {
	let definition: RNodeWithParent | undefined;
	for(let at = node; at !== undefined; at = RNode.directParent(at, idMap)) {
		definition = RFunctionDefinition.is(at) ? at : definition;
	}
	const assigned = definition === undefined ? undefined : RNode.directParent(definition, idMap);
	const name = assigned !== undefined && RBinaryOp.is(assigned) ? assigned.lhs.lexeme?.replaceAll('`', '') : undefined;
	if(node?.location === undefined || definition?.location === undefined || name === undefined) {
		return undefined;
	}
	return { fn: qualified(name), line: node.location[0] - definition.location[0] + 1, column: node.location[1] };
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
		const called = RNode.ownLexeme(node);
		const reads = readingOf(requires, defaultGuardFacts(), called === undefined ? undefined : s3GroupGenericOf(called));
		const formals = [...GuardTerm.formalsOf(requires)];
		const loc = locationOf(node, idMap, qualified);
		return {
			requires: rendered,
			kind,
			fails:    written(node),
			...(brief === undefined ? {} : { brief }),
			...(reads === undefined ? {} : { reads }),
			...(formals.length === 0 ? {} : { formals }),
			...(via === undefined || via.length === 0 ? {} : { via: via.map(id => qualified(RNode.ownLexeme(idMap.get(id)) ?? '')) }),
			...(message === undefined ? {} : { message }),
			...(loc === undefined ? {} : { loc })
		};
	});
}

/**
 * {@link StatedGuards} as the table of the base packages stores them, kept small: `requires` is left out where it is the
 * conjunction of the reasons, see {@link joinedReasons}, and a location is `line:column`, prefixed by `pkg::name:` for one in another function.
 */
export type StoredGuards = Omit<StatedGuards, 'requires' | 'because'> & {
	readonly requires?: string
	readonly because?:  readonly (Omit<GuardReason, 'loc'> & { readonly loc?: string })[]
};

/** {@link StoredGuards} per package and name. */
export type BaseGuards = Readonly<Record<string, Readonly<Record<string, StoredGuards>>>>;

/** The conjunction of what the reasons require, as {@link StatedGuards.requires} writes it. */
function joinedReasons(this: void, because: readonly { readonly requires: string }[]): string {
	return because.map(r => because.length > 1 && r.requires.includes('||') ? `(${r.requires})` : r.requires).join(' && ');
}

/** The calls the reasons' conditions make, as {@link StatedGuards.calls} lists them, read back from their R syntax. */
function callsOfReasons(this: void, because: readonly Pick<GuardReason, 'requires' | 'formals'>[]): string[] | undefined {
	const formals = uniqueArray(because.flatMap(r => r.formals ?? []));
	const terms = because.map(r => parseGuardTerm(r.requires, formals, defaultGuardFacts()));
	return terms.every(t => t !== undefined) ? callsOfTerms(terms) : undefined;
}

/** The {@link StoredGuards} of `guards`, those of the function `self` (`pkg::name`). */
export function storedGuardsOf(this: void, guards: StatedGuards, self: string): StoredGuards {
	const { requires, because, calls, ...rest } = guards;
	const derived = because === undefined ? undefined : callsOfReasons(because);
	return {
		...(because !== undefined && joinedReasons(because) === requires ? {} : { requires }),
		...(calls === undefined || (derived !== undefined && derived.join() === calls.join()) ? {} : { calls }),
		...rest,
		...(because === undefined ? {} : { because: because.map(({ loc, ...reason }) => ({ ...reason, ...(loc === undefined ? {} : { loc: `${loc.fn === self ? '' : loc.fn + ':'}${loc.line}:${loc.column}` }) })) })
	};
}

/** The {@link StatedGuards} that {@link storedGuardsOf} stored. */
export function statedGuardsOfStored(this: void, stored: StoredGuards, self: string): StatedGuards {
	const { requires, because, calls, ...rest } = stored;
	const derived = calls ?? (because === undefined ? undefined : callsOfReasons(because));
	return {
		requires: requires ?? joinedReasons(because ?? []),
		...(derived === undefined || derived.length === 0 ? {} : { calls: derived }),
		...rest,
		...(because === undefined ? {} : { because: because.map(({ loc, ...reason }) => {
			if(loc === undefined) {
				return reason;
			}
			const [line, column] = loc.split(':').slice(-2).map(Number);
			const fn = loc.split(':').slice(0, -2).join(':');
			return { ...reason, loc: { fn: fn === '' ? self : fn, line, column: column } };
		}) })
	};
}

/** One condition R checks for a function written in C, on the formal it is about, with what R says if it does not hold. */
export interface BuiltInClause {
	readonly formal:   BrandedIdentifier
	readonly requires: GuardTerm
	readonly message:  string
}

/** What R fails on for a function written in C, as the built-in definitions `facts` state it, `undefined` if they state nothing. */
export function builtInClauses(this: void, name: BrandedIdentifier, facts: GuardFactsLookup): BuiltInClause[] | undefined {
	const asks = facts(name)?.asks;
	if(asks === undefined) {
		return undefined;
	}
	const formals = Object.keys(asks);
	return Object.entries(asks).flatMap(([formal, failures]) => {
		/* what the dots hold is several values, none of which a formal of the name `...` could stand for in R code */
		const other = formals.find(f => f !== formal);
		const of = GuardTerm.formal(formal);
		return formal === '...' ? [] : failures.map(f => ({ formal, requires: passes(f, of, () => false, other === undefined ? undefined : GuardTerm.formal(other), GuardTerm.formal), message: messageFor(f, of) }));
	});
}

/** What R fails on for a function written in C, and what it returns, as the built-in definitions state it, `undefined` if flowR does not know of any. */
function requirementsOf(this: void, name: BrandedIdentifier): StatedGuards | undefined {
	const facts = defaultGuardFacts()(name);
	const formals = Object.keys(facts?.asks ?? {});
	const stated = builtInClauses(name, defaultGuardFacts()) ?? [];
	const returns = facts?.returns === undefined || facts.returns === 'argument' ? undefined : returnedClaimOf(facts.returns);
	const passed = facts?.returns === 'argument' ? formals[0] : undefined;
	if(stated.length === 0 && returns === undefined && passed === undefined && (facts?.required ?? []).length === 0) {
		return undefined;
	}
	const required = facts?.required ?? [];
	const dispatched = formals.filter(f => f !== '...');
	const terms = [...stated.map(c => c.requires), ...groupMethodConditions(name, dispatched.map(GuardTerm.formal), new Set(), defaultGuardFacts())];
	const claims = claimsOf(terms, uniqueArrayMerge<BrandedIdentifier>(stated.map(c => c.formal), required), defaultGuardFacts());
	const relations = relationsOf(terms, defaultGuardFacts());
	const conditional = conditionalClaimsOf(terms, formals.filter(f => f !== '...'), defaultGuardFacts());
	const calls = callsOfTerms(terms);
	return {
		requires: terms.length === 0 ? '' : GuardTerm.render(GuardTerm.all(...terms)),
		...(required.length > 0 ? { required } : {}),
		...(Object.keys(claims).length > 0 ? { formals: claims } : {}),
		...(relations.length > 0 ? { relations } : {}),
		...(conditional.length > 0 ? { conditional } : {}),
		...(returns === undefined ? {} : { returns }),
		...(passed === undefined ? {} : { passes: passed }),
		...(calls.length > 0 ? { calls } : {}),
		origin:   { source: 'builtin', r: RBaseGuardsVersion }
	};
}

/** Everything with stated guards, as `[package, name]`. */
export function namesWithGuards(this: void): [pkg: BrandedNamespace, name: BrandedIdentifier][] {
	const table = RBaseGuards;
	const inTable = Object.entries(table).flatMap(([pkg, names]) => Object.keys(names).map(name => [pkg, name] as [BrandedNamespace, BrandedIdentifier]));
	const known = new Set(inTable.map(([pkg, name]) => `${pkg}::${name}`));
	return [...inTable, ...namesWithGuardFacts().filter(([, name]) => requirementsOf(name) !== undefined).map(([, name]) => [baseRExportOwner(name) ?? PkgName.Base, name] as [BrandedNamespace, BrandedIdentifier]).filter(([pkg, name]) => !known.has(`${pkg}::${name}`))];
}

/**
 * What a function of the base packages asks of the calls returning from it: what its closure checks, and else what is known of it being written in C.
 * Like any guard this says nothing of the defaults of its formals: `n = 5L` does not make `n` an integer.
 * @param name   - the function
 * @param pkg    - the package providing it, by default the one R finds the name in
 */
export function builtInGuards(this: void, name: BrandedIdentifier, pkg: BrandedNamespace | undefined = baseRExportOwner(name)): StatedGuards | undefined {
	const owner = pkg ?? PkgName.Base;
	const stored = RBaseGuards[String(owner)]?.[String(name)];
	const read = stored === undefined ? undefined : statedGuardsOfStored(stored, `${String(owner)}::${String(name)}`);
	return read !== undefined ? { ...read, origin: { source: 'base-table', r: RBaseGuardsVersion, date: RBaseGuardsDate, pkg: owner, version: RBaseGuardsVersion } } : (baseRExportOwner(name) === owner || owner === PkgName.Base ? requirementsOf(name) : undefined);
}
