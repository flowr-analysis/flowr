import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { ControlDependency } from '../info';
import type { DataflowGraph } from '../graph/graph';
import { DfEdge, EdgeType } from '../graph/edge';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { DfgVertex } from '../graph/vertex';
import { BuiltInProcName } from '../environments/built-in-proc-name';

/**
 * Program order of top-level code outside loops and quotes: it runs once, so its definitions are not there yet for the statements before.
 * @helper dataflow
 */
export const ProgramOrder = {
	name: 'ProgramOrder',
	/** The top-level statement holding `id` if the program runs it once, in program order, `undefined` otherwise. */
	runsOnceAt(this: void, id: NodeId, graph: DataflowGraph): RNode<ParentInformation> | undefined {
		return graph.getVertex(id)?.cds?.some(cd => ControlDependency.isIterated(cd, graph.idMap)) ? undefined : ProgramOrder.runsWithin(id, graph);
	},
	/** The top-level statement holding `id` if it is top-level code outside quotes, also within a loop, whose every round ends before the next statement runs, `undefined` otherwise. */
	runsWithin(this: void, id: NodeId, graph: DataflowGraph): RNode<ParentInformation> | undefined {
		const idMap = graph.idMap;
		const node = idMap?.get(id);
		if(idMap === undefined || node === undefined || !graph.isRoot(id) || graph.isQuoted(id)) {
			return undefined;
		}
		return RNode.topLevelStatement(node, idMap);
	},
	/** Whether all of `id` is done before `later` starts: both are top-level code (see {@link ProgramOrder.runsWithin}), `later` in a later statement. */
	runsBefore(this: void, id: NodeId, later: NodeId, graph: DataflowGraph): boolean {
		const at = ProgramOrder.runsWithin(id, graph);
		return at !== undefined && ProgramOrder.runsWithin(later, graph) !== undefined && statementsAfter(later, at, graph) > 0;
	},
	/** How many top-level statements of the same file after `statement` the top-level definition at `definition` is made, `0` for any other. */
	offset(this: void, definition: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): number {
		return graph.isRoot(definition) ? statementsAfter(definition, statement, graph) : 0;
	},
	/** Whether the definition at `definition` is made only after `statement` ran: it sits in a later top-level statement, which holds a nested one too, as the function it is nested in does not exist before. */
	definedLater(this: void, definition: NodeId, statement: RNode<ParentInformation> | undefined, graph: DataflowGraph): boolean {
		return statementsAfter(definition, statement, graph) > 0;
	},
	/**
	 * Whether the definition at `definition` is made only after `id` ran as the body of a function runs: both are directly in that body, the definition in a later statement of it,
	 * and each run of the function has a frame of its own. What a promise or an exit hook defers runs later.
	 */
	boundLaterInBody(this: void, definition: NodeId, id: NodeId, graph: DataflowGraph): boolean {
		const idMap = graph.idMap;
		const fn = idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(id, idMap);
		const body = fn === undefined ? undefined : idMap?.get(fn);
		if(idMap === undefined || !RFunctionDefinition.is(body) || !RExpressionList.is(body.body) || RNode.strictlyEnclosingFunction(definition, idMap) !== fn
			|| graph.isQuoted(id) || graph.getVertex(id)?.cds?.some(cd => cd.byPromise)) {
			return false;
		}
		const statementOf = (node: RNode<ParentInformation> | undefined): RNode<ParentInformation> | undefined => {
			for(; node !== undefined && node.info.parent !== body.body.info.id; node = node.info.parent === undefined ? undefined : idMap.get(node.info.parent)) {
				if(DfgVertex.hasOrigin(graph.getVertex(node.info.id), BuiltInProcName.RegisterHook)) {
					return undefined;
				}
			}
			return node;
		};
		const at = statementOf(idMap.get(id));
		const made = statementOf(idMap.get(definition));
		return at !== undefined && made !== undefined && made.info.index > at.info.index;
	},
	/** For code the program runs once after `statement`, which surely makes the definition `write`: what that code reads no longer sees the definitions made before `statement`. */
	replaceEarlier(this: void, write: NodeId, statement: RNode<ParentInformation>, graph: DataflowGraph, readsEarlier: boolean): void {
		const before = (id: NodeId) => ProgramOrder.runsOnceAt(id, graph) !== undefined && ProgramOrder.offset(id, statement, graph) < 0;
		for(const [reader, edge] of graph.edgesTo(write)) {
			if(!DfEdge.includesType(edge, EdgeType.Reads) || ProgramOrder.runsOnceAt(reader, graph) === undefined || ProgramOrder.offset(reader, statement, graph) <= 0) {
				continue;
			}
			for(const [earlier, out] of graph.edgesFrom(reader)) {
				if(earlier !== write && DfEdge.includesType(out, EdgeType.Reads) && before(earlier)) {
					graph.removeEdgeType(reader, earlier, EdgeType.Reads);
					if(readsEarlier) {
						graph.addEdge(write, earlier, EdgeType.Reads);
					}
				}
			}
		}
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
