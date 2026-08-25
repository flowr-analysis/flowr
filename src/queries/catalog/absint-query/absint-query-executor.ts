import { AbstractInterpreter, type AbsintAnalysis } from '../../../abstract-interpretation/absint-inference';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { AbsintQueryInferences, type AbsintQuery, type AbsintQueryDomain, type AbsintQueryDomains, type AbsintQueryResult, type AbsintQueryStateDomain, type AbsintQueryType } from './absint-query-format';

/**
 * Executes the given abstract interpretation queries using the provided analyzer.
 */
export async function executeAbsintQuery<AbsintType extends AbsintQueryType>({ analyzer }: BasicQueryData, queries: readonly AbsintQuery<AbsintType>[]): Promise<AbsintQueryResult<AbsintType>> {
	if(queries.length === 0 || queries.some(query => query.inference !== queries[0].inference)) {
		throw new Error('The inference types of bundled abstract interpretation queries must be the same.');
	}
	if(queries.length > 1 && queries.some(query => query.criteria === undefined)) {
		log.warn('The abstract interpretation query expects only up to one query without slicing criteria, but got', queries.length);
		queries = [{ type: 'absint', inference: queries[0].inference }];
	}

	const inference = AbsintQueryInferences[queries[0].inference];
	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow();

	const start = Date.now();
	const analysis = inference.create() as unknown as AbsintAnalysis<AbsintQueryDomains<AbsintType>>;
	const interpreter = new AbstractInterpreter({ controlFlow: cfg, dfg, normalizedAst: ast, ctx: analyzer.inspectContext() }, analysis);
	interpreter.start();

	if(queries.length === 1 && queries[0].criteria === undefined) {
		const state = ('domain' in inference ? interpreter.getEndState(inference.domain) : interpreter.getEndState()) as AbsintQueryStateDomain<AbsintType>;

		return {
			'.meta': {
				timing: Date.now() - start
			},
			result: state
		};
	}
	const result = new Map<SlicingCriterion, AbsintQueryDomain<AbsintType> | undefined>();

	for(const query of queries) {
		if(query.criteria === undefined) {
			log.warn('Missing criterion in abstract interpretation query');
			continue;
		}
		for(const criterion of query.criteria) {
			if(result.has(criterion)) {
				log.warn('Duplicate criterion in abstract interpretation query:', query.criteria);
				continue;
			}
			try {
				const nodeId = SlicingCriterion.parse(criterion, ast.idMap);
				const value = ('domain' in inference ? interpreter.getAbstractValue(nodeId, inference.domain) : interpreter.getAbstractValue(nodeId)) as AbsintQueryDomain<AbsintType>;
				result.set(criterion, value);
			} catch(err) {
				console.error(err instanceof Error ? err.message : err);
			}
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		result: result
	};
}
