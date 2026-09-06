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


