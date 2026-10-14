import type { TaintProvenanceQuery, TaintProvenanceQueryResult } from './taint-provenance-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { DataflowGraphTaintAnalysisProvenance, type TaintProvenanceEvents } from '../../../taint-analysis/provenance/dataflow-graph-taint-analysis-provenance';
import type { AnyPredefinedTaintAnalysisName } from '../../../taint-analysis/predefined/predefined';
import type { TaintInferenceResult } from '../../../taint-analysis/builder/taint-analysis';

/** Executes the taint provenance query */
export async function executeTaintProvenanceQuery({ analyzer }: BasicQueryData, queries: readonly TaintProvenanceQuery[]): Promise<TaintProvenanceQueryResult> {
	if(queries.length !== 1) {
		log.warn('Taint provenance query expects only up to one query, but got', queries.length);
	}

	const start = Date.now();
	const defs = queries.flatMap(q => q.defs ?? []);
	const events: TaintProvenanceEvents = new Map();
	let taint = new Map<string, TaintInferenceResult>();

	if(defs.length === 0) {
		log.warn('Missing taint provenance query definition');
	} else {
		taint = await analyzer.taint<AnyPredefinedTaintAnalysisName[]>().addPredefined(...defs).withProvenance(events).run();
	}

	const provenance = DataflowGraphTaintAnalysisProvenance.compute((await analyzer.dataflow()).graph, taint, events, analyzer.inspectContext().env.makeCleanEnv());

	return {
		'.meta': {
			timing: Date.now() - start
		},
		provenance,
		taint
	};
}