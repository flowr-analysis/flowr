import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferDataTypes } from '../../../typing/unification/infer';
import { inferDataTypes as inferDataTypesUsingSubtyping } from '../../../typing/subtyping/infer';
import type { UnresolvedDataType } from '../../../typing/subtyping/types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../typing/adapter/load-type-signatures';

export async function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): Promise<DatatypeQueryResult> {
	const start = Date.now();

	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const query of queries) {
		const knownTypes = new Map<string, UnresolvedDataType>();
		if(query.useTurcotteTypes) {
			await loadTurcotteTypes(knownTypes);
		}
		if(query.useTracedTypes) {
			await loadTracedTypes(knownTypes);
		}

		const typedAst = query.useSubtyping
			? inferDataTypesUsingSubtyping(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, knownTypes)
			: inferDataTypes(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow);
		for(const criterion of query.criteria ?? ast.idMap.keys().map(id => `$${id}` as SingleSlicingCriterion)) {
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
	}

	return {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};
}