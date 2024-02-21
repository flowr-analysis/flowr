import { internalPrinter, StepOutputFormat } from '../../../print/print'
import type { IPipelineStep} from '../../step'
import { PipelineStepStage } from '../../step'
import { produceDataFlowGraph as legacyDataflowGraph } from '../../../../dataflow/v1'
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../../print/dataflow-printer'
import type { DeepReadonly } from 'ts-essentials'
import type { NormalizedAst, RParseRequest } from '../../../../r-bridge'
import { produceDataFlowGraph as v2DataflowGraph } from '../../../../dataflow/v2/entry'

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

function legacyProcessor(results: { normalize?: NormalizedAst }, input: { request?: RParseRequest }) {
	return legacyDataflowGraph(input.request as RParseRequest, results.normalize as NormalizedAst)
}

export const LEGACY_STATIC_DATAFLOW = {
	...staticDataflowCommon,
	humanReadableName: 'v1 dataflow',
	processor:         legacyProcessor,
	requiredInput:     {
		request: undefined as unknown as RParseRequest
	}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof legacyProcessor>>

function v2Processor() {
	return v2DataflowGraph()
}

export const V2_STATIC_DATAFLOW = {
	...staticDataflowCommon,
	humanReadableName: 'v2 dataflow',
	processor:         v2Processor,
	requiredInput:     {}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof v2Processor>>
