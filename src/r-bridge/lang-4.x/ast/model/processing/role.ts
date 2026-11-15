import type { NodeId } from './node-id';
import type { AstIdMap, ParentInformation } from './decorate';
import type { RNode } from '../model';

/**
 * Describes the role of the node in its parent. For example,
 * if we have `if(TRUE) { ... }`, the role of the `TRUE` node is `IfCondition`.
 * @see ParentContextInfo
 * @see ParentInformation
 */
export const enum RoleInParent {
	/** has no parent */
	Root = 'root',
	IfCondition = 'if-c',
	IfThen = 'if-then',
	IfOtherwise = 'if-other',
	WhileCondition = 'while-c',
	WhileBody = 'while-b',
	RepeatBody = 'repeat-b',
	ForVariable = 'for-var',
	ForVector = 'for-vec',
	ForBody = 'for-b',
	FunctionCallName = 'call-name',
	FunctionCallArgument = 'call-arg',
	FunctionDefinitionBody = 'fun-b',
	FunctionDefinitionParameter = 'param',
	ExpressionListChild = 'el-c',
	ExpressionListGrouping = 'el-g',
	BinaryOperationLhs = 'bin-l',
	BinaryOperationRhs = 'bin-r',
	PipeLhs = 'pipe-l',
	PipeRhs = 'pipe-r',
	UnaryOperand = 'unary-op',
	ParameterName = 'param-n',
	ParameterDefaultValue = 'param-v',
	ArgumentName = 'arg-n',
	ArgumentValue = 'arg-v',
	Accessed = 'acc',
	IndexAccess = 'idx-acc'
}


/**
 * Helper for asking what a node is to its parent, see {@link RoleInParent}.
 * @helper ast
 */
export const RRole = {
	name: 'RRole',
	/** The role of the node with the given id, if the id map knows it. */
	of(this: void, id: NodeId | undefined, idMap: AstIdMap | undefined): RoleInParent | undefined {
		return id === undefined ? undefined : idMap?.get(id)?.info.role;
	},
	/** Whether the node with the given id is the name of a parameter. */
	isParameterName(this: void, id: NodeId | undefined, idMap: AstIdMap | undefined): boolean {
		return RRole.of(id, idMap) === RoleInParent.ParameterName;
	},
	/** The function definition whose parameter the node with the given id names, if it names one. */
	functionOfParameter(this: void, id: NodeId | undefined, idMap: AstIdMap | undefined): NodeId | undefined {
		const node = id === undefined ? undefined : idMap?.get(id);
		return node?.info.role === RoleInParent.ParameterName && node.info.parent !== undefined ? idMap?.get(node.info.parent)?.info.parent : undefined;
	},
	/** Whether the node is a statement of its own, at the top level or in an expression list. */
	isStatement(this: void, node: RNode<ParentInformation>): boolean {
		return node.info.role === RoleInParent.Root || node.info.role === RoleInParent.ExpressionListChild;
	}
} as const;
