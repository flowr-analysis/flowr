import { type BasicQueryData, filterLineParser, type BaseQueryFormat, type BaseQueryResult } from '../../base-query-format';
import { bold } from '../../../util/text/ansi';
import Joi from 'joi';
import type { QueryResults, SupportedQuery } from '../../query';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SourceLocation } from '../../../util/range';
import { FunctionFilterSchema } from '../../query-function-property';
import type { FunctionGuards, GuardClause } from '../../../dataflow/fn/guards/function-guards';
import type { StatedGuards } from '../../../dataflow/fn/guards/built-in-guards';
import { claimWords, returnWords, relationsOf } from '../../../dataflow/fn/guards/guard-claims';
import { metaSince } from '../../query-meta';
import { QueryFunctionFilter } from '../../query-function-filter';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { GuardTerm } from '../../../dataflow/fn/guards/guard-term';
import { conditionsPerFormal } from '../../../dataflow/fn/guards/function-guards';
import { Identifier, type BrandedIdentifier } from '../../../dataflow/environments/identifier';
import { defaultGuardFacts } from '../../../dataflow/fn/guards/guard-knowledge';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';

/** The part of the answer for one function a query asks for, `undefined` if that is nothing. */
function keep(guards: FunctionGuards, { kind, onlyPure, formals }: InspectFnGuardsQuery): FunctionGuards | undefined {
	const named: ReadonlySet<BrandedIdentifier> | undefined = formals && new Set(formals);
	const wanted = (clause: GuardClause) => (kind === undefined || clause.kind === kind) && (!onlyPure || clause.pure)
		&& (named === undefined || GuardTerm.formalsOf(clause.requires).values().some(f => named.has(f)));
	const onlyNamed = <T>(of: Readonly<Record<BrandedIdentifier, T>>) => named === undefined ? of : Object.fromEntries(Object.entries(of).filter(([name]) => named.has(name)));
	const clauses = guards.clauses.filter(wanted);
	const kept: FunctionGuards = {
		...FunctionSemantics.guardSummary(clauses),
		clauses,
		conditions:  onlyNamed(conditionsPerFormal(clauses)),
		formals:     onlyNamed(guards.formals),
		relations:   relationsOf(clauses.map(c => c.requires), defaultGuardFacts()),
		conditional: guards.conditional.filter(c => named === undefined || named.has(c.formal)),
		required:    guards.required.filter(f => named === undefined || named.has(f)),
		...(guards.returns === undefined ? {} : { returns: guards.returns }),
		...(guards.passes === undefined ? {} : { passes: guards.passes })
	};
	return clauses.length > 0 || kept.required.length > 0 || Object.keys(kept.formals).length > 0 || kept.returns !== undefined ? kept : undefined;
}

/** What R's functions of the given names ask for, the ones flowR knows nothing of left out. */
function statedFor(names: readonly string[], ctx: ReadOnlyFlowrAnalyzerContext): Record<string, StatedGuards> {
	return Object.fromEntries(names.flatMap(name => {
		const stated = FunctionSemantics.contracts.statedOf(Identifier.parse(name), ctx);
		return stated === undefined ? [] : [[name, stated]];
	}));
}

/** Execute function-guard inspection queries on the given analyzer. */
export async function executeFnGuardsQuery({ analyzer }: BasicQueryData, queries: readonly InspectFnGuardsQuery[]): Promise<InspectFnGuardsQueryResult> {
	const start = Date.now();
	const filterFor = await QueryFunctionFilter.criteria(queries, analyzer);
	const [query = { type: 'inspect-fn-guards' }] = queries;
	const graph = (await analyzer.dataflow()).graph;
	const guards = FunctionSemantics.guards(QueryFunctionFilter.definitions(graph, filterFor), graph, { ctx: analyzer.inspectContext() });
	return {
		...metaSince(start),
		...(query.builtIns === undefined ? {} : { builtIns: statedFor(query.builtIns, analyzer.inspectContext()) }),
		guards: Object.fromEntries(Object.entries(guards).flatMap(([id, of]) => {
			const kept = keep(of, query);
			return kept === undefined ? [] : [[id, kept]];
		}))
	};
}

