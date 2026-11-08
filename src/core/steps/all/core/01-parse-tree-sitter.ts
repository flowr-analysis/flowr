import { type IPipelineStep, PipelineStepStage, requires } from '../../pipeline-step';
import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { DeepReadonly } from 'ts-essentials';
import type { Tree } from 'web-tree-sitter';
import { type ParseRequiredInput, parseRequests } from '../../../../r-bridge/parser';

export const PARSE_WITH_TREE_SITTER_STEP = {
	name:              'parse',
	humanReadableName: 'parse with tree-sitter',
	description:       'Parse the given R code into an AST using tree-sitter',
	processor:         parseRequests<Tree>,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     JSON.stringify
	},
	dependencies:  [],
	requiredInput: requires<ParseRequiredInput<Tree>>()
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof parseRequests<Tree>>>;
