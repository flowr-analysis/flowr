import { internalPrinter, StepOutputFormat } from '../../../print/print';
import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import {
	dataflowGraphToJson,
	dataflowGraphToQuads
} from '../../../print/dataflow-printer';
import type { DeepReadonly } from 'ts-essentials';
import type { NormalizedAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { produceDataFlowGraph } from '../../../../dataflow/extractor';
import type { KnownParserType, Parser } from '../../../../r-bridge/parser';
import type { FlowrAnalyzerContext } from '../../../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../../../dataflow/graph/df-helper';
import { persistDataflowGraph, reconstructPersistedDataflowGraph } from '../../../../project/incremental/incremental-dataflow-graph/dataflow-persist';
import { FlowrFile } from '../../../../project/context/flowr-file';

const staticDataflowCommon = {
	name:        'dataflow',
	description: 'Construct the dataflow graph',
	executed:    PipelineStepStage.OncePerFile,
	printer:     {
		[StepOutputFormat.Internal]:   internalPrinter,
		[StepOutputFormat.Json]:       dataflowGraphToJson,
		[StepOutputFormat.RdfQuads]:   dataflowGraphToQuads,
		[StepOutputFormat.Mermaid]:    Dataflow.visualize.mermaid.raw,
		[StepOutputFormat.MermaidUrl]: Dataflow.visualize.mermaid.url
	},
	dependencies: [ 'normalize' ],
} as const;

function processor(results: { normalize?: NormalizedAst }, input: { parser?: Parser<KnownParserType>, context?: FlowrAnalyzerContext }) {
	const ctx = input.context as FlowrAnalyzerContext;
	const filePath = (results.normalize as NormalizedAst).ast.files[0]?.filePath ?? FlowrFile.INLINE_PATH;

	if(!ctx.inc.handleShouldReparseDataflow(filePath, ctx)) {
		const reused = reconstructPersistedDataflowGraph(ctx, filePath);
		if(reused) {
			return reused;
		}
	}

	const df = produceDataFlowGraph(input.parser as Parser<KnownParserType>, results.normalize as NormalizedAst, ctx);

	if(ctx.config.incremental.dataflow.activated) {
		persistDataflowGraph(df, ctx, filePath);
	}

	return df;
}

export const STATIC_DATAFLOW = {
	...staticDataflowCommon,
	humanReadableName: 'dataflow',
	processor,
	requiredInput:     {
	}
} as const satisfies DeepReadonly<IPipelineStep<'dataflow', typeof processor>>;
