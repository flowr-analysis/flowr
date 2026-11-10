import type { InspectRecursionQuery } from './inspect-recursion-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { CallGraph } from '../../../dataflow/graph/call-graph';
import { QueryFunctionFilter } from '../../query-function-filter';
import { getAllLinkedFunctionDefinitions } from '../../../dataflow/internal/linker';
import { isNotUndefined } from '../../../util/assert';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';

/**
 * Execute recursion function inspection queries on the given analyzer.
 */
export async function executeRecursionQuery({ analyzer }: BasicQueryData, queries: readonly InspectRecursionQuery[]): Promise<Record<NodeId, boolean>> {
	const { cg, fns } = await QueryFunctionFilter.inCallGraph(queries, analyzer);

	const result: Record<NodeId, boolean> = {};
	for(const [id] of fns) {
		let recursive = CallGraph.isRecursive(id, cg);
		if(!recursive) {
			const result = (await analyzer.query([{ type: 'aliases', id: [id] }])).aliases.result.flatMap(t => {
				if(t[0] === id) {
					return t[1] as NodeId[];
				}
			}).filter(element => isNotUndefined(element));
			const aliases: Set<NodeId> = new Set(result);
			if(aliases.size === 0) {
				break;
			}
			const dfg = (await analyzer.dataflow()).graph;
			const [functionDefinitions, _] = getAllLinkedFunctionDefinitions(new Set([id]), dfg);
			for(const def of functionDefinitions) {
				//aliases found in the function body?
				const h = new Set(def.subflow.graph);
				for(const i of def.subflow.graph) {
					for(const [neighbor, edge] of dfg.edgesFrom(i)) {
						if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedByOnCall }, edge.types)) {
							h.add(neighbor);
						}
					}
				}
				recursive = recursive || h.intersection(aliases).size !== 0;
			}
		}
		result[id] = recursive;
	}

	return result;
}
