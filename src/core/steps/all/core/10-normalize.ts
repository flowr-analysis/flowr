import type {
	IdGenerator,
	NoInfo,
	RShell,
	XmlParserHooks
} from '../../../../r-bridge'
import { internalPrinter, StepOutputFormat } from '../../../print/print'
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../../print/normalize-printer'
import type { IPipelineStep } from '../../step'
import { PipelineStepStage } from '../../step'
import type { DeepPartial, DeepReadonly } from 'ts-essentials'
import type { ParseRequiredInput } from './00-parse'
import { normalize as normalizeV2 } from '../../../../r-bridge/lang-4.x/ast/parser/xml/v2/normalize'
import {normalize as oldNormalize } from "../../../../r-bridge/lang-4.x/ast/parser/json/parser";

export interface NormalizeRequiredInput extends ParseRequiredInput {
	/** These hooks only make sense if you at least want to normalize the parsed R AST. They can augment the normalization process */
	readonly hooks?: DeepPartial<XmlParserHooks>,
	/** This id generator is only necessary if you want to retrieve a dataflow from the parsed R AST, it determines the id generator to use and by default uses the {@link deterministicCountingIdGenerator}*/
	readonly getId?: IdGenerator<NoInfo>
}

function processor(results: { parse?: string }, input: Partial<NormalizeRequiredInput>) {
	return oldNormalize(results.parse as string, input.hooks, input.getId)
}

export const NORMALIZE = {
	name:              'normalize',
	humanReadableName: 'v1 normalize',
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
} as const satisfies DeepReadonly<IPipelineStep<'normalize', typeof processor>>


type DesugarNormalizeRequiredInput = Pick<NormalizeRequiredInput, 'getId'> & ParseRequiredInput

function desugarProcessor(results: { parse?: string }, input: Partial<DesugarNormalizeRequiredInput>) {
	return normalizeV2(results.parse as string, input.getId)
}

export const DESUGAR_NORMALIZE = {
	name:              'normalize',
	humanReadableName: 'v2 normalize',
	description:       'Normalize the AST to flowR\'s AST (v2, with desugaring)',
	processor:         desugarProcessor,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       normalizedAstToJson,
		[StepOutputFormat.RdfQuads]:   normalizedAstToQuads,
		[StepOutputFormat.Mermaid]:    printNormalizedAstToMermaid,
		[StepOutputFormat.MermaidUrl]: printNormalizedAstToMermaidUrl
	},
	dependencies:  [ 'parse' ],
	requiredInput: undefined as unknown as DesugarNormalizeRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'normalize', typeof processor>>
