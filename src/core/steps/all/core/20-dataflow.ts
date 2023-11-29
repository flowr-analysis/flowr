import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { IPipelineStep, StepHasToBeExecuted } from '../../step'
import { produceDataFlowGraph } from '../../../../dataflow'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../../print/dataflow-printer'
import { DeepReadonly } from 'ts-essentials'
import { NormalizedAst } from '../../../../r-bridge'

export const LEGACY_STATIC_DATAFLOW = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	processor:   (results: { normalize?: NormalizedAst }) => produceDataFlowGraph(results.normalize as NormalizedAst),
	executed:    StepHasToBeExecuted.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    dataflowGraphToMermaid,
		[StepOutputFormat.MermaidUrl]: dataflowGraphToMermaidUrl
	},
	dependencies: [ 'normalize' ]
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', (results: { normalize?: NormalizedAst }) => ReturnType<typeof produceDataFlowGraph>>>
