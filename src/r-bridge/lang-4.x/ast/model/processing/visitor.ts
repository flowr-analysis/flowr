import { NoInfo, RNode } from '../model'
import { RType } from '../type'
import { assertUnreachable } from '../../../../../util/assert'


/** Return `true` to stop visiting from this node (i.e., do not continue to visit this node *and* the children) */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void is used to indicate that the return value is ignored/we never stop
export type OnEnter<OtherInfo> = (node: RNode<OtherInfo>) => (boolean | void)
/** Similar to {@link OnEnter} but called when leaving a node. Can't stop exploration as the subtree is already visited! */
export type OnExit<OtherInfo> = (node: RNode<OtherInfo>) => void

// capsuled as a class to avoid passing onExit and onEnter on *each* visit call
class NodeVisitor<OtherInfo = NoInfo> {
	private readonly onEnter?: OnEnter<OtherInfo>
	private readonly onExit?:  OnExit<OtherInfo>

	constructor(onEnter?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>) {
		this.onEnter = onEnter
		this.onExit = onExit
	}

	private visitSingle(node: RNode<OtherInfo>): void {
		if(this.onEnter?.(node)) {
			return
		}

		/* let the type system know, that the type does not change */
		const type = node.type
		switch(type) {
			case RType.FunctionCall:
				this.visit(node.flavor === 'named' ? node.functionName : node.calledFunction)
				this.visit(node.arguments)
				break
			case RType.FunctionDefinition:
				this.visit(node.parameters)
				this.visit(node.body)
				break
			case RType.ExpressionList:
				this.visit(node.children)
				break
			case RType.ForLoop:
				this.visit(node.variable)
				this.visit(node.vector)
				this.visit(node.body)
				break
			case RType.WhileLoop:
				this.visit(node.condition)
				this.visit(node.body)
				break
			case RType.RepeatLoop:
				this.visit(node.body)
				break
			case RType.IfThenElse:
				this.visit(node.condition)
				this.visit(node.then)
				this.visit(node.otherwise)
				break
			case RType.BinaryOp:
			case RType.Pipe:
				this.visit(node.lhs)
				this.visit(node.rhs)
				break
			case RType.UnaryOp:
				this.visit(node.operand)
				break
			case RType.Parameter:
				this.visit(node.name)
				this.visit(node.defaultValue)
				break
			case RType.Argument:
				this.visit(node.name)
				this.visit(node.value)
				break
			case RType.Access:
				this.visit(node.accessed)
				if(node.operator === '[' || node.operator === '[[') {
					this.visit(node.access)
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

		this.onExit?.(node)
	}

	visit(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined | null): void {
		if(Array.isArray(nodes)) {
			for(const node of nodes) {
				if(node) {
					this.visitSingle(node)
				}
			}
		} else if(nodes) {
			this.visitSingle(nodes)
		}
	}

}

/**
 * Collects all node ids within a tree given by a respective root node
 *
 * @param nodes          - The root id nodes to start collecting from
 * @param onVisit        - Called before visiting the subtree of each node. Can be used to stop visiting the subtree starting with this node (return `true` stop)
 * @param onExit         - Called after the subtree of a node has been visited, called for leafs too (even though their subtree is empty)
 */
export function visitAst<OtherInfo = NoInfo>(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined, onVisit?: OnEnter<OtherInfo>, onExit?: OnExit<OtherInfo>): void {
	return new NodeVisitor(onVisit, onExit).visit(nodes)
}
