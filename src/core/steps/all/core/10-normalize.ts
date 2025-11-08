import { internalPrinter, StepOutputFormat } from '../../../print/print';
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../../print/normalize-printer';
import { type IPipelineStep , PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import { normalize } from '../../../../r-bridge/lang-4.x/ast/parser/json/parser';
import type { IdGenerator } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NoInfo } from '../../../../r-bridge/lang-4.x/ast/model/model';
import type { RParseRequest, RParseRequests } from '../../../../r-bridge/retriever';
import type { ParseStepOutput } from '../../../../r-bridge/parser';

export interface NormalizeRequiredInput {
	/** This id generator is only necessary if you want to retrieve a dataflow from the parsed R AST, it determines the id generator to use and by default uses the {@link deterministicCountingIdGenerator}*/
	readonly getId?:             IdGenerator<NoInfo>
	readonly request:            RParseRequests
	/** assume the input stems from a file and use the given path as the file path for the AST */
	readonly overwriteFilePath?: string
}

/**
 *
 */
export function getCurrentRequestFile(request: RParseRequests | undefined): string | undefined {
	if(request === undefined) {
		return undefined;
	} else if(Array.isArray(request)) {
		return (request as ReadonlyArray<RParseRequest>)[0].request === 'file' ? (request as ReadonlyArray<RParseRequest>)[0].content : undefined;
	} else {
		return (request as RParseRequest).request === 'file' ? (request as RParseRequest).content : undefined;
	}
}

function processor(results: { parse?: ParseStepOutput<string> }, input: Partial<NormalizeRequiredInput>) {
	return normalize(results.parse as ParseStepOutput<string>, input.getId, input.overwriteFilePath ?? getCurrentRequestFile(input.request));
}

export const NORMALIZE = {
	name:              'normalize',
	humanReadableName: 'normalize',
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
