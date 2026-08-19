import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import { normalizeTreeSitter } from '../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import type { NormalizeRequiredInput } from './10-normalize';
import { NormalizePrinters } from './10-normalize';
import type { ParseStepOutput } from '../../../../r-bridge/parser';
import type { Tree } from 'web-tree-sitter';
import type { FlowrAnalyzerContext } from '../../../../project/context/flowr-analyzer-context';

function processor(results: { parse?: ParseStepOutput<Tree> }, input: Partial<NormalizeRequiredInput>) {
	return normalizeTreeSitter(results.parse as ParseStepOutput<Tree>, input.getId, (input.context as FlowrAnalyzerContext).config);
}

export const NORMALIZE_TREE_SITTER = {
	name:              'normalize',
	humanReadableName: 'normalize tree-sitter tree',
	description:       'Normalize the AST to flowR\'s AST',
	processor,
	executed:          PipelineStepStage.OncePerFile,
	printer:           NormalizePrinters,
	dependencies:      [ 'parse' ],
	requiredInput:     undefined as unknown as NormalizeRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'normalize', typeof processor>>;
