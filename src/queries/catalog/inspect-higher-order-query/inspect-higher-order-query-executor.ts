import type { InspectHigherOrderQuery, InspectHigherOrderQueryResult } from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { type SingleSlicingCriterion, tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { VertexType } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isHigherOrder } from '../../../dataflow/fn/higher-order-function';

/**
 * Execute higher-order function inspection queries on the given analyzer.
 */
export async function executeHigherOrderQuery({ analyzer }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): Promise<InspectHigherOrderQueryResult> {
	const start = Date.now();
	let filters: SingleSlicingCriterion[] | undefined = undefined;
	// filter will remain undefined if at least one of the queries wants all functions
	for(const q of queries) {
		if(q.filter === undefined) {
			filters = undefined;
			break;
		} else {
			filters ??= [];
			filters = filters.concat(filters);
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

	const graph = (await analyzer.dataflow()).graph;

	const fns = graph.verticesOfType(VertexType.FunctionDefinition)
		.filter(([,v]) => filterFor.size === 0 || filterFor.has(v.id));
	const result: Record<NodeId, boolean> = {};
	for(const [id,] of fns) {
		result[id] = isHigherOrder(id, graph, analyzer.inspectContext());
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		higherOrder: result
	};
}
