import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { DataflowInformation } from '../../../dataflow/info';
import type { RDataType } from '../../../typing/types';
import type { DataTypeInfo } from '../../../typing/infer';
import { inferDataTypes } from '../../../typing/infer';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { guard } from '../../../util/assert';

/**
 * Get the inferred data type of a node in the normalized AST
 *
 * @param criterion - The criterion to get the data type of
 * @param normalizedAst - The normalizedAst of the R code
 * @param dataflow - The dataflow information for the R code
 * @returns The data type of the node inferred by the type inferencer
 */
export function getInferredType(criterion: SingleSlicingCriterion | undefined, normalizedAst: NormalizedAst<{ typeVariable?: undefined }>, dataflow: DataflowInformation): RDataType {
	const typedAst = inferDataTypes(normalizedAst, dataflow);
	let node: RNode<DataTypeInfo>;
	if(criterion !== undefined) {
		const criterionNode = typedAst.idMap.get(slicingCriterionToId(criterion, normalizedAst.idMap));
		guard(criterionNode !== undefined, `Criterion ${criterion} not found in normalized AST`);
		node = criterionNode;
	} else {
		node = typedAst.ast;
	};
	return node.info.inferredType;
}

export function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): DatatypeQueryResult {
	const start = Date.now();
	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const { criterion } of queries) {
		if(criterion !== undefined && result[criterion]) {
			log.warn('Duplicate criterion in datatype query:', criterion);
		}
		result[criterion ?? '1:1'] = getInferredType(criterion, ast as NormalizedAst<{ typeVariable?: undefined }>, dataflow);
	}

	return {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};
}
