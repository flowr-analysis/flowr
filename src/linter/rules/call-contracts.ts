import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { isValue, type Value } from '../../dataflow/eval/values/r-value';
import { type BrandedIdentifier, Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { builtInLookup, fnEntry } from '../../dataflow/environments/query-fn-props';
import type { FormalClaim } from '../../dataflow/fn/guards/guard-claims';
import { calledDefinitions, formalNames } from './cmd-check/cmd-check-util';
import { FunctionArgument } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface CallContractsResult extends LintingResult {
	/** the function called */
	readonly function: Identifier
	/** what the call breaks of what the function asks for */
	readonly broken:   readonly string[]
}

export type CallContractsConfig = MergeableRecord;

export interface CallContractsMetadata extends MergeableRecord {
	/** calls of a function flowR knows a contract of */
	readonly checkedCalls: number
}

/** What a function asks of its calls, as far as a call can be checked against it. */
interface Contract {
	readonly formals:  readonly BrandedIdentifier[]
	readonly required: readonly BrandedIdentifier[]
	readonly claims:   Readonly<Record<BrandedIdentifier, FormalClaim>>
}

/** A value the call hands over, as far as it is known for certain: its type, its length, and its elements. */
interface Known {
	readonly type:     string
	readonly length:   number
	readonly numbers?: readonly number[]
	readonly strings?: readonly string[]
	readonly na:       boolean
}

/** a number that may be an integer or a double */
const Numeric = 'integer or double';

/** The value, if it is a single literal or a vector of them. */
function knownOf(value: Value): Known | undefined {
	if(typeof value !== 'object' || value === null) {
		return undefined;
	}
	switch(value.type) {
		case 'null':
			return { type: 'NULL', length: 0, na: false };
		case 'string':
			return isValue(value.value) ? { type: 'character', length: 1, strings: [value.value.str], na: false } : undefined;
		case 'logical':
			return typeof value.value === 'boolean' ? { type: 'logical', length: 1, na: false } : undefined;
		case 'number':
			return isValue(value.value) ? {
				/* the value domain does not tell `1` from `1L` for certain */
				type:    value.value.complexNumber ? 'complex' : Numeric,
				length:  1,
				numbers: value.value.complexNumber ? undefined : [value.value.num],
				na:      Number.isNaN(value.value.num)
			} : undefined;
		case 'interval': {
			/* a single number, like `-1` */
			const [start, end] = [knownOf(value.start), knownOf(value.end)];
			return value.startInclusive && value.endInclusive && start?.numbers?.[0] === end?.numbers?.[0] ? start : undefined;
		}
		default:
			return undefined;
	}
}

/** What of `claim` the value breaks, each in the words of the condition that fails. */
function broken(formal: BrandedIdentifier, claim: FormalClaim, known: Known): string[] {
	const result: string[] = [];
	for(const types of [claim.types, claim.plainTypes]) {
		if(types !== undefined && !(known.type === Numeric ? types.includes('integer') || types.includes('double') : types.includes(known.type))) {
			result.push(`typeof(${formal}) is ${known.type}, not one of ${types.join(', ')}`);
		}
	}
	const length = claim.bounds?.length;
	if(length !== undefined && ((length[0] !== null && known.length < length[0]) || (length[1] !== null && known.length > length[1]))) {
		result.push(`length(${formal}) is ${known.length}`);
	}
	const [lower, upper] = claim.bounds?.value ?? [null, null];
	for(const number of claim.bounds?.value === undefined ? [] : known.numbers ?? []) {
		if((lower !== null && number < lower) || (upper !== null && number > upper)) {
			result.push(`${formal} is ${number}, outside of [${lower ?? '-Inf'}, ${upper ?? 'Inf'}]`);
		}
	}
	const choices = claim.values?.filter(v => typeof v === 'string') ?? [];
	for(const string of choices.length === 0 ? [] : known.strings ?? []) {
		const fits = claim.partial ? choices.filter(c => c.startsWith(string)).length === 1 || choices.includes(string) : choices.includes(string);
		if(!fits) {
			result.push(`${formal} is "${string}", not ${claim.partial ? 'a unique prefix of' : 'one of'} ${choices.map(c => `"${c}"`).join(', ')}`);
		}
	}
	if(claim.notNA && known.na) {
		result.push(`${formal} is NA`);
	}
	return result;
}

/** The contract of what the call reaches: the one definition of the program it calls, or a function of R flowR knows the guards of. */
function contractOf(id: NodeId, data: { graph: Parameters<typeof calledDefinitions>[0], idMap: Parameters<typeof calledDefinitions>[2], ctx: Parameters<typeof fnEntry>[1] }): Contract | undefined {
	const { graph, idMap, ctx } = data;
	const origins = Dataflow.origin(graph, id) ?? [];
	if(origins.length === 1 && origins[0].type === OriginType.BuiltInFunctionOrigin) {
		const name = origins[0].fn.name;
		const stated = FunctionSemantics.builtInGuards(Identifier.getName(name), Identifier.getNamespace(name));
		/* the formals flowR states of a built-in, else those the signature database knows */
		const formals = builtInLookup(ctx)(name)?.sig?.map(([formal]) => formal) ?? fnEntry(name, ctx).entry?.signature.map(p => p.name);
		return stated === undefined || formals === undefined ? undefined : { formals, required: stated.required ?? [], claims: stated.formals ?? {} };
	}
	const definitions = calledDefinitions(graph, id, idMap);
	if(definitions.length !== 1 || origins.some(o => o.type === OriginType.BuiltInFunctionOrigin)) {
		return undefined;
	}
	const [definition] = definitions;
	const guards = FunctionSemantics.guards([definition.info.id], graph, { ctx })[definition.info.id];
	return guards === undefined ? undefined : { formals: formalNames(definition), required: guards.required, claims: guards.formals };
}

/**
 * Finds calls that hand a function a value its contract rules out, like `combn(4, -1)` for `m >= 0`, or that leave out an
 * argument it needs: such a call fails whenever it runs. Only values known for certain are checked.
 */
export const CALL_CONTRACTS = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const { graph } = dataflow;
		const ctx = data.inspectContext();
		const idMap = graph.idMap ?? (await data.normalize()).idMap;
		let checkedCalls = 0;
		const results: CallContractsResult[] = [];
		for(const element of elements.getElements()) {
			const id = element.node.info.id;
			const vertex = graph.getVertex(id);
			const contract = DfgVertex.isFunctionCall(vertex) ? contractOf(id, { graph, idMap, ctx }) : undefined;
			if(contract === undefined || !DfgVertex.isFunctionCall(vertex)) {
				continue;
			}
			checkedCalls++;
			const bound = FunctionSemantics.call.match.toSpec(vertex.args, Object.fromEntries(contract.formals.map(f => [f, f])));
			const spreads = vertex.args.some(a => FunctionArgument.isNotEmpty(a) && !FunctionArgument.isNamed(a) && Identifier.getName(a.name ?? '') === '...');
			const failures = spreads ? [] : contract.required.filter(f => f !== '...' && (bound.get(f)?.length ?? 0) === 0).map(f => `${f} is not given`);
			for(const [formal, claim] of Object.entries(contract.claims)) {
				const given = bound.get(formal) ?? [];
				const values = given.length === 1 ? valueSetGuard(Resolve.toValue(given[0], { graph, environment: vertex.environment, ctx })) : undefined;
				const only = values?.type === 'set' && values.elements.length === 1 ? knownOf(values.elements[0]) : undefined;
				failures.push(...only === undefined ? [] : broken(formal, claim, only));
			}
			const loc = SourceLocation.fromNode(element.node);
			if(failures.length > 0 && loc !== undefined) {
				results.push({ certainty: LintingResultCertainty.Uncertain, involvedId: id, loc, function: vertex.name, broken: failures });
			}
		}
		return { results, '.meta': { checkedCalls } };
	},
	prettyPrint: prettyPrint(
		result => `call of \`${Identifier.toString(result.function)}\` fails its contract at ${SourceLocation.format(result.loc)}`,
		result => `The call of \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)} fails whenever it runs: ${result.broken.join('; ')}.`
	),
	info: {
		name:          'Call Contracts',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds calls that hand a function a value its contract rules out, or leave out an argument it needs, so they fail whenever they run.',
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<CallContractsResult, CallContractsMetadata, CallContractsConfig>;
