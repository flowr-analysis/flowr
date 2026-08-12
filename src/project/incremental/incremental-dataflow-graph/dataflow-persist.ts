import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { DataflowInformation } from '../../../dataflow/info';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import type { FilePath } from '../../context/flowr-file';
import { reviveJson, createPersistenceReplacer } from '../../../util/json-persistence';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';

type ProducedDataflowInformation = DataflowInformation & PipelinePerStepMetaInformation & { cfgQuick: ControlFlowInformation | undefined };

/**
 * Serializes a file's dataflow information and stores it in the incremental analysis context ({@link FlowrAnalyzerContext.inc}).
 */
export function persistDataflowGraph(df: DataflowInformation, ctx: FlowrAnalyzerContext, filePath: FilePath): void {
	const json = JSON.stringify(df, createPersistenceReplacer(ctx, df));
	ctx.inc.storePersistedDataflowGraph(filePath, json);
}

/**
 * Reconstructs a previously persisted dataflow graph for `filePath`.
 */
export function reconstructPersistedDataflowGraph(ctx: FlowrAnalyzerContext, filePath: FilePath): ProducedDataflowInformation | undefined {
	const json = ctx.inc.getPersistedDataflowGraphOf(filePath);
	return json ? reviveJson<ProducedDataflowInformation>(json, ctx) : undefined;
}