import { Writable } from "ts-essentials";
import { DataflowGraphVertexFunctionCall, VertexType } from "../../dataflow/graph/vertex";
import { RNode } from "../../r-bridge/lang-4.x/ast/model/model";
import { RFunctionDefinition } from "../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition";
import { RParameter } from "../../r-bridge/lang-4.x/ast/model/nodes/r-parameter";
import { KnownRoxygenTags } from "../../r-bridge/roxygen2/roxygen-ast";
import { Q } from "../../search/flowr-search-builder";
import { Enrichment, enrichmentContent } from "../../search/search-executor/search-enrichers";
import { isNotUndefined, isUndefined } from "../../util/assert";
import { MergeableRecord } from "../../util/objects";
import { SourceLocation } from "../../util/range";
import { LintingPrettyPrintContext, LintingResult, LintingResultCertainty, LintingRule, LintingRuleCertainty } from "../linter-format";
import { LintingRuleTag } from "../linter-tags";
import { visitCfgInOrder } from "../../control-flow/simple-visitor";
import { RNumber } from "../../r-bridge/lang-4.x/ast/model/nodes/r-number";
import { RNumberValue } from "../../r-bridge/lang-4.x/convert-values";
import { PipelinePerStepMetaInformation } from "../../core/steps/pipeline/pipeline";
import { DataflowInformation } from "../../dataflow/info";
import { ReadonlyFlowrAnalysisProvider } from "../../project/flowr-analyzer";
import { KnownParser } from "../../r-bridge/parser";
import { pMatch } from "../../dataflow/internal/linker";
import { resolveIdToValue } from "../../dataflow/eval/resolve/alias-tracking";
import { valueSetGuard } from "../../dataflow/eval/values/general";
import { DfEdge, EdgeType } from "../../dataflow/graph/edge";
import { NodeId } from "../../r-bridge/lang-4.x/ast/model/processing/node-id";
import { dataflowLogger } from "../../dataflow/logger";
import { getOriginInDfg, OriginType } from "../../dataflow/origin/dfg-get-origin";

export type UnclosedConnectionResult = LintingResult

export type UnclosedConnectionConfig = MergeableRecord;

export type UnclosedConnectionMetadata = MergeableRecord;

//todo: functioninfo array machen
//todo: get from here https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/connections
//first 8 dont automatically open except if open is set 
//todo: eine liste mit offenen verbindungen, (liste nicht set, müssen nicht)
            //open and close functions
            //textConnection
            //pipe 
            //socketConnection?
            //file?
            //url?
            //dbConnect
            //dbDisconnet
const openConnectionFunc = ['open', 'textConnection', 'pipe', 'file', 'close']

/*function mapCloseCalls(data: ReadonlyFlowrAnalysisProvider<KnownParser>){
    const closeCalls = await data.query([{
        "type": "call-context",
        "callName": `^close$`
    }])
    closeCalls.getElements().map(element => {
        const closeCall = data.dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;
    })
    const fCall = 
    
                            //filter out function calls with argument "call." set to false
                            const stopParamMap = {
                                '...':    '...',
                                'call.':  'call.',
                                'domain': 'domain'
                            } as const;
                            const mapping = pMatch(fCall.args, stopParamMap);
                            const mappedToStop = mapping.get('call.') ?? [];
                            for(const argId of mappedToStop) {
                                const res = resolveIdToValue(argId, { graph: dataflow.graph, environment: fCall.environment, ctx: data.inspectContext() });
                                const values = valueSetGuard(res);
                                if(values?.type === 'set' && values.elements.length !== 0){
                                    if(values.elements[0].type === 'logical'){
                                        return values.elements[0].value;
                                    }
                                }
                            }

}*/

export const UNCLOSED_CONNECTION = {
    createSearch: () => Q.fromQuery([{
    "type": "call-context",
    "callName": `^${openConnectionFunc.join('|')}$`
  }])//*/.var('textConnection').filter(VertexType.FunctionCall)
        /*.with(Enrichment.CfgInformation)*/,
    processSearchResult: async (elements, _config, data) => {
        data.query
        const ast = await data.normalize()
        const cfg = await data.controlflow(['remove-dead-code'])
        const dataflow = await data.dataflow();

        //mapCloseCalls(data)
        //todo: schauen ob der close call überhaupt ausgeführt wird
        const calls = elements.getElements()/*todo: testen ob das funktioniert.filter(element => {
            const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}
			return true;
        })*/.map(element => {
            return dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;
        });
        const openCalls = new Set(calls.filter(element => {
            return element.name !== 'close'
        }).map(element => {
            return element.id
        }))
        const closedArg = new Set<NodeId>(calls.
                filter(element => {
                    return element.name === 'close'
                }).flatMap(element => {
                const closeParamMap = {
                    '...':    '...'
                } as const;
                const mapping = pMatch(element.args, closeParamMap);
                const mappedToStop = mapping.get('...');
                if(isUndefined(mappedToStop)){
                    dataflowLogger.warn(`Argument of call with id ${element.id} could not be resolved`);
                    return undefined;
                }//eigentlich ?? []
                for(const argId of mappedToStop) {
                    //new todo: stattdessen 
                    const box = [argId]
                    while(box.length !== 0){
                    const id = box.pop as unknown as NodeId;
                    if(openCalls.has(id)){
                        openCalls.delete(id);
                        break;
                    }
                    const h = dataflow.graph.outgoingEdges(id)
                    if(isUndefined(h)){
                        break;
                    }
                    for (const [toNode, edge] of h){
                    if(edge.types === EdgeType.Reads || edge.types === EdgeType.DefinedBy){
                        box.push(toNode)
                    }}}
                    /*const res = resolveIdToValue(argId, { graph: dataflow.graph, environment: element.environment, ctx: data.inspectContext() });
                    const values = valueSetGuard(res);
                    if(values?.type === 'set' && values.elements.length !== 0){
                        const va = values.elements;
                        if(values.elements[0].type === 'string'){
                            //return values.elements[0].value;
                        }
                    }*/
                }
               return mappedToStop;
            }).filter(element => isNotUndefined(element)))
        const openCallToDefiner = new Map<NodeId, NodeId>()
        for(const [fromNode, edges] of dataflow.graph.edges()){
			for(const [toNode, edge] of edges){
				if(openCalls.has(toNode) && DfEdge.includesType(edge, EdgeType.DefinedBy)){
					openCallToDefiner.set(toNode, fromNode)
				}
			}
		}
        return {
            results:
                elements.getElements()

                    /*.filter(element => {
                        const definer = openCallToDefiner.get(element.node.info.id);
                        return isNotUndefined(definer) && !closedArg.has(definer);
                    })*/
                   .filter(element => {return openCalls.has(element.node.info.id)})
                /*////todo: stattdessen einmal über den graphen gehen und zählen wie oft geclosed und wie oft geopened
                //todo: wir brauchen die variable zu der es zugeordnet wird, diese kommt dann in das closed rein
                    .filter(element => {
                        console.log('element', element)
                        let wasClosed = false; 
	                    visitCfgInOrder(cfg.graph, [element.node.info.id], id => {
                        const ke = ast.idMap.get(id)
                        wasClosed = ke?.lexeme === 'close'
                        if(wasClosed){
                            return true;
                        }});
                        console.log(wasClosed)
                        return true;
                    })*/


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