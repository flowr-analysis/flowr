import {
	type CfgBasicBlockVertex,
	type CfgMarkerVertex,
	type CfgExpressionVertex,
	CfgVertex,
	type CfgStatementVertex,
	type ControlFlowInformation
} from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexUse,
	type DataflowGraphVertexValue, type DataflowGraphVertexVariableDefinition, VertexType
} from '../dataflow/graph/vertex';
import { type BasicCfgGuidedVisitorConfiguration, BasicCfgGuidedVisitor } from './basic-cfg-guided-visitor';
import { assertUnreachable } from '../util/assert';
import type { DataflowGraph } from '../dataflow/graph/graph';

export interface DataflowCfgGuidedVisitorConfiguration<
	ControlFlow extends ControlFlowInformation = ControlFlowInformation,
	Dfg extends DataflowGraph                  = DataflowGraph
> extends BasicCfgGuidedVisitorConfiguration<ControlFlow> {
	readonly dfg:                  Dfg;
	readonly defaultVisitingType?: 'entry' | 'exit';
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

		if(this.config.defaultVisitingType !== 'exit' || CfgVertex.getEnd(node) === undefined) {
			this.visitDataflowNode(node);
		}
	}

	protected override onExpressionNode(node: CfgExpressionVertex): void {
		super.onExpressionNode(node);

		if(this.config.defaultVisitingType !== 'exit' || CfgVertex.getEnd(node) === undefined) {
			this.visitDataflowNode(node);
		}
	}

	protected override onEndMarkerNode(node: CfgMarkerVertex): void {
		super.onEndMarkerNode(node);

		if(this.config.defaultVisitingType === 'exit') {
			this.visitDataflowNode(node);
		}
	}

	protected visitDataflowNode(node: Exclude<CfgVertex, CfgBasicBlockVertex>): void {
		const dfgVertex = this.getDataflowGraph(CfgVertex.getRootId(node));
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
	protected visitUnknown(_vertex: Exclude<CfgVertex, CfgBasicBlockVertex>): void {
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