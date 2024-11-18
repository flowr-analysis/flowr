import { NoInfo, RNode } from "../r-bridge/lang-4.x/ast/model/model";
import { RAccess } from "../r-bridge/lang-4.x/ast/model/nodes/r-access";
import { RArgument } from "../r-bridge/lang-4.x/ast/model/nodes/r-argument";
import { RBinaryOp } from "../r-bridge/lang-4.x/ast/model/nodes/r-binary-op";
import { RBreak } from "../r-bridge/lang-4.x/ast/model/nodes/r-break";
import { RComment } from "../r-bridge/lang-4.x/ast/model/nodes/r-comment";
import { RExpressionList } from "../r-bridge/lang-4.x/ast/model/nodes/r-expression-list";
import { RForLoop } from "../r-bridge/lang-4.x/ast/model/nodes/r-for-loop";
import { EmptyArgument, RFunctionCall } from "../r-bridge/lang-4.x/ast/model/nodes/r-function-call";
import { RFunctionDefinition } from "../r-bridge/lang-4.x/ast/model/nodes/r-function-definition";
import { RIfThenElse } from "../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else";
import { RLineDirective } from "../r-bridge/lang-4.x/ast/model/nodes/r-line-directive";
import { RLogical } from "../r-bridge/lang-4.x/ast/model/nodes/r-logical";
import { RNext } from "../r-bridge/lang-4.x/ast/model/nodes/r-next";
import { RNumber } from "../r-bridge/lang-4.x/ast/model/nodes/r-number";
import { RParameter } from "../r-bridge/lang-4.x/ast/model/nodes/r-parameter";
import { RPipe } from "../r-bridge/lang-4.x/ast/model/nodes/r-pipe";
import { RRepeatLoop } from "../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop";
import { RString } from "../r-bridge/lang-4.x/ast/model/nodes/r-string";
import { RSymbol } from "../r-bridge/lang-4.x/ast/model/nodes/r-symbol";
import { RUnaryOp } from "../r-bridge/lang-4.x/ast/model/nodes/r-unary-op";
import { RWhileLoop } from "../r-bridge/lang-4.x/ast/model/nodes/r-while-loop";
import { RType } from "../r-bridge/lang-4.x/ast/model/type";
import { assertUnreachable } from "../util/assert";

export interface Visitor<Info = NoInfo> {
    visitNumber(num: RNumber<Info>): void;
	visitString(str: RString<Info>): void;
	visitLogical(logical: RLogical<Info>): void;
	visitSymbol(symbol: RSymbol<Info>): void;
	visitAccess(node: RAccess<Info>): void;
	visitBinaryOp(op: RBinaryOp<Info>): void;
	visitPipe(op: RPipe<Info>): void;
	visitUnaryOp(op: RUnaryOp<Info>): void;
    visitFor(loop: RForLoop<Info>): void;
	visitWhile(loop: RWhileLoop<Info>): void;
	visitRepeat(loop: RRepeatLoop<Info>): void;
	visitNext(next: RNext<Info>): void;
	visitBreak(next: RBreak<Info>): void;
	visitComment(comment: RComment<Info>): void;
	visitLineDirective(comment: RLineDirective<Info>): void;
	visitIfThenElse(ifThenExpr: RIfThenElse<Info>): void;
	visitExprList(exprList: RExpressionList<Info>): void;
	visitFunctionDefinition(definition: RFunctionDefinition<Info>): void;
	visitFunctionCall(call: RFunctionCall<Info>): void;
	visitArgument(argument: RArgument<Info>): void;
	visitParameter(parameter: RParameter<Info>): void;
}

class NormalizedAstVisitor<Info = NoInfo> {
	private readonly root: RNode<Info>;

    constructor(root: RNode<Info>) {
        this.root = root;
    }

    accept(v: Visitor<Info>): void {
        this.visit(this.root, v);
    }

    private visit(nodes: RNode<Info> | readonly (RNode<Info> | null | undefined | typeof EmptyArgument)[] | undefined | null, v: Visitor<Info>): void {
        if(Array.isArray(nodes)) {
			const n = nodes as readonly (RNode<Info> | null | undefined | typeof EmptyArgument)[];
			for(const node of n) {
				if(node && node !== EmptyArgument) {
					this.visitSingle(node, v);
				}
			}
		} else if(nodes) {
			this.visitSingle(nodes as RNode<Info>, v);
		}
    }

    private visitSingle(node: RNode<Info>, v: Visitor<Info>): void {
        /* let the type system know that the type does not change */
        const type = node.type;
        switch(type) {
            case RType.FunctionCall:
                v.visitFunctionCall(node)
                this.visitSingle(node.named ? node.functionName : node.calledFunction, v, v);
                this.visit(node.arguments, v);
                break;
            case RType.FunctionDefinition:
                v.visitFunctionDefinition(node);
                this.visit(node.parameters, v);
                this.visitSingle(node.body, v);
                break;
            case RType.ExpressionList:
                v.visitExprList(node);
                this.visit(node.grouping, v);
                this.visit(node.children, v);
                break;
            case RType.ForLoop:
                v.visitFor(node);
                this.visitSingle(node.variable, v);
                this.visitSingle(node.vector, v);
                this.visitSingle(node.body, v);
                break;
            case RType.WhileLoop:
                v.visitWhile(node);
                this.visitSingle(node.condition, v);
                this.visitSingle(node.body, v);
                break;
            case RType.RepeatLoop:
                v.visitRepeat(node);
                this.visitSingle(node.body, v);
                break;
            case RType.IfThenElse:
                v.visitIfThenElse(node);
                this.visitSingle(node.condition, v);
                this.visitSingle(node.then, v);
                this.visit(node.otherwise, v);
                break;
            case RType.BinaryOp:
                v.visitBinaryOp(node);
                this.visitSingle(node.lhs, v);
                this.visitSingle(node.rhs, v);
                break;
            case RType.Pipe:
                v.visitPipe(node);
                this.visitSingle(node.lhs, v);
                this.visitSingle(node.rhs, v);
                break;
            case RType.UnaryOp:
                v.visitUnaryOp(node);
                this.visitSingle(node.operand, v);
                break;
            case RType.Parameter:
                v.visitParameter(node);
                this.visitSingle(node.name, v);
                this.visit(node.defaultValue, v);
                break;
            case RType.Argument:
                v.visitArgument(node);
                this.visit(node.name, v);
                this.visit(node.value, v);
                break;
            case RType.Access:
                v.visitAccess(node);
                this.visitSingle(node.accessed, v);
                if(node.operator === '[' || node.operator === '[[') {
                    this.visit(node.access, v);
                }
                break;
            case RType.Symbol:
                v.visitSymbol(node);
                break;
            case RType.Logical:
                v.visitLogical(node);
                break;
            case RType.Number:
                v.visitNumber(node);
                break;
            case RType.String:
                v.visitString(node);
                break;
            case RType.Comment:
                v.visitComment(node);
                break;
            case RType.Break:
                v.visitBreak(node);
                break;
            case RType.Next:
                v.visitNext(node);
                break;
            case RType.LineDirective:
                v.visitLineDirective(node);
                break;
            default:
                assertUnreachable(type);
        }
    }
    
}

