import { normalize, retrieveXmlFromRCode } from '../../../r-bridge'
import { internalPrinter, StepOutputFormat } from '../../print/print'
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../print/normalize-printer'
import { IStep } from '../step'
import { DeepReadonly } from 'ts-essentials'

export const NORMALIZE = {
	name:        'normalize',
	description: 'Normalize the AST to flowR\'s AST (first step of the normalization)',
	processor:   normalize,
	required:    'once-per-file',
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       normalizedAstToJson,
		[StepOutputFormat.RdfQuads]:   normalizedAstToQuads,
		[StepOutputFormat.Mermaid]:    printNormalizedAstToMermaid,
		[StepOutputFormat.MermaidUrl]: printNormalizedAstToMermaidUrl
	},
	dependencies: [ 'parse' ]
} as const satisfies DeepReadonly<IStep<typeof normalize>>
