import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { ControlDependency } from '../info';
import type { DataflowGraph } from '../graph/graph';

/**
 * Where code runs in the order the program is written, for the part of a program that runs straight through:
 * what the dataflow graph places at the top level (outside of any function), under no loop and not within
 * code handed on unevaluated runs once, so a definition one of these makes is not there yet for the ones before.
 * @helper dataflow
 * @example
 * ```r
 * f <- function() y
 * f()      # runs once, before `y` is defined below
 * y <- 1
 * ```
 */
export const ProgramOrder = {
	name: 'ProgramOrder',
	/** The top-level statement holding `id` if the program runs it once, in program order, `undefined` otherwise. */
	runsOnceAt(this: void, id: NodeId, graph: DataflowGraph): RNode<ParentInformation> | undefined {
		const idMap = graph.idMap;
		const node = idMap?.get(id);
		if(idMap === undefined || node === undefined || !graph.isRoot(id)
			|| graph.getVertex(id)?.cds?.some(cd => ControlDependency.isIterated(cd, idMap)) || graph.isQuoted(id)) {
			return undefined;
		}
		return RNode.topLevelStatement(node, idMap);
	},
	/** How many top-level statements of the same file after `statement` the top-level definition at `definition` is made, `0` for any other. */
	offset(this: void, definition: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): number {
		const idMap = graph.idMap;
		const node = idMap?.get(definition);
		if(idMap === undefined || statement === undefined || node === undefined || !graph.isRoot(definition)) {
			return 0;
		}
		const other = RNode.topLevelStatement(node, idMap);
		return other.info.parent === statement.info.parent ? other.info.index - statement.info.index : 0;
	},
	/** Whether the definition at `definition` is made only after `statement` ran, see {@link ProgramOrder.offset}. */
	definedLater(this: void, definition: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): boolean {
		return ProgramOrder.offset(definition, statement, graph) > 0;
	}
} as const;
