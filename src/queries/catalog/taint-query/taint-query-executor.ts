import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { TaintQuery, TaintQueryResult } from './taint-query-format';
import type { AllPredefinedTaintAnalysisNames } from '../../../taint-analysis/predefined/predefined';
import { DataflowGraphTaintAnalysisProvenance, TaintProvenanceMode } from '../../../taint-analysis/provenance/dataflow-graph-taint-analysis-provenance';



/**
 * Executes the given taint queries using the provided analyzer.
 */
export async function executeTaintQuery({ analyzer }: BasicQueryData, queries: readonly TaintQuery[]): Promise<TaintQueryResult<AllPredefinedTaintAnalysisNames>> {
	const flattened = queries.flatMap(q => q.defs);
	const start = Date.now();

	if(flattened.length === 0) {
		log.warn('Missing taint query definition');
		return {
			results: new Map(),
			'.meta': {
				timing: Date.now() - start
			},
		};
	}

	const provenanceModes = queries.map(q => q.provenance ?? TaintProvenanceMode.None);
	const provenanceMode = provenanceModes.includes(TaintProvenanceMode.Graph) ? TaintProvenanceMode.Graph
		: provenanceModes.includes(TaintProvenanceMode.Explain) ? TaintProvenanceMode.Explain : TaintProvenanceMode.None;

	const analysis = analyzer
		.taint<AllPredefinedTaintAnalysisNames>()
		.addPredefined(...flattened);
	if(provenanceMode !== TaintProvenanceMode.None) {
		analysis.withProvenance();
	}
	const results = await analysis.run();
	const provenance = provenanceMode === TaintProvenanceMode.None ? undefined : {
		mode:  provenanceMode,
		graph: DataflowGraphTaintAnalysisProvenance.compute((await analyzer.dataflow()).graph, results, analyzer.inspectContext().env.makeCleanEnv())
	};

	return {
		results,
		...(provenance === undefined ? {} : { provenance }),
		'.meta': {
			timing: Date.now() - start
		},
	};
}
