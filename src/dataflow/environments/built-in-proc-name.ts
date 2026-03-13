/**
 * This contains all names of built-in function handlers and origins
 */
export enum BuiltInProcName {
	/** for subsetting operations, see {@link processAccess} */
	Access = 'builtin:access',
	/** for the `*apply` family, see {@link processApply} */
	Apply = 'builtin:apply',
	/** for assignments like `<-` and `=`, see {@link processAssignment} */
	Assignment = 'builtin:assignment',
	/** for assignment like functions that may do additional work, see {@link processAssignmentLike} */
	AssignmentLike = 'builtin:assignment-like',
	/** for `break` calls */
	Break = 'builtin:break',
	/** the default built-in processor, see {@link defaultBuiltInProcessor} */
	Default = 'builtin:default',
	/** Just a more performant variant of the default processor for built-ins that need to read all their arguments, see {@link defaultBuiltInProcessor}, this will still produce the origin `BuiltIn.Default` */
	DefaultReadAllArgs = 'builtin:default-read-all-args',
	/** for `eval` calls, see {@link processEvalCall} */
	Eval = 'builtin:eval',
	/** for expression lists, see {@link processExpressionList} */
	ExpressionList = 'builtin:expression-list',
	/** for `for` loops, see {@link processForLoop} */
	ForLoop = 'builtin:for-loop',
	/** We resolved a function call, similar to {@link BuiltInProcName#Default} */
	Function = 'function',
	/** for function definitions, see {@link processFunctionDefinition} */
	FunctionDefinition = 'builtin:function-definition',
	/** for `get` calls, see {@link processGet} */
	Get = 'builtin:get',
	/** for `if-then-else` constructs, see {@link processIfThenElse} */
	IfThenElse = 'builtin:if-then-else',
	/** for `library` and `require` calls, see {@link processLibrary} */
	Library = 'builtin:library',
	/** for `list` calls, see {@link processList} */
	List = 'builtin:list',
	/** for `local` calls, see {@link processLocal} */
	Local = 'builtin:local',
	/** for the pipe operators, see {@link processPipe} */
	Pipe = 'builtin:pipe',
	/** for `quote`, and other substituting calls, see {@link processQuote} */
	Quote = 'builtin:quote',
	/**
	 * for `recall` calls, see {@link processRecall}
	 */
	Recall = 'builtin:recall',
	/** for `on.exìt` and other hooks, see {@link processRegisterHook} */
	RegisterHook = 'builtin:register-hook',
	/** for `repeat` loops, see {@link processRepeatLoop} */
	RepeatLoop = 'builtin:repeat-loop',
	/** for replacement functions like `names<-`, see {@link processReplacementFunction} */
	Replacement = 'builtin:replacement',
	/** for `return` calls */
	Return = 'builtin:return',
	/** for `rm` calls, see {@link processRm} */
	Rm = 'builtin:rm',
	/** for `UseMethod` calls, see {@link processS3Dispatch} */
	S3Dispatch = 'builtin:s3-dispatch',
	/** for `NextMethod` calls, see {@link processS3Dispatch} */
	S3DispatchNext = 'builtin:s3-dispatch-next',
	/** for `new.generic` calls, see {@link processS7NewGeneric} */
	S7NewGeneric = 'builtin:s7-new-generic',
	/** for `S7_dispatch` calls (and their implicit creations), see {@link processS7Dispatch} */
	S7Dispatch = 'builtin:s7-dispatch',
	/** for `source` calls, see {@link processSourceCall} */
	Source = 'builtin:source',
	/** for special binary operators like `%x%`, see {@link processSpecialBinOp} */
	SpecialBinOp = 'builtin:special-bin-op',
	/** for `stop` calls */
	Stop = 'builtin:stop',
	/** for `stopifnot` calls, see {@link processStopIfNot} */
	StopIfNot = 'builtin:stopifnot',
	/** support for `:=` in subsetting assignments, see {@link processAccess} */
	TableAssignment = 'table:assign',
	/** for `try` calls, see {@link processTryCatch} */
	Try = 'builtin:try',
	/** for unnamed directly-linked function calls */
	Unnamed = 'unnamed',
	/** for vector construction calls, see {@link processVector} */
	Vector = 'builtin:vector',
	/** for `while` loops, see {@link processWhileLoop} */
	WhileLoop = 'builtin:while-loop',
}