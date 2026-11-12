import type { StatedGuards } from '../../src/dataflow/fn/guards/built-in-guards';
import { caseConditions, claimConditions, returnConditions } from '../../src/dataflow/fn/guards/guard-claims';
import { allOf, grouped } from '../../src/dataflow/fn/guards/condition-grouping';
import { Identifier } from '../../src/dataflow/environments/identifier';
import { contractTokens } from './contract-search';
import type { Guards } from './database';

/** What a page shows of the given guards, as {@link Guards}, `undefined` if they say nothing. */
export function guardsTuple(stated: StatedGuards | undefined): Guards | undefined {
	const claims = [
		...Object.entries(stated?.formals ?? {}).map(([formal, claim]): [string, string[]] => [formal, [...claimConditions(formal, claim), ...caseConditions(formal, claim)]]),
		/* a claim that holds unless something else lets the call through reads as the claim `unless` that, unless the cases of the formal say it shorter */
		...(stated?.conditional ?? []).filter(({ formal }) => stated?.formals?.[formal]?.cases === undefined).map(({ formal, claim, unless }): [string, string[]] => [formal, [grouped(`${allOf(claimConditions(formal, claim))} unless ${unless}`)]])
	];
	const because = (stated?.because ?? []).map(({ requires, kind, fails, via, message, reads, brief, loc }): [string, string, string, string, string, string, string, string] =>
		[requires, kind, fails, via?.join(', ') ?? '', message ?? '', reads ?? '', brief ?? '', loc === undefined ? '' : `${loc.fn}:${loc.line}:${loc.column}`]);
	const result = returnConditions(stated?.returns, stated?.passes);
	const named = [...new Set([...stated?.required ?? [], ...claims.map(([formal]) => formal), ...(stated?.relations ?? []).flatMap(r => r.formals), ...(stated?.because ?? []).flatMap(b => b.formals ?? [])])];
	if(stated === undefined || (stated.requires === '' && claims.length === 0 && (stated.required ?? []).length === 0 && result.length === 0)) {
		return undefined;
	}
	const calls = (stated.calls ?? []).map(qualified => Identifier.parse(qualified));
	const tokens = contractTokens({
		inferred:  stated.origin !== undefined && stated.origin.source !== 'builtin',
		formals:   named,
		claims:    stated.formals ?? {},
		required:  stated.required ?? [],
		calls:     calls.map(id => [Identifier.getName(id), Identifier.toString(id)]),
		relations: (stated.relations ?? []).map(r => r.formals),
		returns:   stated.returns
	});
	return [stated.requires, claims, because, stated.origin === undefined || stated.origin.source === 'builtin' ? '' : stated.origin.r + (stated.origin.date === undefined ? '' : '@' + stated.origin.date), (stated.relations ?? []).map(({ holds, unless, unlessClaim }): [string, string] => [holds, unlessClaim === undefined ? unless ?? '' : allOf(claimConditions(unlessClaim.formal, unlessClaim.claim))]), [...stated.required ?? []], result, named,
		stated.dispatches === undefined ? [] : [stated.dispatches, stated.methods ?? []], stated.methodOf === undefined ? [] : [stated.methodOf.generic, stated.methodOf.class],
		calls.map(id => [Identifier.toPreludeString(id), Identifier.toString(id)]), tokens];
}
