import type { ReplCommand } from './repl-main';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../r-bridge/retriever';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RDataType } from '../../../typing/types';
import type { DataTypeInfo } from '../../../typing/infer';
import { inferDataTypes } from '../../../typing/infer';
import type { DataflowInformation } from '../../../dataflow/info';
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

export const datatypeCommand: ReplCommand = {
	description:  'Get the inferred data type of an R object',
	usageExample: ':datatype [--criterion <criterion>] <code>',
	aliases:      ['dt'],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const [criterion, code] = remainingLine.trim().match(/(?:--criterion\s+(\S+)\s+)?(.+)/)?.slice(1) ?? [undefined, ''];
		const pipelineResult = await createDataflowPipeline(shell, { request: requestFromInput(code as string) }).allRemainingSteps();
		const type = getInferredType(criterion as SingleSlicingCriterion | undefined, pipelineResult.normalize, pipelineResult.dataflow);
		output.stdout(JSON.stringify(type, null, 2));
	}
};