/** Returns what function definitions ask of the calls they return from, for all of them or just those matching the filter. */
export interface InspectFnGuardsQuery extends BaseQueryFormat {
	readonly type:      'inspect-fn-guards'
	readonly filter?:   readonly SlicingCriterion[]
	/** keep only the conditions the function checks itself (`explicit`) or those R checks for it (`implicit`) */
	readonly kind?:     GuardClause['kind']
	/** keep only the conditions failing before any side effect */
	readonly onlyPure?: boolean
	/** keep only what is said about these formals */
	readonly formals?:  readonly BrandedIdentifier[]
	/** also state what these functions of R ask for, written `name` or `pkg::name` */
	readonly builtIns?: readonly string[]
}

export interface InspectFnGuardsQueryResult extends BaseQueryResult {
	/** per function definition with anything to say about it, what it asks for */
	readonly guards:    Record<NodeId, FunctionGuards>
	/** what the functions {@link InspectFnGuardsQuery.builtIns} names ask for, those flowR knows nothing of left out */
	readonly builtIns?: Record<string, StatedGuards>
}

/** Adds what has to be supplied, and what is claimed about each formal. */
function pushClaims(result: string[], { required = [], formals = {}, relations = [], conditional = [], returns, passes }: StatedGuards): void {
	if(required.length > 0) {
		result.push(`    a call has to supply: ${required.join(', ')}`);
	}
	for(const [formal, claim] of Object.entries(formals)) {
		result.push(`    ${formal}: ${claimWords(claim).join(', ')}`);
	}
	for(const { formal, claim, unless } of conditional) {
		result.push(`    ${formal}: ${claimWords(claim).join(', ')}, unless ${unless}`);
	}
	for(const { holds, unless } of relations) {
		result.push(`    relation: ${holds}${unless === undefined ? '' : ` unless ${unless}`}`);
	}
	if(returns !== undefined || passes !== undefined) {
		result.push(`    returns: ${returnWords(returns, passes).join(', ')}`);
	}
}

export const InspectFnGuardsQueryDefinition = {
	title:           'Inspect Function Guards Query',
	executor:        executeFnGuardsQuery,
	asciiSummarizer: async(formatter, processed, queryResults, result) => {
		const out = queryResults as QueryResults<'inspect-fn-guards'>['inspect-fn-guards'];
		result.push(`Query: ${bold('inspect-fn-guards', formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
		const idMap = (await processed.normalize()).idMap;
		for(const [id, guards] of Object.entries(out.guards)) {
			const node = idMap.get(NodeId.normalize(id));
			result.push(`  - Function ${bold(id, formatter)} (${SourceLocation.format(node ? SourceLocation.fromNode(node) : undefined)}) requires ${guards.requires === '' ? 'nothing' : guards.requires}`);
			if(guards.pure !== '' && guards.pure !== guards.requires) {
				result.push(`    failing cleanly on: ${guards.pure}`);
			}
			pushClaims(result, guards);
			for(const [formal, conditions] of Object.entries(guards.conditions)) {
				result.push(`    ${formal} is checked by: ${conditions.join(', ')}`);
			}
		}
		for(const [name, guards] of Object.entries(out.builtIns ?? {})) {
			result.push(`  - ${bold(name, formatter)} requires ${guards.requires === '' ? 'nothing' : guards.requires}`);
			pushClaims(result, guards);
		}
		return true;
	},
	fromLine: filterLineParser('inspect-fn-guards'),
	syntax:   '@inspect-fn-guards [(<crit>;...)] <code | file://path>',
	schema:   Joi.object({
		type:     Joi.string().valid('inspect-fn-guards').required().description('The type of the query.'),
		filter:   FunctionFilterSchema,
		kind:     Joi.string().valid('explicit', 'implicit').optional().description('Keep only the conditions the function checks itself, or only those R checks for it.'),
		onlyPure: Joi.boolean().optional().description('Keep only the conditions failing before any side effect.'),
		formals:  Joi.array().items(Joi.string()).min(1).optional().description('Keep only what is said about the formals written as one of these names.'),
		builtIns: Joi.array().items(Joi.string()).min(1).optional().description('Also state what these functions of R ask for, written `name` or `pkg::name`.')
	}).description('Returns what function definitions ask of the calls they return from, for all of them or just those matching the filter.'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => Object.keys((queryResults as QueryResults<'inspect-fn-guards'>['inspect-fn-guards']).guards)
} as const satisfies SupportedQuery<'inspect-fn-guards'>;
