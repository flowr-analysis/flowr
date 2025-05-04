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
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { assertUnreachable } from '../util/assert';
import type { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';

export interface SyntaxCfgGuidedVisitorConfiguration<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst
> extends BasicCfgGuidedVisitorConfiguration<Cfg> {
	readonly normalizedAst: Ast;
}

/**
 * This visitor extends on the {@link BasicCfgGuidedVisitor} by dispatching visitors based on the AST type of the node.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class SyntaxAwareCfgGuidedVisitor<
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst          = NormalizedAst,
	Config extends SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast> = SyntaxCfgGuidedVisitorConfiguration<Cfg, Ast>
> extends BasicCfgGuidedVisitor<Cfg, Config> {

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

		const type = astVertex.type;
		switch(type) {
			case RType.Access:
				return this.visitRAccess(astVertex);
			case RType.Argument:
				return this.visitRArgument(astVertex);
			case RType.BinaryOp:
				return this.visitRBinaryOp(astVertex);
			case RType.ExpressionList:
				return this.visitRExpressionList(astVertex);
			case RType.ForLoop:
				return this.visitRForLoop(astVertex);
			case RType.FunctionCall:
				return this.visitRFunctionCall(astVertex);
			case RType.FunctionDefinition:
				return this.visitRFunctionDefinition(astVertex);
			case RType.IfThenElse:
				return this.visitRIfThenElse(astVertex);
			case RType.Parameter:
				return this.visitRParameter(astVertex);
			case RType.Pipe:
				return this.visitRPipe(astVertex);
			case RType.RepeatLoop:
				return this.visitRRepeatLoop(astVertex);
			case RType.UnaryOp:
				return this.visitRUnaryOp(astVertex);
			case RType.WhileLoop:
				return this.visitRWhileLoop(astVertex);
			case RType.Break:
				return this.visitRBreak(astVertex);
			case RType.Comment:
				return this.visitRComment(astVertex);
			case RType.LineDirective:
				return this.visitRLineDirective(astVertex);
			case RType.Logical:
				return this.visitRLogical(astVertex);
			case RType.Next:
				return this.visitRNext(astVertex);
			case RType.Number:
				return this.visitRNumber(astVertex);
			case RType.String:
				return this.visitRString(astVertex);
			case RType.Symbol:
				return this.visitRSymbol(astVertex);
			default:
				assertUnreachable(type);
		}
	}

	protected visitRAccess(_node: RAccess<ParentInformation>): void {
	}
	protected visitRArgument(_node: RArgument<ParentInformation>): void {
	}
	protected visitRBinaryOp(_node: RBinaryOp<ParentInformation>): void {
	}
	protected visitRExpressionList(_node: RExpressionList<ParentInformation>): void {
	}
	protected visitRForLoop(_node: RForLoop<ParentInformation>): void {
	}
	protected visitRFunctionCall(_node: RFunctionCall<ParentInformation>): void {
	}
	protected visitRFunctionDefinition(_node: RFunctionDefinition<ParentInformation>): void {
	}
	protected visitRIfThenElse(_node: RIfThenElse<ParentInformation>): void {
	}
	protected visitRParameter(_node: RParameter<ParentInformation>): void {
	}
	protected visitRPipe(_node: RPipe<ParentInformation>): void {
	}
	protected visitRRepeatLoop(_node: RRepeatLoop<ParentInformation>): void {
	}
	protected visitRUnaryOp(_node: RNodeWithParent): void {
	}
	protected visitRWhileLoop(_node: RNodeWithParent): void {
	}
	protected visitRBreak(_node: RNodeWithParent): void {
	}
	protected visitRComment(_node: RNodeWithParent): void {
	}
	protected visitRLineDirective(_node: RNodeWithParent): void {
	}
	protected visitRLogical(_node: RNodeWithParent): void {
	}
	protected visitRNext(_node: RNodeWithParent): void {
	}
	protected visitRNumber(_node: RNodeWithParent): void {
	}
	protected visitRString(_node: RNodeWithParent): void {
	}
	protected visitRSymbol(_node: RNodeWithParent): void {
	}
}