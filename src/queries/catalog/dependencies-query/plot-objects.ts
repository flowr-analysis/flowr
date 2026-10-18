import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { EdgeType } from '../../../dataflow/graph/edge';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { GgPlotImplicitAddons, PlotObjectCreate } from '../../../dataflow/environments/default-builtin-config';

/** the name the call goes by, with its package when it has one */
export function callIdentifierOf(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation): Identifier | undefined {
	const vertex = dataflow.graph.getVertex(node.info.id);
	return DfgVertex.isFunctionCall(vertex)
		? Dataflow.qualify(node.info.id, dataflow.graph, false) ?? vertex.name : undefined;
}

const GgPlotComponents: ReadonlySet<string> = new Set(GgPlotImplicitAddons);

/**
 * Whether the value is a plot, which printing draws rather than writes: a call returning one, a `+` chain adding
 * to one (as ggplot builds them), or a variable bound to either.
 */
export function isPlot(node: RNode<ParentInformation> | undefined, dataflow: DataflowInformation, seen = new Set<NodeId>()): boolean {
	if(node === undefined || seen.has(node.info.id)) {
		return false;
	}
	seen.add(node.info.id);
	switch(node.type) {
		case RType.FunctionCall:
			return isPlotCall(node, dataflow, PlotObjectCreate);
		case RType.BinaryOp:
			return node.operator === '+' && [node.lhs, node.rhs].some(o => isPlot(o, dataflow, seen) || isPlotCall(o, dataflow, GgPlotComponents));
		case RType.Symbol:
			return Dataflow.targetsOf(dataflow.graph, node.info.id, EdgeType.Reads).some(def =>
				Dataflow.targetsOf(dataflow.graph, def, EdgeType.DefinedBy).some(value => isPlot(dataflow.graph.idMap?.get(value), dataflow, seen)));
		default:
			return false;
	}
}

/** whether the node calls one of the given graphics functions */
function isPlotCall(node: RNode<ParentInformation>, dataflow: DataflowInformation, among: ReadonlySet<string>): boolean {
	const name = RFunctionCall.is(node) ? callIdentifierOf(node, dataflow) : undefined;
	return name !== undefined && among.has(Identifier.getName(name))
		&& FunctionSemantics.call.props.hasAny(queryFnProps(name, { environment: dataflow.environment }), [SemanticCallTag.Graphics]);
}
