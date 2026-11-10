import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import type { DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import { SourceLocation } from '../../../util/range';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import type { AliasesQuery, AliasesQueryResult } from './aliases-query-format';

function getAlias(source: NodeId, dfg: DataflowGraph<DataflowGraphVertexInfo, DfEdge>) {
	const result = [];
	const toSearch = [source];
	const alreadyVisited = new Set<NodeId>();
	while(toSearch.length !== 0) {
		const vertex = toSearch.pop();
		if(isUndefined(vertex) || alreadyVisited.has(vertex)) {
			continue;
		}
		for(const [neighbor, edge] of dfg.edgesTo(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedByOnCall }, edge.types)) {
				toSearch.push(neighbor);
				if(DfgVertex.isVariableDefinition(dfg.getVertex(neighbor))) {
					result.push(neighbor);
				}
			}
		}
		for(const [neighbor, edge] of dfg.edgesFrom(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.DefinesOnCall }, edge.types)) {
				toSearch.push(neighbor);
				if(DfgVertex.isVariableDefinition(dfg.getVertex(neighbor))) {
					result.push(neighbor);
				}
			}
		}
		alreadyVisited.add(vertex);
	}
	return result;
}

/**
 * Executes the given alias queries using the provided analyzer.
 */
export async function executeAliasesQuery({ analyzer }: BasicQueryData, queries: readonly AliasesQuery[]): Promise<AliasesQueryResult> {
	const ast = await analyzer.normalize();
	const idMap = ast.idMap;
	const dataflow = await analyzer.dataflow();
	const dfg = dataflow.graph;
	//const env = dataflow.environment;

	const start = Date.now();

	const result: ([SlicingCriterion, SourceLocation[]] | [NodeId, NodeId[]])[] = [];
	for(const query of queries) {
		if(isNotUndefined(query.criteria)) {
			for(const criterion of query.criteria) {
				const nodeId = SlicingCriterion.parse(criterion, idMap);
				const aliases = getAlias(nodeId, dfg);
				const aliasesLocation = aliases.map(nodeId => {
					return SourceLocation.fromNode(idMap.get(nodeId));
				}).filter(element => isNotUndefined(element));
				result.push([criterion, aliasesLocation]);
			}
		}
		if(isNotUndefined(query.id)) {
			for(const nodeId of query.id) {
				const aliases = getAlias(nodeId, dfg);
				result.push([nodeId, aliases]);
			}
		}
	}
	return {
		...metaSince(start),
		result: result
	};
}