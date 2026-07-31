import { Writable } from "ts-essentials";
import { DataflowGraphVertexFunctionCall } from "../../dataflow/graph/vertex";
import { Q } from "../../search/flowr-search-builder";
import { isNotUndefined, isUndefined } from "../../util/assert";
import { MergeableRecord } from "../../util/objects";
import { SourceLocation } from "../../util/range";
import { LintingPrettyPrintContext, LintingResult, LintingResultCertainty, LintingRule, LintingRuleCertainty } from "../linter-format";
import { LintingRuleTag } from "../linter-tags";
import { pMatch } from "../../dataflow/internal/linker";
import { EdgeType } from "../../dataflow/graph/edge";
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

export const UNCLOSED_CONNECTION = {
    createSearch: () => Q.fromQuery([{
    "type": "call-context",
    "callName": `^${openConnectionFunc.join('|')}$`
  }]),
    processSearchResult: async (elements, _config, data) => {
        const dataflow = await data.dataflow();
        const calls = elements.getElements()/*todo: testen ob das funktioniert*/.filter(element => {
            const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
			if(isNotUndefined(origins)) {
				const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
				if(!builtIn){
					return false;
				}
			}
			return true;
        }).map(element => {
            console.log('incoming ids from element', element.node.info.id)
            return dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;
        });
        const openCalls = new Set(calls.filter(element => {
            return element.name !== 'close'
        }).map(element => {
            console.log('ids of element', element.id)
            return element.id
        }))
        const closedArg = calls.
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
                }
               return mappedToStop;
            }).filter(element => { return isNotUndefined(element) });
        for(const argId of closedArg){
            const box = [argId]
            while(box.length !== 0){
                const id = box.pop() as unknown as NodeId;
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
                    }
                }
            }
        }
        return {
            results:
                elements.getElements()
                   .filter(element => {return openCalls.has(element.node.info.id)})
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