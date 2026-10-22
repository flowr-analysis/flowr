import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { ControlDependency } from '../info';
import type { DataflowGraph } from '../graph/graph';

/**
 * Program order of top-level code outside loops and quotes: it runs once, so its definitions are not there yet for the statements before.
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
		return graph.isRoot(definition) ? statementsAfter(definition, statement, graph) : 0;
	},
	/**
	 * Whether the definition at `definition` is made only after `statement` ran: it sits in a later top-level statement,
	 * which holds a nested one too, as the function it is nested in does not exist before.
	 */
	definedLater(this: void, definition: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): boolean {
		return statementsAfter(definition, statement, graph) > 0;
	}
} as const;

function statementsAfter(id: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): number {
	const idMap = graph.idMap;
	const node = idMap?.get(id);
	if(idMap === undefined || statement === undefined || node === undefined) {
		return 0;
	}
	const other = RNode.topLevelStatement(node, idMap);
	if(other.info.parent === statement.info.parent) {
		return other.info.index - statement.info.index;
	}
	/* in another file, a statement is after one only if it starts once that one is done, and before only if it is done before that one starts */
	const [start, end] = graph.statementOrder?.get(other.info.id) ?? [];
	const [from, to] = graph.statementOrder?.get(statement.info.id) ?? [];
	return start === undefined || end === undefined || from === undefined || to === undefined ? 0 : start >= to ? 1 : end <= from ? -1 : 0;
}
