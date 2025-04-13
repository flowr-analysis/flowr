import type {
	CfgExpressionVertex,
	CfgStatementVertex,
	ControlFlowInformation
} from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { BasicCfgGuidedVisitorConfiguration } from './basic-cfg-guided-visitor';
import { BasicCfgGuidedVisitor } from './basic-cfg-guided-visitor';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';

export interface SyntaxCfgGuidedVisitorConfiguration<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst
> extends BasicCfgGuidedVisitorConfiguration<Cfg> {
	readonly normalizedAst: Ast;
}

type VisitOfType<T extends RType, Info = NoInfo> = (node: Extract<RNode<Info>, { type: T }>) => void;

/** explicitly excludes types that are not visitable */
export type VisitableRType = RType;

/**
 * Describes the visit functions for each node type.
 */
export type NormalizedAstFold<Info = NoInfo> = {
	[K in VisitableRType as `visit${Capitalize<K>}`]: VisitOfType<K, Info>;
}

/**
 * This visitor extends on the {@link BasicCfgGuidedVisitor} by dispatching visitors based on the AST type of the node.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class SyntaxGuidedCfgGuidedVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Config extends SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast> = SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast>
> extends BasicCfgGuidedVisitor<Cfg, Config> implements NormalizedAstFold<ParentInformation> {

	/**
	 * Get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId): RNodeWithParent | undefined {
		return this.config.normalizedAst.idMap.get(id);
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
		const astVertex = this.getNormalizedAst(node.id);
		if(!astVertex) {
			return;
		}

		switch(astVertex.type) {
			case RType.Access:
				this.visitRAccess(astVertex as RAccess<ParentInformation>);
		}
	}

	public visitRAccess(_node: RAccess<ParentInformation>): void {
		// TODO: collect until...
	}

	public visitRArgument(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRBinaryOp(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRExpressionList(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRForLoop(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRFunctionCall(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRFunctionDefinition(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRIfThenElse(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRParameter(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRPipe(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRRepeatLoop(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRUnaryOp(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRWhileLoop(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRBreak(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRComment(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRLineDirective(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRLogical(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRNext(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRNumber(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRString(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRSymbol(_node: RNodeWithParent): void {
		// TODO: collect until...
	}
	public visitRDelimiter(_node: RNodeWithParent): void {
		// TODO: collect until...
	}

}