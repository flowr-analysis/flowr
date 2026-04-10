import type { AstIdMap, RNodeWithParent } from './decorate';

/**
 * Describes the role of the node in its parent. For example,
 * if we have `if(TRUE) { ... }`, the role of the `TRUE` node is `IfCondition`.
 * @see ParentContextInfo
 * @see ParentInformation
 */
export const enum RoleInParent {
	/** has no parent */
	Root = 'root',
	IfCondition = 'if-cond',
	IfThen = 'if-then',
	IfOtherwise = 'if-other',
	WhileCondition = 'while-cond',
	WhileBody = 'while-body',
	RepeatBody = 'repeat-body',
	ForVariable = 'for-var',
	ForVector = 'for-vec',
	ForBody = 'for-body',
	FunctionCallName = 'call-name',
	FunctionCallArgument = 'call-arg',
	FunctionDefinitionBody = 'fun-body',
	FunctionDefinitionParameter = 'param',
	ExpressionListChild = 'expr-list-child',
	BinaryOperationLhs = 'binop-lhs',
	BinaryOperationRhs = 'binop-rhs',
	PipeLhs = 'pipe-lhs',
	PipeRhs = 'pipe-rhs',
	UnaryOperand = 'unary-op',
	ParameterName = 'param-name',
	ParameterDefaultValue = 'param-value',
	ArgumentName = 'arg-name',
	ArgumentValue = 'arg-value',
	Accessed = 'accessed',
	IndexAccess = 'index-acc'
}


/**
 * Returns the roles of the parents of the given node, starting with the parent-role of the node itself.
 */
export function rolesOfParents(node: RNodeWithParent, idMap: AstIdMap): RoleInParent[] {
	const roles: RoleInParent[] = [];
	let current: RNodeWithParent | undefined = node;
	while(current !== undefined) {
		roles.push(current.info.role);
		current = current.info.parent ? idMap.get(current.info.parent) : undefined;
	}
	return roles;
}
