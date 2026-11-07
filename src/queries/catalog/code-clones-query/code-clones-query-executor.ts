import type { BasicQueryData } from '../../base-query-format';
import type { CodeClonesQuery, CodeClonesQueryResult } from './code-clones-query-format';
import { CloneAlgorithm, type CloneDetectionConfig, DefaultCloneDetectionConfig, detectClones } from '../../../clones/clone-detector';
import { CloneIndex } from '../../../clones/clone-index';
import { ClonePerspective } from '../../../clones/clone-ast';
import { deepMergeObject } from '../../../util/objects';
import { metaSince } from '../../query-meta';
import { log } from '../../../util/log';

/**
 * Builds the clone index of the analyzed files and runs the requested clone detectors on it.
 */
export async function executeCodeClonesQuery({ analyzer }: BasicQueryData, queries: readonly CodeClonesQuery[]): Promise<CodeClonesQueryResult> {
	if(queries.length !== 1) {
		log.warn('The code-clones query expects only up to one query, but got', queries.length);
	}
	const query = queries[0];
	const start = Date.now();
	const algorithms = query.algorithms ?? DefaultCloneDetectionConfig.algorithms;
	const config: CloneDetectionConfig = { ...deepMergeObject<CloneDetectionConfig>(DefaultCloneDetectionConfig, query.config), algorithms };
	const against = query.against?.map(CloneIndex.deserialize) ?? [];
	/* the analyzed files must be presented like the stored ones, or the algorithms compare different rewrites */
	const perspective = query.perspective ?? against[0]?.perspective ?? ClonePerspective.Canonical;
	const mismatch = against.find(a => a.perspective !== perspective);
	if(mismatch) {
		throw new Error(`the code-clones query uses the ${perspective} perspective, but an index to search against was built with ${mismatch.perspective}`);
	}
	const index = await CloneIndex.build(analyzer, {
		perspective,
		pdgs: algorithms.includes(CloneAlgorithm.Similar) || query.exportIndex === true
	});
	const corpus = against.length > 0 ? { perspective: index.perspective, files: against.flatMap(a => a.files), pdgs: against.flatMap(a => a.files.map((_, i) => a.pdgs?.[i] ?? [])) } : undefined;
	const { pairs, stats } = detectClones(index, config, corpus);
	return {
		...metaSince(start),
		pairs,
		stats,
		...(query.exportIndex ? { index: CloneIndex.serialize(index) } : {})
	};
}
