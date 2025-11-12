import { internalPrinter, StepOutputFormat } from '../../../print/print';
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../../print/normalize-printer';
import { type IPipelineStep , PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import { normalizeTreeSitter } from '../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import { type NormalizeRequiredInput , getCurrentRequestFile } from './10-normalize';
import type { FlowrConfigOptions } from '../../../../config';
import type { ParseStepOutput } from '../../../../r-bridge/parser';
import type { Tree } from 'web-tree-sitter';

function processor(results: { 'parse'?: ParseStepOutput<Tree> }, input: Partial<NormalizeRequiredInput>, config: FlowrConfigOptions) {
	return normalizeTreeSitter(results['parse'] as ParseStepOutput<Tree>, input.getId, config, input.overwriteFilePath ?? getCurrentRequestFile(input.request));
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
