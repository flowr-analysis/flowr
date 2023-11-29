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

export const LEGACY_STATIC_DATAFLOW = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	processor,
	executed:    PipelineStepStage.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    dataflowGraphToMermaid,
		[StepOutputFormat.MermaidUrl]: dataflowGraphToMermaidUrl
	},
	dependencies:  [ 'normalize' ],
	requiredInput: {}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof processor>>
