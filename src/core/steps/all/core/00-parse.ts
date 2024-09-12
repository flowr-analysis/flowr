import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { parseToQuads } from '../../../print/parse-printer'
import type { IPipelineStep } from '../../pipeline-step'
import { PipelineStepStage } from '../../pipeline-step'
import type { DeepReadonly } from 'ts-essentials'
import type { RShellExecutor } from '../../../../r-bridge/shell-executor'
import type { RShell } from '../../../../r-bridge/shell'
import type { RParseRequest, RParseRequests } from '../../../../r-bridge/retriever'
import { retrieveParseDataFromRCode } from '../../../../r-bridge/retriever'
import type { QuadSerializationConfiguration } from '../../../../util/quads'

export interface ParseRequiredInput {
	/** This is the {@link RShell} or {@link RShellExecutor} connection to be used to obtain the original parses AST of the R code */
	readonly shell:   RShell | RShellExecutor
	/** The request which essentially indicates the input to extract the AST from */
	readonly request: RParseRequests
}

function processor(_results: unknown, input: Partial<ParseRequiredInput>) {
	/* in the future, we want to expose all cases */
	if(Array.isArray(input.request)) {
		return Promise.all(input.request.map(request => retrieveParseDataFromRCode(request as RParseRequest, input.shell as RShell)))
	} else {
		return retrieveParseDataFromRCode(input.request as RParseRequest, input.shell as RShell)
	}
}

export const PARSE_WITH_R_SHELL_STEP = {
	name:              'parse',
	humanReadableName: 'parse with R shell',
	description:       'Parse the given R code into an AST',
	processor,
	executed:          PipelineStepStage.OncePerFile,
	// TODO: print all files
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     text => text[0],
		[StepOutputFormat.RdfQuads]: (text, config: QuadSerializationConfiguration) => parseToQuads(text[0], config)
	},
	dependencies:  [],
	requiredInput: undefined as unknown as ParseRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof processor>>
