import { internalPrinter, StepOutputFormat } from '../../print/print'
import { IStep } from '../step'
import { produceDataFlowGraph } from '../../../dataflow'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../print/dataflow-printer'
import { DeepReadonly } from 'ts-essentials'

export const LEGACY_STATIC_DATAFLOW = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	processor:   produceDataFlowGraph,
	required:    'once-per-file',
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    dataflowGraphToMermaid,
		[StepOutputFormat.MermaidUrl]: dataflowGraphToMermaidUrl
	},
	dependencies: [ 'normalize' ]
} as const satisfies DeepReadonly<IStep<'dataflow', typeof produceDataFlowGraph>>
