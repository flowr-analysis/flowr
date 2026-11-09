import type { InspectFnGuardsQuery, InspectFnGuardsQueryResult } from './inspect-fn-guards-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { QueryFunctionFilter } from '../../query-function-filter';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { GuardTerm } from '../../../dataflow/fn/guards/guard-term';
import { conditionsPerFormal } from '../../../dataflow/fn/guards/function-guards';
import type { FunctionGuards, GuardClause } from '../../../dataflow/fn/guards/function-guards';
import { Identifier, type BrandedIdentifier } from '../../../dataflow/environments/identifier';
import { relationsOf } from '../../../dataflow/fn/guards/guard-claims';
import { builtInGuards, type StatedGuards } from '../../../dataflow/fn/guards/built-in-guards';

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
		conditions: onlyNamed(conditionsPerFormal(clauses)),
		formals:    onlyNamed(guards.formals),
		relations:  relationsOf(clauses.map(c => c.requires)),
		required:   guards.required.filter(f => named === undefined || named.has(f))
	};
	return clauses.length > 0 || kept.required.length > 0 || Object.keys(kept.formals).length > 0 ? kept : undefined;
}

/** What R's functions of the given names ask for, the ones flowR knows nothing of left out. */
function statedFor(names: readonly string[]): Record<string, StatedGuards> {
	return Object.fromEntries(names.flatMap(name => {
		const id = Identifier.parse(name);
		const stated = builtInGuards(Identifier.getName(id), Identifier.getNamespace(id));
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
		...(query.builtIns === undefined ? {} : { builtIns: statedFor(query.builtIns) }),
		guards: Object.fromEntries(Object.entries(guards).flatMap(([id, of]) => {
			const kept = keep(of, query);
			return kept === undefined ? [] : [[id, kept]];
		}))
	};
}
