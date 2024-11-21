import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { DeepReadonly } from 'ts-essentials';
import { type RParseRequest, type RParseRequests } from '../../../../r-bridge/retriever';
import type { TreeSitterExecutor } from '../../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { Tree } from 'web-tree-sitter';

export interface ParseRequiredInputTS {
    readonly treeSitter: TreeSitterExecutor
    readonly request:    RParseRequests
}

export interface ParseStepOutputTS {
    readonly parsed: Tree
}

function processor(_results: unknown, input: Partial<ParseRequiredInputTS>): ParseStepOutputTS {
	/* in the future, we want to expose all cases */
	if(Array.isArray(input.request)) {
		return { parsed: (input.treeSitter as TreeSitterExecutor).parse(input.request[0] as RParseRequest) };
	} else {
		return { parsed: (input.treeSitter as TreeSitterExecutor).parse(input.request as RParseRequest) };
	}
}

export const PARSE_WITH_TREE_SITTER_STEP = {
	name:              'parse',
	humanReadableName: 'parse with tree-sitter',
	description:       'Parse the given R code into an AST using tree-sitter',
	processor,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     JSON.stringify,
		// TODO [StepOutputFormat.RdfQuads]: ({ parsed }, config: QuadSerializationConfiguration) => parseToQuads(parsed, config)
	},
	dependencies:  [],
	requiredInput: undefined as unknown as ParseRequiredInputTS
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof processor>>;
