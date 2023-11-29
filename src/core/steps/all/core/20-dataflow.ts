import { internalPrinter, StepOutputFormat } from '../../../print/print'
import { IPipelineStep, PipelineStepStage } from '../../step'
import { produceDataFlowGraph } from '../../../../dataflow'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../../print/dataflow-printer'
import { DeepReadonly } from 'ts-essentials'
import { NormalizedAst } from '../../../../r-bridge'

function processor(results: { normalize?: NormalizedAst }) {
	return produceDataFlowGraph(results.normalize as NormalizedAst)
}

const staticDataflowCommon = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	executed:    PipelineStepStage.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    dataflowGraphToMermaid,
		[StepOutputFormat.MermaidUrl]: dataflowGraphToMermaidUrl
	},
	dependencies: [ 'normalize' ],
} as const

export const LEGACY_STATIC_DATAFLOW = {
	...staticDataflowCommon,
	processor,
	requiredInput: {}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof processor>>
