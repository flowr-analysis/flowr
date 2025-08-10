import type { DataflowGraph } from '../dataflow/graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowInformation } from './control-flow-graph';


/**
 * Checks wheter a loop only loops once 
 * 
 * 
 * 
 * @param loop        - nodeid of the loop to analyse
 * @param dataflow    - dataflow graph
 * @param controlflow - controlflow graph
 * @returns true if the given loop only iterates once
 */
export function onlyLoopsOnce(loop: NodeId, dataflow: DataflowGraph, controlflow: ControlFlowInformation): boolean {
	return false;
}