import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferDataTypes } from '../../../typing/unification/infer';
import { inferDataTypes as inferDataTypesUsingSubtyping } from '../../../typing/subtyping/infer';
import type { DataTypeInfo } from '../../../typing/types';

export function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): DatatypeQueryResult {
	const result: DatatypeQueryResult['inferredTypes'] = {};
	const extractInferredTypeFromAst = (typedAst: NormalizedAst<DataTypeInfo>, criteria: SingleSlicingCriterion[]): void => {
		for(const criterion of criteria) {
			if(result[criterion] !== undefined) {
				log.warn('Duplicate criterion in datatype query:', criterion);
				continue;
			}
			
			const node = criterion !== undefined ? typedAst.idMap.get(slicingCriterionToId(criterion, typedAst.idMap)) : typedAst.ast;
			if(node === undefined) {
				log.warn('Criterion not found in normalized AST:', criterion);
				continue;
			}
			
			result[criterion] = node.info.inferredType;
		}
	};
	const [queriesWithoutSubtyping, queriesUsingSubtyping] = queries.reduce(([unificationGroup, subtypingGroup], query) => query.useSubtyping ? [unificationGroup, [...subtypingGroup, query]] : [[...unificationGroup, query], subtypingGroup], [[], []] as [DatatypeQuery[], DatatypeQuery[]]);

	const start = Date.now();

	if(queriesWithoutSubtyping.length > 0) {
		const typedAst = inferDataTypes(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow);
		extractInferredTypeFromAst(typedAst, queriesWithoutSubtyping.map(query => query.criterion ?? '1:1'));
	}

	if(queriesUsingSubtyping.length > 0) {
		const typedAst = inferDataTypesUsingSubtyping(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow);
		extractInferredTypeFromAst(typedAst, queriesUsingSubtyping.map(query => query.criterion ?? '1:1'));
	}

	return {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};
}
