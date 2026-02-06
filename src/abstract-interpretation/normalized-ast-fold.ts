import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { type RFunctionCall, EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RUnaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import type { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RBreak } from '../r-bridge/lang-4.x/ast/model/nodes/r-break';
import type { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import type { RNext } from '../r-bridge/lang-4.x/ast/model/nodes/r-next';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RLineDirective } from '../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { RProject } from '../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { isRProject } from '../r-bridge/lang-4.x/ast/model/nodes/r-project';


type FoldOfType<T extends RType, Returns = void, Info = NoInfo> = (node: Extract<RNode<Info>, { type: T }>) => Returns;

/** explicitly excludes types that are not visitable */
export type FoldableRType = Exclude<RType, RType.Delimiter | RType.Project>;

/**
 * Describes the fold functions for each node type.
 */
export type NormalizedAstFold<Returns = void, Info = NoInfo> = {
	[K in FoldableRType as `fold${Capitalize<K>}`]: FoldOfType<K, Returns, Info>;
};

/**
 * Describes the type of a mapping object,
 * which maps the type of the normalized AST node to the corresponding fold function.
 */
export type FittingNormalizedAstFold<Returns = void, Info = NoInfo> = Readonly<{
	[K in FoldableRType]: FoldOfType<K, Returns, Info>;
}>;

export type SingleOrArrayOrNothing<T> = T | readonly (T | null | undefined)[] | null | undefined;

export type EntryExitVisitor<Info> = ((node: RNode<Info>) => void) | undefined;

/**
 * Default implementation of a fold over the normalized AST (using the classic fold traversal).
 * To modify the behavior, please extend this class and overwrite the methods of interest.
 * You can control the value passing (`Returns` generic)
 * by providing sensible Monoid behavior overwriting the {@link DefaultNormalizedAstFold#concat|concat} method
 * and supplying the empty value in the constructor.
 * @note By providing `entry` and `exit` you can use this as an extension to the simpler {@link visitAst} function but without
 *       the early termination within the visitors (for this, you can overwrite the respective `fold*` methods).
 * @example First you want to create your own fold:
 *
 * ```ts
 * let marker = false;
 * class MyNumberFold<Info> extends DefaultNormalizedAstFold<void, Info> {
 *     override foldRNumber(node: RNumber<Info>) {
 *         super.foldRNumber(node);
 *         marker = true;
 *     }
 * }
 * ```
 * This one does explicitly not use the return functionality (and hence acts more as a conventional visitor).
 * Now let us suppose we have a normalized AST as an {@link RNode} in the variable `ast`
 * and want to check if the AST contains a number:
 *
 * ```ts
 * const result = new MyNumberFold().fold(ast);
 * ```
 *
 * Please take a look at the corresponding tests or the wiki pages for more information on how to use this fold.
 */
export class DefaultNormalizedAstFold<Returns = void, Info = NoInfo> implements NormalizedAstFold<Returns, Info> {
	protected readonly enter: EntryExitVisitor<Info>;
	protected readonly exit:  EntryExitVisitor<Info>;
	protected readonly empty: Returns;

	/**
	 * Empty must provide a sensible default whenever you want to have `Returns` as non-`void`
	 * (e.g., whenever you want your visitors to be able to return a value).
	 */
	constructor(empty: Returns, enter?: EntryExitVisitor<Info>, exit?: EntryExitVisitor<Info>) {
		this.empty = empty;
		this.enter = enter;
		this.exit = exit;
	}

	/**
	 * Monoid::concat
	 * @see {@link https://en.wikipedia.org/wiki/Monoid}
	 * @see {@link DefaultNormalizedAstFold#concatAll|concatAll}
	 */
	protected concat(_a: Returns, _b: Returns): Returns {
		return this.empty;
	}

	/**
	 * overwrite this method, if you have a faster way to concat multiple nodes
	 * @see {@link DefaultNormalizedAstFold#concatAll|concatAll}
	 */
	protected concatAll(nodes: readonly Returns[]): Returns {
		return nodes.reduce((acc, n) => this.concat(acc, n), this.empty);
	}

	public fold(nodes: SingleOrArrayOrNothing<RNode<Info> | typeof EmptyArgument | RProject<Info>>): Returns {
		if(Array.isArray(nodes)) {
			const n = nodes as readonly (RNode<Info> | null | undefined | typeof EmptyArgument | RProject<Info>)[];
			return this.concatAll(
				n.filter(n => n && n !== EmptyArgument)
					.map(node => isRProject<Info>(node) ?
						this.concatAll(node.files.map(f => this.foldSingle(f.root))) :
						this.foldSingle(node as RNode<Info>)
					)
			);
		} else if(nodes) {
			if(isRProject<Info>(nodes)) {
				return this.concatAll(nodes.files.map(f => this.foldSingle(f.root)));
			}
			return this.foldSingle(nodes as RNode<Info>);
		}
		return this.empty;
	}

	protected foldSingle(node: RNode<Info>): Returns {
		this.enter?.(node);
		const type = node.type;
		// @ts-expect-error -- ts may be unable to infer that the type is correct
		const result = this.folds[type]?.(node);
		this.exit?.(node);
		return result;
	}

	foldRAccess(access: RAccess<Info>) {
		let accessed = this.foldSingle(access.accessed);
		if(access.operator === '[' || access.operator === '[[') {
			accessed = this.concat(accessed, this.fold(access.access));
		}
		return accessed;
	}
	foldRArgument(argument: RArgument<Info>) {
		return this.concat(this.fold(argument.name), this.fold(argument.value));
	}
	foldRBinaryOp(binaryOp: RBinaryOp<Info>) {
		return this.concat(this.foldSingle(binaryOp.lhs), this.foldSingle(binaryOp.rhs));
	}
	foldRExpressionList(exprList: RExpressionList<Info>) {
		return this.concat(this.fold(exprList.grouping), this.fold(exprList.children));
	}
	foldRForLoop(loop: RForLoop<Info>) {
		return this.concatAll([this.foldSingle(loop.variable), this.foldSingle(loop.vector), this.foldSingle(loop.body)]);
	}
	foldRFunctionCall(call: RFunctionCall<Info>) {
		return this.concat(this.foldSingle(call.named ? call.functionName : call.calledFunction), this.fold(call.arguments));
	}
	foldRFunctionDefinition(definition: RFunctionDefinition<Info>) {
		return this.concat(this.fold(definition.parameters), this.foldSingle(definition.body));
	}
	foldRIfThenElse(ite: RIfThenElse<Info>) {
		return this.concatAll([this.foldSingle(ite.condition), this.foldSingle(ite.then), this.fold(ite.otherwise)]);
	}
	foldRParameter(parameter: RParameter<Info>) {
		return this.concat(this.foldSingle(parameter.name), this.fold(parameter.defaultValue));
	}
	foldRPipe(pipe: RPipe<Info>) {
		return this.concat(this.foldSingle(pipe.lhs), this.foldSingle(pipe.rhs));
	}
	foldRRepeatLoop(loop: RRepeatLoop<Info>) {
		return this.foldSingle(loop.body);
	}
	foldRUnaryOp(unaryOp: RUnaryOp<Info>) {
		return this.foldSingle(unaryOp.operand);
	}
	foldRWhileLoop(loop: RWhileLoop<Info>) {
		return this.concat(this.foldSingle(loop.condition), this.foldSingle(loop.body));
	}
	foldRBreak(_node: RBreak<Info>) {
		return this.empty;
	}
	foldRComment(_node: RComment<Info>) {
		return this.empty;
	}
	foldRLineDirective(_node: RLineDirective<Info>) {
		return this.empty;
	}
	foldRLogical(_node: RLogical<Info>) {
		return this.empty;
	}
	foldRNext(_node: RNext<Info>) {
		return this.empty;
	}
	foldRNumber(_node: RNumber<Info>) {
		return this.empty;
	}
	foldRString(_node: RString<Info>) {
		return this.empty;
	}
	foldRSymbol(_node: RSymbol<Info>) {
		return this.empty;
	}

	protected readonly folds: FittingNormalizedAstFold<Returns, Info> = {
		[RType.Access]:             n => this.foldRAccess(n),
		[RType.Argument]:           n => this.foldRArgument(n),
		[RType.BinaryOp]:           n => this.foldRBinaryOp(n),
		[RType.Break]:              n => this.foldRBreak(n),
		[RType.Comment]:            n => this.foldRComment(n),
		[RType.ExpressionList]:     n => this.foldRExpressionList(n),
		[RType.ForLoop]:            n => this.foldRForLoop(n),
		[RType.FunctionCall]:       n => this.foldRFunctionCall(n),
		[RType.FunctionDefinition]: n => this.foldRFunctionDefinition(n),
		[RType.IfThenElse]:         n => this.foldRIfThenElse(n),
		[RType.LineDirective]:      n => this.foldRLineDirective(n),
		[RType.Logical]:            n => this.foldRLogical(n),
		[RType.Next]:               n => this.foldRNext(n),
		[RType.Number]:             n => this.foldRNumber(n),
		[RType.Parameter]:          n => this.foldRParameter(n),
		[RType.Pipe]:               n => this.foldRPipe(n),
		[RType.RepeatLoop]:         n => this.foldRRepeatLoop(n),
		[RType.String]:             n => this.foldRString(n),
		[RType.Symbol]:             n => this.foldRSymbol(n),
		[RType.UnaryOp]:            n => this.foldRUnaryOp(n),
		[RType.WhileLoop]:          n => this.foldRWhileLoop(n),
	};
}

