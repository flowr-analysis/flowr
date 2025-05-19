import type {
	CfgExpressionVertex,
	CfgStatementVertex,
	ControlFlowInformation
} from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	NormalizedAst,
	ParentInformation
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
import type { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RBreak } from '../r-bridge/lang-4.x/ast/model/nodes/r-break';
import type { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import type { RLineDirective } from '../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RNext } from '../r-bridge/lang-4.x/ast/model/nodes/r-next';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';

export interface SyntaxCfgGuidedVisitorConfiguration<
	OtherInfo = NoInfo,
    Cfg extends ControlFlowInformation   = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo> = NormalizedAst<OtherInfo>
> extends BasicCfgGuidedVisitorConfiguration<Cfg> {
	readonly normalizedAst: Ast;
}

/**
 * This visitor extends on the {@link BasicCfgGuidedVisitor} by dispatching visitors based on the AST type of the node.
 *
 * Use {@link BasicCfgGuidedVisitor#start} to start the traversal.
 */
export class SyntaxAwareCfgGuidedVisitor<
	OtherInfo = NoInfo,
    Cfg extends ControlFlowInformation = ControlFlowInformation,
	Ast extends NormalizedAst<OtherInfo> = NormalizedAst<OtherInfo>,
	Config extends SyntaxCfgGuidedVisitorConfiguration<OtherInfo, Cfg, Ast> = SyntaxCfgGuidedVisitorConfiguration<OtherInfo, Cfg, Ast>,
> extends BasicCfgGuidedVisitor<Cfg, Config> {

	/**
	 * Get the normalized AST node for the given id or fail if it does not exist.
	 */
	protected getNormalizedAst(id: NodeId): RNode<OtherInfo & ParentInformation> | undefined {
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


	/**
	 * {@link RAccess}
	 */
	protected visitRAccess(_node: RAccess<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RArgument}
	 */
	protected visitRArgument(_node: RArgument<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RBinaryOp}
	 */
	protected visitRBinaryOp(_node: RBinaryOp<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RExpressionList}
	 */
	protected visitRExpressionList(_node: RExpressionList<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RForLoop}
	 */
	protected visitRForLoop(_node: RForLoop<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RFunctionCall}
	 */
	protected visitRFunctionCall(_node: RFunctionCall<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RFunctionDefinition}
	 */
	protected visitRFunctionDefinition(_node: RFunctionDefinition<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RIfThenElse}
	 */
	protected visitRIfThenElse(_node: RIfThenElse<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RParameter}
	 */
	protected visitRParameter(_node: RParameter<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RPipe}
	 */
	protected visitRPipe(_node: RPipe<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RRepeatLoop}
	 */
	protected visitRRepeatLoop(_node: RRepeatLoop<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RUnaryOp}
	 */
	protected visitRUnaryOp(_node: RUnaryOp<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RWhileLoop}
	 */
	protected visitRWhileLoop(_node: RWhileLoop<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RBreak}
	 */
	protected visitRBreak(_node: RBreak<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RComment}
	 */
	protected visitRComment(_node: RComment<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RLineDirective}
	 */
	protected visitRLineDirective(_node: RLineDirective<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RLogical}
	 */
	protected visitRLogical(_node: RLogical<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RNext}
	 */
	protected visitRNext(_node: RNext<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RNumber}
	 */
	protected visitRNumber(_node: RNumber<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RString}
	 */
	protected visitRString(_node: RString<OtherInfo & ParentInformation>): void {}
	/**
	 * {@link RSymbol}
	 */
	protected visitRSymbol(_node: RSymbol<OtherInfo & ParentInformation>): void {}
}