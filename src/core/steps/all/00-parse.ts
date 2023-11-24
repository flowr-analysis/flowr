import { internalPrinter, StepOutputFormat } from '../../print/print'
import { parseToQuads } from '../../print/parse-printer'
import { IStep } from '../step'
import { retrieveXmlFromRCode } from '../../../r-bridge'
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
	dependencies: []
} as const satisfies DeepReadonly<IStep<'parse', typeof retrieveXmlFromRCode>>
