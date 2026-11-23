import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { DfgVertex, type DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { isNotUndefined, isUndefined } from '../../../util/assert';
import { SourceLocation } from '../../../util/range';
import type { BasicQueryData } from '../../base-query-format';
import { metaSince } from '../../query-meta';
import type { AliasesQuery, AliasesQueryResult } from './aliases-query-format';

function getAlias(source: NodeId, dfg: DataflowGraph<DataflowGraphVertexInfo, DfEdge>) {
	const alreadyVisited = new Set<NodeId>();
	//search for whether source node is/defines a function?
	let srcIsFunc = false;
	const searchSrcDef = [source];
	while(searchSrcDef.length !== 0) {
		const id = searchSrcDef.pop();
		if(isUndefined(id) || alreadyVisited.has(id)) {
			continue;
		}
		const vertex = dfg.getVertex(id);
		if(DfgVertex.isFunctionDefinition(vertex)) {
			srcIsFunc = true;
			break;
		}
		for(const [neighbor, edge] of dfg.edgesFrom(id)) {
			if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedByOnCall }, edge.types)) {
				searchSrcDef.push(neighbor);
			}
		}
		alreadyVisited.add(id);
	}
	//search for all aliases of source
	alreadyVisited.clear();
	const resultIds = new Set<NodeId>();
	//isResult is used to make sure that we only return nodes that are actual aliases and not just different "mentions" of the source throughout the code
	//there needs to be a DefinedBy/DefinedOnCall edge on the path between the source node and a possible result node for the result node to be a true alias of the source
	const toSearch: { vertex: NodeId; isResult: boolean }[] = [{
		vertex:   source,
		isResult: false
	}];
	while(toSearch.length !== 0) {
		const next = toSearch.pop();
		if(isUndefined(next)) {
			continue;
		}
		const  { vertex, isResult } = next;
		if(alreadyVisited.has(vertex)) {
			continue;
		}
		for(const [neighbor, edge] of dfg.edgesTo(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.Reads }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types) || DfEdge.isOnlyType({ types: EdgeType.DefinedByOnCall }, edge.types)) {
				if((isResult || DfEdge.isOnlyType({ types: EdgeType.DefinedBy }, edge.types)) && !alreadyVisited.has(neighbor)) {
					//edge case: if the possible result node is a function call, but the source doesn't define a function, the possible result node is actually defined
					if(DfgVertex.isFunctionCall(dfg.getVertex(neighbor)) && !srcIsFunc) {
						continue;
					}
					toSearch.push({ vertex: neighbor, isResult: true });
					resultIds.add(neighbor);
				} else {
					toSearch.push({ vertex: neighbor, isResult: next.isResult });
				}
			}
		}
		for(const [neighbor, edge] of dfg.edgesFrom(vertex)) {
			if(DfEdge.isOnlyType({ types: EdgeType.DefinesOnCall }, edge.types)) {
				toSearch.push({ vertex: neighbor, isResult: true });
				resultIds.add(neighbor);
			}
		}
		alreadyVisited.add(vertex);
	}
	return resultIds;
}

/**
 * Executes the given alias queries using the provided analyzer.
 */
export async function executeAliasesQuery({ analyzer }: BasicQueryData, queries: readonly AliasesQuery[]): Promise<AliasesQueryResult> {
	const ast = await analyzer.normalize();
	const idMap = ast.idMap;
	const dataflow = await analyzer.dataflow();
	const dfg = dataflow.graph;
	const start = Date.now();

	const result: ([SlicingCriterion, SourceLocation[]] | [NodeId, NodeId[]])[] = [];
	for(const query of queries) {
		if(isNotUndefined(query.criteria)) {
			for(const criterion of query.criteria) {
				const nodeId = SlicingCriterion.parse(criterion, idMap);
				const aliases = Array.from(getAlias(nodeId, dfg));
				const aliasesLocation = aliases.map(nodeId => {
					return SourceLocation.fromNode(idMap.get(nodeId));
				}).filter(element => isNotUndefined(element));
				result.push([criterion, aliasesLocation]);
			}
		}
		if(isNotUndefined(query.id)) {
			for(const nodeId of query.id) {
				const aliases = Array.from(getAlias(nodeId, dfg));
				result.push([nodeId, aliases]);
			}
		}
	}
	return {
		...metaSince(start),
		result: result
	};
}