import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { IPipelineStep } from '../../pipeline-step';
import { PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RParseRequests } from '../../../../r-bridge/retriever';
import type { KnownParserType, Parser } from '../../../../r-bridge/parser';
import type { FlowrConfigOptions } from '../../../../config';
import { inferStringDomains } from '../../../../abstract-interpretation/eval/inference';
import { extractCfg } from '../../../../control-flow/extract-cfg';
import type { DataflowInformation } from '../../../../dataflow/info';
import type { Lift, Value } from '../../../../abstract-interpretation/eval/domain';
import { produceDataFlowGraph } from '../../../../dataflow/extractor';
import type { Graph, NodeId } from '../../../../abstract-interpretation/eval/graph';
import { stringGraphToMermaidUrl } from '../../../../cli/repl/commands/repl-string-domain';

export type StringInferenceInformation = {
  values: Map<NodeId, Lift<Value>>,
  graph:  Graph,
};

function processor(results: { dataflow?: DataflowInformation,  normalize?: NormalizedAst }, input: { request?: RParseRequests, parser?: Parser<KnownParserType> }, config: FlowrConfigOptions): StringInferenceInformation {
	const cfg = extractCfg(results.normalize as NormalizedAst, config, (results.dataflow as DataflowInformation).graph);
	const [values, graph] = inferStringDomains(cfg, (results.dataflow as DataflowInformation).graph, results.normalize as NormalizedAst, config);
	results.dataflow = produceDataFlowGraph(input.parser as Parser<KnownParserType>, input.request as RParseRequests, results.normalize as NormalizedAst, config);
	return { values, graph };
}

export const STRING_INFERENCE = {
	name:        'stringInference',
	description: 'Execute string inference',
	executed:    PipelineStepStage.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.MermaidUrl]: (it, normalize?: NormalizedAst) => {
			if(normalize) {
				return stringGraphToMermaidUrl(normalize, it.values, it.graph);
			} else {
				return '';
			}
		},
	},
	dependencies:      [ 'dataflow', 'normalize' ],
	humanReadableName: 'stringInference',
	processor,
	requiredInput:     {}
} as const satisfies DeepReadonly<IPipelineStep<'stringInference', typeof processor>>;
