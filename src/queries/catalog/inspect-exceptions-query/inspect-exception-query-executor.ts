import type {
	InspectExceptionQuery, InspectExceptionQueryResult
} from './inspect-exception-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { type SingleSlicingCriterion, tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { VertexType } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import type { ExceptionPoint } from '../../../dataflow/fn/exceptions-of-function';
import { calculateExceptionsOfFunction } from '../../../dataflow/fn/exceptions-of-function';

/**
 * Get the functions to consider in the call graph based on the given queries.
 */
export async function getFunctionsToConsiderInCallGraph(
	queries: readonly { filter?: readonly SingleSlicingCriterion[] }[],
	analyzer: ReadonlyFlowrAnalysisProvider,
	onlyDefinitions = true
) {
	let filters: SingleSlicingCriterion[] | undefined = undefined;
	// filter will remain undefined if at least one of the queries wants all functions
	for(const q of queries) {
		if(q.filter === undefined) {
			filters = undefined;
			break;
		} else {
			filters ??= [];
			filters = filters.concat(q.filter);
		}
	}

	const ast = await analyzer.normalize();

	const filterFor = new Set<NodeId>();
	if(filters) {
		for(const f of filters) {
			const i = tryResolveSliceCriterionToId(f, ast.idMap);
			if(i !== undefined) {
				filterFor.add(i);
			}
		}
	}

	const cg = await analyzer.callGraph();

	const fns = (onlyDefinitions || filterFor.size === 0 ? cg.verticesOfType(VertexType.FunctionDefinition) : cg.vertices(true))
		.filter(([, v]) => filterFor.size === 0 || filterFor.has(v.id));
	return { cg, fns };
}

/**
 * Execute exception function inspection queries on the given analyzer.
 */
export async function executeExceptionQuery({ analyzer }: BasicQueryData, queries: readonly InspectExceptionQuery[]): Promise<InspectExceptionQueryResult> {
	const start = Date.now();
	const { cg, fns } = await getFunctionsToConsiderInCallGraph(queries, analyzer);
	const result: Record<NodeId, ExceptionPoint[]> = {};

	for(const [id,] of fns) {
		result[id] = calculateExceptionsOfFunction(id, cg);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		exceptions: result
	};
}
