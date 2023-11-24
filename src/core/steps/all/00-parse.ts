import { internalPrinter, StepOutputFormat } from '../../print/print'
import { parseToQuads } from '../../print/parse-printer'
import { IStep } from '../step'
import { retrieveXmlFromRCode, RParseRequest, RShell } from '../../../r-bridge'
import { DeepReadonly } from 'ts-essentials'


export const PARSE_WITH_R_SHELL_STEP = {
	name:        'parse',
	description: 'Parse the given R code into an AST',
	processor:   retrieveXmlFromRCode,
	required:    'once-per-file',
	printer:     {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     text => text,
		[StepOutputFormat.RdfQuads]: parseToQuads
	},
	dependencies:  [],
	requiredInput: {
		/** This is the {@link RShell} connection to be used to obtain the original parses AST of the R code */
		shell:   undefined as unknown as RShell,
		/** The request which essentially indicates the input to extract the AST from */
		request: undefined as unknown as RParseRequest
	}
} as const satisfies DeepReadonly<IStep<'parse', typeof retrieveXmlFromRCode>>
