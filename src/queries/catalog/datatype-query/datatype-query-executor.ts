import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import { getInferredType } from '../../../cli/repl/commands/repl-datatype';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';

export function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): DatatypeQueryResult {
	const start = Date.now();
	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const { criterion } of queries) {
		if(result[criterion]) {
			log.warn('Duplicate criterion in datatype query:', criterion);
		}
		result[criterion] = getInferredType(criterion, ast as NormalizedAst<{ typeVariable?: undefined }>, dataflow);
	}

	return {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};
}
