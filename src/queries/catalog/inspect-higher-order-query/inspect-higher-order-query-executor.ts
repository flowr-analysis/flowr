import type {
	InspectHigherOrderQuery, InspectHigherOrderQueryResult
} from './inspect-higher-order-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { isFunctionDefinitionVertex } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isHigherOrder } from '../../../dataflow/fn/higher-order-function';


export function executeHigherOrderQuery({ dataflow: { graph }, ast, _config }: BasicQueryData, queries: readonly InspectHigherOrderQuery[]): InspectHigherOrderQueryResult {
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

	const filterFor = new Set<NodeId>();
	if(filters) {
		for(const f of filters) {
			const i = tryResolveSliceCriterionToId(f, ast.idMap);
			if(i !== undefined) {
				filterFor.add(i);
			}
		}
	}
	const fns = graph.vertices(true)
		.filter(([,v]) => isFunctionDefinitionVertex(v) && (filterFor.size === 0 || filterFor.has(v.id)));
	const result: Record<NodeId, boolean> = {};
	for(const [id,] of fns) {
		result[id] = isHigherOrder(id, graph);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		higherOrder: result
	};
}
