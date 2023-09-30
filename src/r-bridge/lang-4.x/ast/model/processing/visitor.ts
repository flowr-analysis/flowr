import { NoInfo, RNode } from '../model'
import { RType } from '../type'
import { assertUnreachable } from '../../../../../util/assert'

/**
 * Available when {@link visitAst|visiting} all nodes of the AST.
 * Describes the role of the node in its parent. For example,
 * if we have `if(TRUE) { ... }`, the role of the `TRUE` node is `IfCondition`.
 */
export const enum RoleInParent {
	/** has no parent */
	Root = 'root',
	IfCondition = 'if-cond',
	IfThen = 'if-then',
	IfOtherwise = 'if-otherwise',
	WhileCondition = 'while-cond',
	WhileBody = 'while-body',
	RepeatBody = 'repeat-body',
	ForVariable = 'for-variable',
	ForVector = 'for-vector',
	ForBody = 'for-body',
	FunctionCallName = 'call-name',
	FunctionCallArgument = 'call-argument',
	FunctionDefinitionBody = 'function-def-body',
	FunctionDefinitionParameter = 'function-def-param',
	ExpressionListChild = 'expr-list-child',
	BinaryOperationLhs = 'binop-lhs',
	BinaryOperationRhs = 'binop-rhs',
	PipeLhs = 'pipe-lhs',
	PipeRhs = 'pipe-rhs',
	UnaryOperand = 'unary-operand',
	ParameterName = 'param-name',
	ParameterDefaultValue = 'param-value',
	ArgumentName = 'arg-name',
	ArgumentValue = 'arg-value',
	Accessed = 'accessed',
	IndexAccess = 'index-access'
}

export interface ParentContextInfo {
	readonly role:  RoleInParent
	readonly index: number
}

/** Return `true` to stop visiting from this node (i.e., do not continue to visit this node *and* the children) */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
export type OnEnter<OtherInfo> = (node: RNode<OtherInfo>, context: ParentContextInfo) => (boolean | void)
/** Similar to {@link OnEnter} but called when leaving a node. Can't stop exploration as the subtree is already visited! */
export type OnExit<OtherInfo> = (node: RNode<OtherInfo>, context: ParentContextInfo) => void

// capsuled as a class to avoid passing onExit and onEnter on *each* visit call
class NodeVisitor<OtherInfo = NoInfo> {
	private readonly onEnter?: OnEnter<OtherInfo>
	private readonly onExit?:  OnExit<OtherInfo>

	constructor(onEnter?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>) {
		this.onEnter = onEnter
		this.onExit = onExit
	}

	private visitSingle(node: RNode<OtherInfo>, context: ParentContextInfo): void {
		if(this.onEnter?.(node, context)) {
			return
		}

		/* let the type system know, that the type does not change */
		const type = node.type
		switch(type) {
			case RType.FunctionCall:
				this.visit(node.flavor === 'named' ? node.functionName : node.calledFunction, { role: RoleInParent.FunctionCallName, index: 0 })
				this.visit(node.arguments, { role: RoleInParent.FunctionCallArgument, index: 1 })
				break
			case RType.FunctionDefinition:
				this.visit(node.parameters, { role: RoleInParent.FunctionDefinitionParameter, index: 0 })
				this.visit(node.body, { role: RoleInParent.FunctionDefinitionBody, index: node.parameters.length })
				break
			case RType.ExpressionList:
				this.visit(node.children, { role: RoleInParent.ExpressionListChild, index: 0 })
				break
			case RType.ForLoop:
				this.visit(node.variable, { role: RoleInParent.ForVariable, index: 0 })
				this.visit(node.vector, { role: RoleInParent.ForVector, index: 1 })
				this.visit(node.body, { role: RoleInParent.ForBody, index: 2 })
				break
			case RType.WhileLoop:
				this.visit(node.condition, { role: RoleInParent.WhileCondition, index: 0 })
				this.visit(node.body, { role: RoleInParent.WhileBody, index: 1 })
				break
			case RType.RepeatLoop:
				this.visit(node.body, { role: RoleInParent.RepeatBody, index: 0 })
				break
			case RType.IfThenElse:
				this.visit(node.condition, { role: RoleInParent.IfCondition, index: 0 })
				this.visit(node.then, { role: RoleInParent.IfThen, index: 1 })
				this.visit(node.otherwise, { role: RoleInParent.IfOtherwise, index: 2 })
				break
			case RType.Pipe:
				this.visit(node.lhs, { role: RoleInParent.PipeLhs, index: 0 })
				this.visit(node.rhs, { role: RoleInParent.PipeRhs, index: 1 })
				break
			case RType.BinaryOp:
				this.visit(node.lhs, { role: RoleInParent.BinaryOperationLhs, index: 0 })
				this.visit(node.rhs, { role: RoleInParent.BinaryOperationRhs, index: 1 })
				break
			case RType.UnaryOp:
				this.visit(node.operand, { role: RoleInParent.UnaryOperand, index: 0 })
				break
			case RType.Parameter:
				this.visit(node.name, { role: RoleInParent.ParameterName, index: 0 })
				this.visit(node.defaultValue, { role: RoleInParent.ParameterDefaultValue, index: 1 })
				break
			case RType.Argument:
				this.visit(node.name, { role: RoleInParent.ArgumentName, index: 0 })
				this.visit(node.value, { role: RoleInParent.ArgumentValue, index: 1 })
				break
			case RType.Access:
				this.visit(node.accessed, { role: RoleInParent.Accessed, index: 0 })
				if(node.operator === '[' || node.operator === '[[') {
					this.visit(node.access, { role: RoleInParent.IndexAccess, index: 1 })
				}
				break
			case RType.Symbol:
			case RType.Logical:
			case RType.Number:
			case RType.String:
			case RType.Comment:
			case RType.Break:
			case RType.Next:
			case RType.LineDirective:
				// leafs
				break
			default:
				assertUnreachable(type)
		}

		this.onExit?.(node, context)
	}

	visit(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined, initialContext: ParentContextInfo): void {
		if(Array.isArray(nodes)) {
			let index = initialContext.index - 1 /* initial increment */
			for(const node of nodes) {
				index++
				if(node === null || node === undefined) {
					continue
				}
				this.visitSingle(node, { ...initialContext, index })
			}
		} else if(nodes !== undefined) {
			this.visitSingle(nodes, initialContext)
		}
	}

}

/**
 * Collects all node ids within a tree given by a respective root node
 *
 * @param nodes          - The root id nodes to start collecting from
 * @param onVisit        - Called before visiting the subtree of each node. Can be used to stop visiting the subtree starting with this node (return `true` stop)
 * @param onExit         - Called after the subtree of a node has been visited, called for leafs too (even though their subtree is empty)
 * @param initialContext - The initial context to use for the root node (only necessary if the context is important for your function, and you know that what you pass is not the root-node)
 */
export function visitAst<OtherInfo = NoInfo>(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined, onVisit?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>, initialContext: ParentContextInfo = { role: RoleInParent.Root, index: 0 }): void {
	return new NodeVisitor(onVisit, onExit).visit(nodes, initialContext)
}
