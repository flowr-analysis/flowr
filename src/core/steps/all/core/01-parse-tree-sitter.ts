import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { DeepReadonly } from 'ts-essentials';
import type { Tree } from 'web-tree-sitter';
import type { ParseRequiredInput } from '../../../../r-bridge/parser';
import { parseRequests } from '../../../../r-bridge/parser';

export interface ParseStepOutputTS {
    readonly parsed: Tree
}

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
	requiredInput: undefined as unknown as ParseRequiredInput<Tree>
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof parseRequests<Tree>>>;
