import type { ControlFlowInformation } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	NormalizedAst
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { SyntaxCfgGuidedVisitorConfiguration } from './syntax-cfg-guided-visitor';
import { SyntaxGuidedCfgGuidedVisitor } from './syntax-cfg-guided-visitor';
import type { DataflowGraphVertexArgument } from '../dataflow/graph/vertex';

export interface DataflowCfgGuidedVisitorConfiguration<
	Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Dfg extends DataflowInformation    = DataflowInformation
> extends SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast> {
	readonly dataflow: Dfg;
}

/**
 * This visitor extends on the {@link SyntaxGuidedCfgGuidedVisitor} by dispatching visitors based on the AST type of the node.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class DataflowGuidedCfgGuidedVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Dfg extends DataflowInformation    = DataflowInformation,
	Config extends DataflowCfgGuidedVisitorConfiguration<Cfg, Ast, Dfg> = DataflowCfgGuidedVisitorConfiguration<Cfg, Ast, Dfg>
> extends SyntaxGuidedCfgGuidedVisitor<Cfg, Ast, Config> {

	/**
	 * Get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getDataflowGraph(id: NodeId): DataflowGraphVertexArgument | undefined {
		return this.config.dataflow.graph.getVertex(id);
	}

	// TODO: check whether functions are overloaded, resolve calls, provide origin, ...
}