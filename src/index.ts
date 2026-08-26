/**
 * What `import ... from '@eagleoutice/flowr'` gives you: the entry points an analysis is written against.
 *
 * Everything flowR has stays reachable under its own path (`@eagleoutice/flowr/dataflow/graph/graph` and its
 * kin), which is what the wiki links to. This module only spares the common case from knowing where a name
 * lives, so it re-exports rather than defines.
 * @example
 * ```ts
 * import { FlowrAnalyzerBuilder } from '@eagleoutice/flowr';
 *
 * const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
 * analyzer.addRequest('x <- 1\ny <- x\nx');
 * const slice = await analyzer.query([{ type: 'static-slice', criteria: ['3@x'] }]);
 * ```
 * @module
 */

/* the analyzer, which is the front door: everything else here is what its methods hand you or take */
export { FlowrAnalyzer } from './project/flowr-analyzer';
export type { FlowrAnalysisOptions, FlowrAnalysisProvider, ReadonlyFlowrAnalysisProvider } from './project/flowr-analyzer';
export { FlowrAnalyzerBuilder } from './project/flowr-analyzer-builder';
/* what `functionInfo` takes and hands back */
export { Identifier } from './dataflow/environments/identifier';
export type { FnInfo } from './dataflow/environments/query-fn-props';

/* what an analysis is asked for and what it answers with */
export type { Query, QueryResults, SupportedQueryTypes } from './queries/query';
export { SlicingCriteria, SlicingCriterion } from './slicing/criterion/parse';

/* what to analyze, and what reads it */
export { requestFromInput } from './r-bridge/retriever';
export type { RParseRequest, RParseRequests } from './r-bridge/retriever';
export type { KnownParser } from './r-bridge/parser';
export { RShell } from './r-bridge/shell';
export { TreeSitterExecutor } from './r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

/* how it is configured */
export { FlowrConfig } from './config';

/* the low-level interface the analyzer is built on, for anyone assembling their own pipeline */
export { PipelineExecutor } from './core/pipeline-executor';
export {
	DEFAULT_DATAFLOW_PIPELINE, DEFAULT_SLICING_PIPELINE, DEFAULT_SLICE_WITHOUT_RECONSTRUCT_PIPELINE,
	TREE_SITTER_DATAFLOW_PIPELINE, TREE_SITTER_SLICING_PIPELINE, TREE_SITTER_SLICE_WITHOUT_RECONSTRUCT_PIPELINE
} from './core/steps/pipeline/default-pipelines';

/* which flowR this is */
export { flowrVersion, retrieveVersionInformation } from './util/version';
export type { VersionInformation } from './util/version';
