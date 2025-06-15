import { internalPrinter, StepOutputFormat } from '../../../print/print';
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../../print/normalize-printer';
import type { IPipelineStep } from '../../pipeline-step';
import { PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import { normalizeTreeSitter } from '../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import type { NormalizeRequiredInput } from './10-normalize';
import { getCurrentRequestFile } from './10-normalize';
import type { ParseStepOutputTS } from './01-parse-tree-sitter';

function processor(results: { 'parse'?: ParseStepOutputTS }, input: Partial<NormalizeRequiredInput>) {
	return normalizeTreeSitter(results['parse'] as ParseStepOutputTS, input.getId, input.overwriteFilePath ?? getCurrentRequestFile(input.request));
}

export const NORMALIZE_TREE_SITTER = {
	name:              'normalize',
	humanReadableName: 'normalize tree-sitter tree',
	description:       'Normalize the AST to flowR\'s AST',
	processor,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       normalizedAstToJson,
		[StepOutputFormat.RdfQuads]:   normalizedAstToQuads,
		[StepOutputFormat.Mermaid]:    printNormalizedAstToMermaid,
		[StepOutputFormat.MermaidUrl]: printNormalizedAstToMermaidUrl
	},
	dependencies:  [ 'parse' ],
	requiredInput: undefined as unknown as NormalizeRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'normalize', typeof processor>>;
