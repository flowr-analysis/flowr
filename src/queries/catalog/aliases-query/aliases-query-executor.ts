import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { isUndefined } from '../../../util/assert';
//import { SourceLocation } from '../../../util/range';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import type { AliasesQuery, AliasesQueryResult } from './aliases-query-format';

function getAlias(source: NodeId, dfg: DataflowGraph<DataflowGraphVertexInfo, DfEdge>) {
	const result = [];
	const toSearch = [source];
	while(toSearch.length !== 0) {
		const vertex = toSearch.pop();
		if(isUndefined(vertex)) {
			continue;
		}
		for(const [neighbor, edge] of dfg.edgesTo(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types)) {
				toSearch.push(neighbor);
			} else if(DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types)) {
				result.push(neighbor);
			}
		}
		for(const [neighbor, edge] of dfg.edgesFrom(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types)) {
				toSearch.push(neighbor);
			} else if(DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types) && !DfgVertex.isFunctionDefinition(dfg.getVertex(neighbor))) {
				result.push(neighbor);
			}
		}
	}
	return result;
}

/**
 * Executes the given alias queries using the provided analyzer.
 */
export async function executeAliasesQuery({ analyzer }: BasicQueryData, queries: readonly AliasesQuery[]): Promise<AliasesQueryResult> {
	//todo error cases für query noch
	const ast = await analyzer.normalize();
	const idMap = ast.idMap;
	const dataflow = await analyzer.dataflow();
	const dfg = dataflow.graph;
	//const env = dataflow.environment;

	const start = Date.now();
	
	const result = new Map<SlicingCriterion, NodeId[] | undefined>();
	//todo: durch Tupel/Liste anstatt Map ersetzen?
	for(const query of queries) {
		for(const criterion of query.criteria) {
			const nodeId = SlicingCriterion.parse(criterion, idMap);
			const aliases = getAlias(nodeId, dfg);//getAliases([nodeId], dfg, env);
			/*const aliasesLocation = aliases.map(nodeId => {
				return SourceLocation.fromNode(idMap.get(nodeId));
			});*/
			result.set(criterion, aliases);
		}
	}
	return {
		...metaSince(start),
		result: result
	};
}