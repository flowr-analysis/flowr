import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferDataTypes } from '../../../typing/infer';

export function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): DatatypeQueryResult {
	const start = Date.now();
	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const { criterion } of queries) {
		if(result[criterion ?? '1:1'] !== undefined) {
			log.warn('Duplicate criterion in datatype query:', criterion);
			continue;
		}
		const typedAst = inferDataTypes(ast as NormalizedAst< ParentInformation & { typeVariable?: undefined }>, dataflow);
		const node = criterion !== undefined ? typedAst.idMap.get(slicingCriterionToId(criterion, typedAst.idMap)) : typedAst.ast;
		if(node === undefined) {
			log.warn('Criterion not found in normalized AST:', criterion);
			continue;
		}
		result[criterion ?? '1:1'] = node.info.inferredType;
	}

	return {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};
}
