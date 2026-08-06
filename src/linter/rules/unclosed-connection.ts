import type { Writable } from 'ts-essentials';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { Q } from '../../search/flowr-search-builder';
import { isNotUndefined, isUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { pMatch } from '../../dataflow/internal/linker';
import { EdgeType } from '../../dataflow/graph/edge';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../dataflow/logger';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import type { DependencyInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';

export type UnclosedConnectionResult = LintingResult;

export type UnclosedConnectionConfig = MergeableRecord;

export type UnclosedConnectionMetadata = MergeableRecord;




export const UNCLOSED_CONNECTION = {
	createSearch:        () => Q.fromQuery([ { type: 'dependencies', 'enabledCategories': ['openConnection', 'closeConnection'] }]),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const dependencies = (elements.enrichmentContent(Enrichment.QueryData).queries as { dependencies: { openConnection: DependencyInfo[], closeConnection: DependencyInfo[] } }).dependencies;
		//Map: [NodeId of open-call, NodeId of the variable that it defines]
		const openedByDefiningVar: Map<NodeId, NodeId> = dependencies.openConnection/*.filter(element => {
			/*const origins = getOriginInDfg(dataflow.graph, element.nodeId);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}*/
			/*return true;
		})*/.map(element => {
				const h = dataflow.graph.ingoingEdges(element.nodeId);
				if(isUndefined(h)){
					return undefined;
				}
				for(const [toNode, edge] of h){
					if(edge.types === EdgeType.DefinedBy){
						return [element.nodeId, toNode];
					}
				}
			}).filter(element => {
				return isNotUndefined(element);
			}).reduce((map, [definer, openNode]) => {
				map.set(definer, openNode);
				return map;
			}, new Map<NodeId, NodeId>());
		//Map: [ NodeId of defining symbol that it closes, NodeId of close-call]
		const closedArg = dependencies.closeConnection/*.filter(element => {
			const origins = getOriginInDfg(dataflow.graph, element.nodeId);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}
			return true;
		})*/.map(element => {
				console.log('incoming ids from element', element.nodeId);
				return dataflow.graph.getVertex(element.nodeId) as DataflowGraphVertexFunctionCall;
			}).map(element => {
				const closeParamMap = {
					'...': '...'
				} as const;
				const mapping = pMatch(element.args, closeParamMap);
				const mappedToStop = mapping.get('...');
				if(isUndefined(mappedToStop) || mappedToStop.length === 0 || isUndefined(mappedToStop[0])){
					dataflowLogger.warn(`Argument of call with id ${element.id} could not be resolved`);
					return undefined;
				}
				const oldArgId = mappedToStop[0];
				const box = [oldArgId];
				while(box.length > 0){
					const id = box.pop() as NodeId;
					const h = dataflow.graph.outgoingEdges(id);
					if(isUndefined(h)){
						break;
					}
					for(const [toNode, edge] of h){
						if(edge.types === EdgeType.Reads || edge.types === EdgeType.DefinedBy){
							box.push(toNode);
						}
						if(edge.types === EdgeType.DefinedBy && openedByDefiningVar.has(toNode)){
							return [id, element.id];
						}
					}
				}
				return undefined;
			}).filter(element => {
				return isNotUndefined(element);
			})
			.reduce((map, [node, arg]) => {
				map.set(node, arg);
				return map;
			}, new Map());

		return {
			results:
				elements.getElements()
					.filter(element => {
						if(openedByDefiningVar.has(element.node.info.id)){
							const ident = openedByDefiningVar.get(element.node.info.id);
							if(closedArg.has(ident)){
								return false;
								/////////
							/*const closeEdges = dataflow.graph.outgoingEdges(closedArg.get(ident))
							if(isUndefined(closeEdges)){
								return false;
							}
								const closeSet = closeEdges.entries().reduce((set, [node, edge]) => {
									if(edge.types === EdgeType.NonStandardEvaluation){
										set.add(node)
									}
									return set;
								}, new Set())

							const openEdges = dataflow.graph.outgoingEdges(closedArg.get(element.node.info.id))
							const openSet = openEdges?.entries().reduce((set, [node, edge]) => {
									if(edge.types === EdgeType.NonStandardEvaluation){
										set.add(node)
									}
									return set;
								}, new Set()) ?? new Set()
							if(openSet.isSubsetOf(closeSet) && closeSet.isSubsetOf(openSet)){
								return false;
							} else {
								return true;
							}*/
							//////////
							} else {
								return true;
							}
						}
						return false;
					})
					.map(element => ({
						certainty:  LintingResultCertainty.Uncertain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node)
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<UnclosedConnectionResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Open connection at ${SourceLocation.format(result.loc)} might not get closed.`,
		[LintingPrettyPrintContext.Full]:  result => `Open connection at ${SourceLocation.format(result.loc)} might not get closed.`
	},
	info: {
		name:          'Unclosed Connection',
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   '',
		defaultConfig: {}
	}
} as const satisfies LintingRule<UnclosedConnectionResult, UnclosedConnectionMetadata, UnclosedConnectionConfig>;