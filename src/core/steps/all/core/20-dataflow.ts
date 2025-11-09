import { internalPrinter, StepOutputFormat } from '../../../print/print';
import { type IPipelineStep , PipelineStepStage } from '../../pipeline-step';
import {
	dataflowGraphToJson,
	dataflowGraphToMermaid,
	dataflowGraphToMermaidUrl,
	dataflowGraphToQuads
} from '../../../print/dataflow-printer';
import type { DeepReadonly } from 'ts-essentials';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RParseRequests } from '../../../../r-bridge/retriever';
import { produceDataFlowGraph } from '../../../../dataflow/extractor';
import type { KnownParserType, Parser } from '../../../../r-bridge/parser';
import type { FlowrConfigOptions } from '../../../../config';

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
} as const;

function processor(results: { normalize?: NormalizedAst }, input: { request?: RParseRequests, parser?: Parser<KnownParserType> }, config: FlowrConfigOptions) {
	return produceDataFlowGraph(input.parser as Parser<KnownParserType>, input.request as RParseRequests, results.normalize as NormalizedAst, config);
}

export const STATIC_DATAFLOW = {
	...staticDataflowCommon,
	humanReadableName: 'dataflow',
	processor,
	requiredInput:     {
	}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof processor>>;
