import type { FormalClaim } from '../../src/dataflow/fn/guards/guard-claims';

type ClaimTest = (claim: FormalClaim, required: boolean) => boolean;

/** the types a claim allows, of any value or else of one without a class, `undefined` without a claim on them */
const typesOf = (claim: FormalClaim): readonly string[] | undefined => claim.types ?? claim.unclassedTypes;
const only = (...allowed: readonly string[]): ClaimTest => claim => typesOf(claim)?.every(type => allowed.includes(type)) ?? false;

/** the kinds of parameters `param:kind` asks for, each read off the fields of a {@link FormalClaim} */
export const ParamKinds: Readonly<Record<string, readonly [about: string, holds: ClaimTest]>> = {
	enum:      ['takes one of a fixed set of values, like the choices of match.arg', claim => (claim.values?.length ?? 0) > 0],
	callable:  ['has to be usable as a function', claim => claim.callable === true],
	scalar:    ['has to be of length one', claim => claim.bounds?.length?.[0] === 1 && claim.bounds.length[1] === 1],
	required:  ['a call has to give it', (_, required) => required],
	numeric:   ['has to be an integer or double', only('integer', 'double')],
	character: ['has to be a string', only('character')],
	logical:   ['has to be TRUE, FALSE, or NA', only('logical')],
	nonneg:    ['a number that is not negative', claim => (claim.bounds?.value?.[0] ?? -1) >= 0],
	bounded:   ['a number with a bound', claim => claim.bounds?.value !== undefined],
	whole:     ['every element a whole number', claim => claim.whole === true],
	notNA:     ['no element NA', claim => claim.notNA === true],
	classed:   ['has to have one of some classes', claim => (claim.classes?.length ?? 0) > 0]
};

/** what a measure of a bound is asked for by, `bound` for the value itself */
const Measures: Readonly<Record<string, string>> = { bound: 'value', length: 'length', nchar: 'nchar', nrow: 'nrow', ncol: 'ncol', NROW: 'NROW', NCOL: 'NCOL' };

/** the keys of the contract part of a query, each `key:value`, with what they ask */
export const ContractKeys: Readonly<Record<string, readonly [example: string, about: string]>> = {
	contract: ['contract:x', 'has a contract, on the formal x if one is named'],
	requires: ['requires:is.numeric', 'a condition calls the function, also written base::is.numeric'],
	type:     ['type:x=double', 'the formal (or any, as type:double) is claimed to have that type'],
	param:    ['param:x:enum', 'the formal (or any, as param:enum) is of the kind, see the kinds below'],
	length:   ['length:x==1', 'a bound on the length of the formal implies the comparison (==, >=, <=, >, <); nchar, nrow, ncol, NROW, and NCOL work alike'],
	bound:    ['bound:x>=0', 'a bound on the value of the formal implies the comparison'],
	relation: ['relation:x', 'relates formals to each other, x among them if named'],
	returns:  ['returns:double', 'says something of the result, of that type if named'],
	origin:   ['origin:stated', 'inferred from the R code of the function, or stated by flowR for one written in C']
};

/** a part of a query asking about the contract */
export interface ContractSpec {
	readonly key:   string
	readonly value: string
}

const SpecPattern = new RegExp(`(?:^|\\s)((${[...Object.keys(ContractKeys), ...Object.keys(Measures)].join('|')}):(\\S*))`, 'g');

/** The contract parts of `text`, and what is left of it without them. */
export function takeContractSpecs(text: string): { readonly rest: string, readonly specs: readonly ContractSpec[] } {
	const specs: ContractSpec[] = [];
	const rest = text.replace(SpecPattern, (_, _whole: string, key: string, value: string) => {
		specs.push({ key, value });
		return ' ';
	});
	return { rest: rest.trim(), specs };
}

const Comparison = /^([^<>=!]*)(==|>=|<=|>|<)(-?(?:\d+(?:\.\d*)?|Inf))$/;

/** whether the bound `lo..hi` (empty for none) makes `op number` hold */
function implies(lo: string, hi: string, op: string, number: number): boolean {
	const [lower, upper] = [lo === '' ? -Infinity : Number(lo), hi === '' ? Infinity : Number(hi)];
	switch(op) {
		case '==': return lower === number && upper === number;
		case '>=': return lower >= number;
		case '>':  return lower > number;
		case '<=': return upper <= number;
		default:   return upper < number;
	}
}

/** Whether the tokens of a contract, see {@link contractTokens}, answer the part of a query. */
function answers(tokens: readonly string[], { key, value }: ContractSpec): boolean {
	const measure = Measures[key];
	if(measure === undefined) {
		return tokens.includes(key + ':' + value);
	}
	const compared = Comparison.exec(value);
	const formal = compared === null ? value : compared[1];
	return tokens.some(token => {
		const [kind, of, on, lo, hi] = token.split(':');
		return kind === 'bound' && of === measure && (formal === '' || on === formal) && (compared === null || implies(lo, hi, compared[2], Number(compared[3])));
	});
}

/** Whether the tokens answer every part of a query. */
export function answersAll(tokens: readonly string[], specs: readonly ContractSpec[]): boolean {
	return specs.every(spec => answers(tokens, spec));
}

/** what the index needs of a contract to give its tokens */
export interface Contracted {
	readonly inferred:  boolean
	readonly formals:   readonly string[]
	readonly claims:    Readonly<Record<string, FormalClaim>>
	readonly required:  readonly string[]
	/** each function the conditions call, as `[name, pkg::name]`, the latter without a known package */
	readonly calls:     readonly (readonly [name: string, qualified: string])[]
	readonly relations: readonly (readonly string[])[]
	readonly returns?:  FormalClaim
}

/** The tokens of a contract a query is answered by, each `key:value`, with `key:` alone for there being any. */
export function contractTokens({ inferred, formals, claims, required, calls, relations, returns }: Contracted): string[] {
	const tokens = new Set(['contract:', 'origin:' + (inferred ? 'inferred' : 'stated')]);
	for(const formal of formals) {
		tokens.add('contract:' + formal);
		const claim = claims[formal] ?? {};
		for(const type of new Set([...claim.types ?? [], ...claim.unclassedTypes ?? []])) {
			tokens.add('type:' + type).add('type:' + formal + '=' + type);
		}
		for(const [kind, [, holds]] of Object.entries(ParamKinds)) {
			if(holds(claim, required.includes(formal))) {
				tokens.add('param:' + kind).add('param:' + formal + ':' + kind);
			}
		}
		for(const [measure, [lo, hi]] of Object.entries(claim.bounds ?? {})) {
			tokens.add(['bound', measure, formal, lo ?? '', hi ?? ''].join(':'));
		}
	}
	for(const [name, qualified] of calls) {
		tokens.add('requires:' + name).add('requires:' + qualified);
	}
	for(const related of relations) {
		tokens.add('relation:');
		related.forEach(formal => tokens.add('relation:' + formal));
	}
	if(returns !== undefined) {
		tokens.add('returns:');
		(returns.types ?? returns.unclassedTypes ?? []).forEach(type => tokens.add('returns:' + type));
	}
	return [...tokens];
}
