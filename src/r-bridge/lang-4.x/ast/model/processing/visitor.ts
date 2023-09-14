import { RNode } from '../model'
import { Type } from '../type'
import { assertUnreachable } from '../../../../../util/assert'

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
export type OnVisit<OtherInfo> = (node: RNode<OtherInfo>, context: ParentContextInfo) => boolean

function visitSingle<OtherInfo>(node: RNode<OtherInfo>, onVisit: OnVisit<OtherInfo>, context: ParentContextInfo): void {
	if(onVisit(node, context)) {
		return
	}

	const type = node.type
	switch(type) {
		case Type.FunctionCall:
			visit(node.flavor === 'named' ? node.functionName : node.calledFunction, onVisit, { role: RoleInParent.FunctionCallName, index: 0 })
			visit(node.arguments, onVisit, { role: RoleInParent.FunctionCallArgument, index: 1 })
			break
		case Type.FunctionDefinition:
			visit(node.parameters, onVisit, { role: RoleInParent.FunctionDefinitionParameter, index: 0 })
			visit(node.body, onVisit, { role: RoleInParent.FunctionDefinitionBody, index: node.parameters.length })
			break
		case Type.ExpressionList:
			visit(node.children, onVisit, { role: RoleInParent.ExpressionListChild, index: 0 })
			break
		case Type.ForLoop:
			visit(node.variable, onVisit, { role: RoleInParent.ForVariable, index: 0 })
			visit(node.vector, onVisit, { role: RoleInParent.ForVector, index: 1 })
			visit(node.body, onVisit, { role: RoleInParent.ForBody, index: 2 })
			break
		case Type.WhileLoop:
			visit(node.condition, onVisit, { role: RoleInParent.WhileCondition, index: 0 })
			visit(node.body, onVisit, { role: RoleInParent.WhileBody, index: 1 })
			break
		case Type.RepeatLoop:
			visit(node.body, onVisit, { role: RoleInParent.RepeatBody, index: 0 })
			break
		case Type.IfThenElse:
			visit(node.condition, onVisit, { role: RoleInParent.IfCondition, index: 0 })
			visit(node.then, onVisit, { role: RoleInParent.IfThen, index: 1 })
			visit(node.otherwise, onVisit, { role: RoleInParent.IfOtherwise, index: 2 })
			break
		case Type.Pipe:
			visit(node.lhs, onVisit, { role: RoleInParent.PipeLhs, index: 0 })
			visit(node.rhs, onVisit, { role: RoleInParent.PipeRhs, index: 1 })
			break
		case Type.BinaryOp:
			visit(node.lhs, onVisit, { role: RoleInParent.BinaryOperationLhs, index: 0 })
			visit(node.rhs, onVisit, { role: RoleInParent.BinaryOperationRhs, index: 1 })
			break
		case Type.UnaryOp:
			visit(node.operand, onVisit, { role: RoleInParent.UnaryOperand, index: 0 })
			break
		case Type.Parameter:
			visit(node.name, onVisit, { role: RoleInParent.ParameterName, index: 0 })
			visit(node.defaultValue, onVisit, { role: RoleInParent.ParameterDefaultValue, index: 1 })
			break
		case Type.Argument:
			visit(node.name, onVisit, { role: RoleInParent.ArgumentName, index: 0 })
			visit(node.value, onVisit, { role: RoleInParent.ArgumentValue, index: 1 })
			break
		case Type.Access:
			visit(node.accessed, onVisit, { role: RoleInParent.Accessed, index: 0 })
			if(node.operator === '[' || node.operator === '[[') {
				visit(node.access, onVisit, { role: RoleInParent.IndexAccess, index: 1 })
			}
			break
		case Type.Symbol:
		case Type.Logical:
		case Type.Number:
		case Type.String:
		case Type.Comment:
		case Type.Break:
		case Type.Next:
		case Type.LineDirective:
			// leafs
			break
		default:
			assertUnreachable(type)
	}
}

/**
 * Collects all node ids within a tree given by a respective root node
 *
 * @param nodes          - The root id nodes to start collecting from
 * @param onVisit        - A function that is called for each node encountered - can be used to stop visiting the subtree starting with this node (return `true` stop)
 * @param initialContext - The initial context to use for the root node (only necessary if the context is important for your function, and you know that what you pass is not the root-node)
 */
export function visit<OtherInfo>(nodes: RNode<OtherInfo> | (RNode<OtherInfo> | null | undefined)[] | undefined, onVisit: OnVisit<OtherInfo>, initialContext: ParentContextInfo = { role: RoleInParent.Root, index: 0 }): void {
	if(Array.isArray(nodes)) {
		let index = initialContext.index - 1 /* initial increment */
		for(const node of nodes) {
			index++
			if(node === null || node === undefined) {
				continue
			}
			visitSingle(node, onVisit, { ...initialContext, index })
		}
	} else if(nodes !== undefined) {
		visitSingle(nodes, onVisit, initialContext)
	}
}
