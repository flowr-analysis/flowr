import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import { AmbientProjectKey, type AmbientAccessQuery, type AmbientAccessQueryResult, type AmbientAccessSummary } from './ambient-access-query-format';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { AmbientAccess } from '../../../dataflow/graph/ambient-access';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { QueryFunctionFilter } from '../../query-function-filter';
import { log } from '../../../util/log';

function summary(a: AmbientAccess): AmbientAccessSummary {
	return { reads: [...a.reads.keys()].sort(), writes: [...a.writes.keys()].sort(), assumed: [...a.assumed.keys()].sort(), variables: [...a.variables.keys()].sort(), draws: [...a.draws] };
}

/**
 * Executes {@link AmbientAccessQuery}s, sharing one pass over the call graph between all scopes they ask for.
 */
export async function executeAmbientAccessQuery({ analyzer }: BasicQueryData, queries: readonly AmbientAccessQuery[]): Promise<AmbientAccessQueryResult> {
	const start = Date.now();
	const info = await analyzer.dataflow();
	const { ast, idMap } = await analyzer.normalize();
	const functions = Dataflow.sideEffects.ambientAccessOfFunctions(info);
	const results: Record<string, AmbientAccessSummary> = {};
	let perFunction: Record<NodeId, AmbientAccessSummary> | undefined;
	for(const { criteria, includeCallees, functions: askFunctions } of queries) {
		const opts = { includeCallees, functions };
		if(criteria === undefined) {
			ast.files.forEach((f, i) => {
				results[f.filePath ?? `<file ${i + 1}>`] = summary(Dataflow.sideEffects.ambientAccess(info, f.root, opts));
			});
			results[AmbientProjectKey] = summary(Dataflow.sideEffects.ambientAccess(info, ast, opts));
		}
		for(const criterion of criteria ?? []) {
			const id = SlicingCriterion.tryParse(criterion, idMap);
			if(id === undefined) {
				log.warn(`ambient-access: criterion ${criterion} matches no node`);
				continue;
			}
			results[criterion] = summary(Dataflow.sideEffects.ambientAccess(info, id, opts));
		}
		if(askFunctions) {
			perFunction ??= {};
			for(const [id, access] of functions) {
				if(QueryFunctionFilter.written(id)) {
					perFunction[id] = summary(access);
				}
			}
		}
	}
	return { ...metaSince(start), results, ...(perFunction === undefined ? {} : { functions: perFunction }) };
}
