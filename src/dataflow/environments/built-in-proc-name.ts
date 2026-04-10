/**
 * This contains all names of built-in function handlers and origins.
 */
export enum BuiltInProcName {
	/** for subsetting operations */
	Access              = 'builtin:access',
	/** for the `*apply` family */
	Apply               = 'builtin:apply',
	/** for assignments like `<-` and `=` */
	Assignment          = 'builtin:assignment',
	/** for assignment-like functions that may do additional work */
	AssignmentLike      = 'builtin:assignment-like',
	/** for `break` calls */
	Break               = 'builtin:break',
	/** the default built-in processor */
	Default             = 'builtin:default',
	/** for `eval` calls */
	Eval                = 'builtin:eval',
	/** for expression lists */
	ExpressionList      = 'builtin:expression-list',
	/** for `for` loops */
	ForLoop             = 'builtin:for-loop',
	/** We resolved a function call, similar to {@link BuiltInProcName.Default} */
	Function            = 'function',
	/** for function definitions */
	FunctionDefinition  = 'builtin:function-definition',
	/** for `get` calls */
	Get                 = 'builtin:get',
	/** for `if-then-else` constructs */
	IfThenElse          = 'builtin:if-then-else',
	/** for `library` and `require` calls */
	Library             = 'builtin:library',
	/** for `list` calls */
	List                = 'builtin:list',
	/** for `local` calls */
	Local               = 'builtin:local',
	/** for the pipe operators */
	Pipe                = 'builtin:pipe',
	/** for `quote`, and other substituting calls */
	Quote               = 'builtin:quote',
	/** for `on.exit` and other hooks */
	RegisterHook        = 'builtin:register-hook',
	/** for `repeat` loops */
	RepeatLoop          = 'builtin:repeat-loop',
	/** for replacement functions like `names<-` */
	Replacement         = 'builtin:replacement',
	/** for `return` calls */
	Return              = 'builtin:return',
	/** for `rm` calls */
	Rm                  = 'builtin:rm',
	/** for `UseMethod` calls */
	S3Dispatch          = 'builtin:s3-dispatch',
	/** for `source` calls */
	Source              = 'builtin:source',
	/** for special binary operators like `%x%` */
	SpecialBinOp        = 'builtin:special-bin-op',
	/** for `stop` calls */
	Stop                = 'builtin:stop',
	/** for `stopifnot` calls */
	StopIfNot           = 'builtin:stopifnot',
	/** support for `:=` in subsetting assignments */
	TableAssignment     = 'table:assign',
	/** for `try` calls */
	Try                 = 'builtin:try',
	/** for unnamed directly-linked function calls */
	Unnamed             = 'unnamed',
	/** for vector construction calls */
	Vector              = 'builtin:vector',
	/** for `while` loops */
	WhileLoop           = 'builtin:while-loop',
}