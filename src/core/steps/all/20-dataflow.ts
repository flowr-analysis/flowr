import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep, StepHasToBeExecuted } from '../step'
import { produceDataFlowGraph } from '../../../dataflow'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../print/dataflow-printer'
import { DeepReadonly } from 'ts-essentials'
import { NormalizedAst } from '../../../r-bridge'
import { guard } from '../../../util/assert'

export const LEGACY_STATIC_DATAFLOW = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	processor:   (results: { normalize?: NormalizedAst }) => {
		guard(results.normalize !== undefined, 'Required input not provided')
		return produceDataFlowGraph(results.normalize)
	},
	executed: StepHasToBeExecuted.OncePerFile,
	printer:  {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    dataflowGraphToMermaid,
		[StepOutputFormat.MermaidUrl]: dataflowGraphToMermaidUrl
	},
	dependencies: [ 'normalize' ]
} as const satisfies DeepReadonly<IStep<'dataflow', (results: { normalize?: NormalizedAst }) => ReturnType<typeof produceDataFlowGraph>>>
