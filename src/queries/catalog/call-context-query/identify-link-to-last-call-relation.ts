import type {NodeId} from "../../../r-bridge/lang-4.x/ast/model/processing/node-id";
import type {ControlFlowGraph} from "../../../util/cfg/cfg";
import type {DataflowGraph} from "../../../dataflow/graph/graph";
import {visitInReverseOrder} from "../../../util/cfg/visitor";
import {VertexType} from "../../../dataflow/graph/vertex";
import {edgeIncludesType, EdgeType} from "../../../dataflow/graph/edge";

export function identifyLinkToLastCallRelation(from: NodeId, cfg: ControlFlowGraph, graph: DataflowGraph, linkTo: RegExp): NodeId[] {
    const found: NodeId[] = [];
    visitInReverseOrder(cfg, from, node => {
        /* we ignore the start id as it cannot be the last call */
        if (node === from) {
            return;
        }
        const vertex = graph.get(node);
        if (vertex === undefined || vertex[0].tag !== VertexType.FunctionCall) {
            return;
        }
        if (linkTo.test(vertex[0].name)) {
            // if we have any outgoing calls edges skip because then we are no longer a builtin resolve
            if([...vertex[1].values()].some(e => edgeIncludesType(EdgeType.Calls, e.types))) {
                return true
            }
            found.push(node);
            return true;
        }
    });
    return found;
}
