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
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { OpenConnectionFunctions } from '../../queries/catalog/dependencies-query/function-info/open-connection-functions';
import { CloseConnectionFunctions } from '../../queries/catalog/dependencies-query/function-info/close-connection-functions';
import type { CallContextQueryResult, CallContextQuerySubKindResult } from '../../queries/catalog/call-context-query/call-context-query-format';

export type UnclosedConnectionResult = LintingResult;

export type UnclosedConnectionConfig = MergeableRecord;

export type UnclosedConnectionMetadata = MergeableRecord;


export const UNCLOSED_CONNECTION = {
	createSearch: () => Q.fromQuery([ {
		'type':     'call-context',
		'callName': `^${OpenConnectionFunctions.map(element => {
			return element.name;
		}).join('|')}$`,
		'kind':    'connection',
		'subkind': 'openConnection'
	},
	{
		'type':     'call-context',
		'callName': `^${CloseConnectionFunctions.map(element => {
			return element.name;
		}).join('|')}$`,
		'kind':    'connection',
		'subkind': 'closeConnection'
	}]),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const dependencies = (((elements.enrichmentContent(Enrichment.QueryData).queries as { 'call-context': CallContextQueryResult })['call-context'].kinds) as { connection: { subkinds: { openConnection: CallContextQuerySubKindResult[], closeConnection: CallContextQuerySubKindResult[] } } }).connection.subkinds;
		//Map: [NodeId of open-call, NodeId of the variable that it is defined by]
		const builtInOpen = dependencies.openConnection.filter(element => {
			const origins = getOriginInDfg(dataflow.graph, element.id);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}
			return true;
		});
		const openedByDefiningVar: Map<NodeId, NodeId> = builtInOpen.map(element => {
			const h = dataflow.graph.ingoingEdges(element.id);
			//case: open() instead of a <- open()
			if(isUndefined(h)){
				return undefined;
			}
			for(const [toNode, edge] of h){
				if(edge.types === EdgeType.DefinedBy){
					return [element.id, toNode];
				}
			}
		}).filter(element => {
			return isNotUndefined(element);
		}).reduce((map, [definer, openNode]) => {
			map.set(definer, openNode);
			return map;
		}, new Map<NodeId, NodeId>());
		const openCalls = new Set(builtInOpen.map(element => {
			return element.id;
		}));
		//Map: [ NodeId of defining symbol that it closes, NodeId of close-call]
		const closedArg = dependencies.closeConnection.filter(element => {
			const origins = getOriginInDfg(dataflow.graph, element.id);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}
			return true;
		}).map(element => {
			return dataflow.graph.getVertex(element.id) as DataflowGraphVertexFunctionCall;
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
			//search for an openCall that might get closed by this call using the defining variable of the openCall
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
			}, new Map<NodeId, NodeId>());

		return {
			results:
				elements.getElements()
					//filter out close-calls
					.filter(element => {
						return openCalls.has(element.node.info.id);
					})
					.filter(element => {
						if(openedByDefiningVar.has(element.node.info.id)){
							const ident = openedByDefiningVar.get(element.node.info.id);
							//closed by one call
							if(isNotUndefined(ident) && closedArg.has(ident)){
								const closeCall = closedArg.get(ident) as NodeId;
								const closeCallDependencies = new Set(dataflow.graph.getVertex(closeCall)?.cds);
								const openCallDependencies = new Set(dataflow.graph.getVertex(element.node.info.id)?.cds);
								//both or neither call is executed
								if(openCallDependencies.isSubsetOf(closeCallDependencies) && closeCallDependencies.isSubsetOf(openCallDependencies)){
									return false;
								} else {
									return true;
								}
							} else {
								return true;
							}
						//can't be closed because of form: open(), instead of: a <- open()
						} else {
							return true;
						}
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
		description:   'Flags calls which open a connection that is (not necessarily) closed.',
		defaultConfig: {}
	}
} as const satisfies LintingRule<UnclosedConnectionResult, UnclosedConnectionMetadata, UnclosedConnectionConfig>;