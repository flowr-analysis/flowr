import type { CfgExpressionVertex, CfgStatementVertex, ControlFlowInformation } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

import type {
	DataflowGraphVertexArgument, DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition,
	DataflowGraphVertexUse,
	DataflowGraphVertexValue, DataflowGraphVertexVariableDefinition } from '../dataflow/graph/vertex';
import { VertexType
} from '../dataflow/graph/vertex';
import type { BasicCfgGuidedVisitorConfiguration } from './basic-cfg-guided-visitor';
import { BasicCfgGuidedVisitor } from './basic-cfg-guided-visitor';
import { assertUnreachable } from '../util/assert';
import type { DataflowGraph } from '../dataflow/graph/graph';

export interface DataflowCfgGuidedVisitorConfiguration<
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Dfg extends DataflowGraph                  = DataflowGraph
> extends BasicCfgGuidedVisitorConfiguration<ControlFlow> {
	readonly dfg: Dfg;
}

/**
 * This visitor extends on the {@link BasicCfgGuidedVisitor} by dispatching visitors based on the dataflow graph.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class DataflowAwareCfgGuidedVisitor<
    ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Dfg extends DataflowGraph                  = DataflowGraph,
	Config extends DataflowCfgGuidedVisitorConfiguration<ControlFlow, Dfg> = DataflowCfgGuidedVisitorConfiguration<ControlFlow, Dfg>
> extends BasicCfgGuidedVisitor<ControlFlow, Config> {

	/**
	 * Get the dataflow graph vertex for the given id
	 */
	protected getDataflowGraph(id: NodeId): DataflowGraphVertexArgument | undefined {
		return this.config.dfg.getVertex(id);
	}


	protected override onStatementNode(node: CfgStatementVertex): void {
		super.onStatementNode(node);
		this.onExprOrStmtNode(node);
	}

	protected override onExpressionNode(node: CfgExpressionVertex): void {
		super.onExpressionNode(node);
		this.onExprOrStmtNode(node);
	}

	private onExprOrStmtNode(node: CfgStatementVertex | CfgExpressionVertex): void {
		const dfgVertex = this.getDataflowGraph(node.id);
		if(!dfgVertex) {
			this.visitUnknown(node);
			return;
		}

		const tag = dfgVertex.tag;
		switch(tag) {
			case VertexType.Use:
				this.visitVariableUse(dfgVertex);
				break;
			case VertexType.VariableDefinition:
				this.visitVariableDefinition(dfgVertex);
				break;
			case VertexType.FunctionDefinition:
				this.visitFunctionDefinition(dfgVertex);
				break;
			case VertexType.FunctionCall:
				this.visitFunctionCall(dfgVertex);
				break;
			case VertexType.Value:
				this.visitValue(dfgVertex);
				break;
			default:
				assertUnreachable(tag);
		}
	}

	/**
	 * called for every cfg vertex that has no corresponding dataflow vertex.
	 */
	protected visitUnknown(_vertex: CfgStatementVertex | CfgExpressionVertex): void {
	}

	protected visitValue(_val: DataflowGraphVertexValue): void {
	}

	protected visitVariableUse(_use: DataflowGraphVertexUse): void {
	}

	protected visitVariableDefinition(_def: DataflowGraphVertexVariableDefinition): void {
	}

	protected visitFunctionDefinition(_def: DataflowGraphVertexFunctionDefinition): void {
	}

	protected visitFunctionCall(_call: DataflowGraphVertexFunctionCall): void {
	}

}