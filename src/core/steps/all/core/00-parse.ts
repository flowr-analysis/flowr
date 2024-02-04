import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { parseToQuads } from '../../../print/parse-printer'
import type { IPipelineStep} from '../../step'
import { PipelineStepStage } from '../../step'
import type { RParseRequest, RShell } from '../../../../r-bridge'
import { retrieveXmlFromRCode } from '../../../../r-bridge'
import type { DeepReadonly } from 'ts-essentials'

export interface ParseRequiredInput {
	/** This is the {@link RShell} connection to be used to obtain the original parses AST of the R code */
	readonly shell:   RShell
	/** The request which essentially indicates the input to extract the AST from */
	readonly request: RParseRequest
}

function processor(_results: unknown, input: Partial<ParseRequiredInput>) {
	return retrieveXmlFromRCode(input.request as RParseRequest, input.shell as RShell)
}

export const PARSE_WITH_R_SHELL_STEP = {
	name:        'parse',
	description: 'Parse the given R code into an AST',
	processor,
	executed:    PipelineStepStage.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     text => text,
		[StepOutputFormat.RdfQuads]: parseToQuads
	},
	dependencies:  [],
	requiredInput: undefined as unknown as ParseRequiredInput
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof processor>>
