import type { DfShapeQuery, DfShapeQueryResult } from './df-shape-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { extractCFG } from '../../../util/cfg/cfg';
import { performDataFrameAbsint } from '../../../abstract-interpretation/data-frame/abstract-interpretation';

export function executeDfShapeQuery({ dataflow: { graph }, ast }: BasicQueryData, queries: readonly DfShapeQuery[]): DfShapeQueryResult {
	if(queries.length !== 1) {
		log.warn('The data-frame shape query expects only up to one query, but got', queries.length);
	}

	const start = Date.now();
	const cfg = extractCFG(ast, graph);
	const domains = performDataFrameAbsint(cfg, graph);
	
	return {
		'.meta': {
			timing: Date.now() - start
		},
		domains
	};
}
