import type { BasicQueryData } from '../../base-query-format';
import type { HappensBeforeQuery, HappensBeforeQueryResult } from './happens-before-query-format';
import { Ternary } from '../../../util/logic';
import { log } from '../../../util/log';
import { extractCfgQuick } from '../../../control-flow/extract-cfg';
import { happensBefore } from '../../../control-flow/happens-before';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';

export async function executeHappensBefore({ analyzer }: BasicQueryData, queries: readonly HappensBeforeQuery[]): Promise<HappensBeforeQueryResult> {
	const start = Date.now();
	const results: Record<string, Ternary> = {};
	const ast = await analyzer.normalize();
	const cfg = extractCfgQuick(ast);
	for(const query of queries) {
		const { a, b } = query;
		const fingerprint = `${a}<${b}`;
		if(fingerprint in results) {
			log.warn('Duplicate happens-before query', query, 'ignoring');
		}

		try {
			const resolvedA = slicingCriterionToId(a, ast.idMap);
			const resolvedB = slicingCriterionToId(b, ast.idMap);

			results[fingerprint] = happensBefore(cfg.graph, resolvedA, resolvedB);
		} catch(e) {
			log.error('Error while executing happens-before query', query, e);
			results[fingerprint] = Ternary.Maybe;
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
