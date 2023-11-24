import { IdGenerator, NoInfo, normalize, XmlParserHooks } from '../../../r-bridge'
import { internalPrinter, StepOutputFormat } from '../../print/print'
import {
	normalizedAstToJson,
	normalizedAstToQuads,
	printNormalizedAstToMermaid,
	printNormalizedAstToMermaidUrl
} from '../../print/normalize-printer'
import { IStep, StepHasToBeExecuted } from '../step'
import { DeepPartial, DeepReadonly } from 'ts-essentials'

export const NORMALIZE = {
	name:        'normalize',
	description: 'Normalize the AST to flowR\'s AST (first step of the normalization)',
	processor:   normalize,
	executed:    StepHasToBeExecuted.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       normalizedAstToJson,
		[StepOutputFormat.RdfQuads]:   normalizedAstToQuads,
		[StepOutputFormat.Mermaid]:    printNormalizedAstToMermaid,
		[StepOutputFormat.MermaidUrl]: printNormalizedAstToMermaidUrl
	},
	dependencies:  [ 'parse' ],
	requiredInput: {
		/** These hooks only make sense if you at least want to normalize the parsed R AST. They can augment the normalization process */
		hooks: undefined as unknown as DeepPartial<XmlParserHooks>,
		/** This id generator is only necessary if you want to retrieve a dataflow from the parsed R AST, it determines the id generator to use and by default uses the {@link deterministicCountingIdGenerator}*/
		getId: undefined as unknown as IdGenerator<NoInfo>
	}
} as const satisfies DeepReadonly<IStep<'normalize', typeof normalize>>
