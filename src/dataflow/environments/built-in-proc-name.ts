/**
 * This contains all names of built-in function handlers and origins
 */
export enum BuiltInProcName {
	/** for subsetting operations, see {@link processAccess} */
	Access = 'builtin:acc',
	/** for the `*apply` family, see {@link processApply} */
	Apply = 'builtin:app',
	/** for assignments like `<-` and `=`, see {@link processAssignment} */
	Assignment = 'builtin:assign',
	/** for assignment like functions that may do additional work, see {@link processAssignmentLike} */
	AssignmentLike = 'builtin:assign-l',
	/** for super-assignments like `<<-` and `->>`, see {@link processAssignment} */
	SuperAssignment = 'builtin:s-assign',
	/** for `break` calls */
	Break = 'builtin:break',
	/** the default built-in processor, see {@link defaultBuiltInProcessor} */
	Default = 'builtin:d',
	/** Just a more performant variant of the default processor for built-ins that need to read all their arguments, see {@link defaultBuiltInProcessor}, this will still produce the origin `BuiltIn.Default` */
	DefaultReadAllArgs = 'builtin:d-ra',
	/** for `eval` calls, see {@link processEvalCall} */
	Eval = 'builtin:eval',
	/** for expression lists, see {@link processExpressionList} */
	ExpressionList = 'builtin:el',
	/** for `for` loops, see {@link processForLoop} */
	ForLoop = 'builtin:fl',
	/** We resolved a function call, similar to {@link BuiltInProcName#Default} */
	Function = 'function',
	/** for function definitions, see {@link processFunctionDefinition} */
	FunctionDefinition = 'builtin:f-def',
	/** for `get` calls, see {@link processGet} */
	Get = 'builtin:get',
	/** for `if-then-else` constructs, see {@link processIfThenElse} */
	IfThenElse = 'builtin:ite',
	/** for `library` and `require` calls, see {@link processLibrary} */
	Library = 'builtin:lib',
	/** for `list` calls, see {@link processList} */
	List = 'builtin:list',
	/** for `local` calls, see {@link processLocal} */
	Local = 'builtin:local',
	/** for `::` and `:::` called as a function, see {@link processNamespaceAccess} */
	NamespaceAccess = 'builtin:ns-access',
	/** for the pipe operators, see {@link processPipe} */
	Pipe = 'builtin:pipe',
	/**
	 * Support for purrr's functional style of formulas with implicit arguments,
	 * for example, supports `map(g, ~ .x + 2)`
	 * @see {@link processPurrrFormula}
	 */
	PurrrFormula = 'builtin:purrr-f',
	/** for `quote`, and other substituting calls, see {@link processQuote} */
	Quote = 'builtin:quote',
	/**
	 * for `recall` calls, see {@link processRecall}
	 */
	Recall = 'builtin:recall',
	/** for `on.exìt` and other hooks, see {@link processRegisterHook} */
	RegisterHook = 'builtin:r-hook',
	/** for `repeat` loops, see {@link processRepeatLoop} */
	RepeatLoop = 'builtin:rl',
	/** for replacement functions like `names<-`, see {@link processReplacementFunction} */
	Replacement = 'builtin:repl',
	/** for `return` calls */
	Return = 'builtin:return',
	/** for `rm` calls, see {@link processRm} */
	Rm = 'builtin:rm',
	/** for `UseMethod` calls, see {@link processS3Dispatch} */
	S3Dispatch = 'builtin:s3-dp',
	/** for `NextMethod` calls, see {@link processS3Dispatch} */
	S3DispatchNext = 'builtin:s3-dp-next',
	/** for `new.generic` calls, see {@link processS7NewGeneric} */
	S7NewGeneric = 'builtin:s7-new-generic',
	/** for `S7_dispatch` calls (and their implicit creations), see {@link processS7Dispatch} */
	S7Dispatch = 'builtin:s7-dispatch',
	/** for `make_constructor(class)` calls that return a class constructor function, see {@link processMakeConstructor} */
	S7MakeConstructor = 'builtin:s7-make-constructor',
	/** for `source` calls, see {@link processSourceCall} */
	Source = 'builtin:source',
	/** for special binary operators like `%x%`, see {@link processSpecialBinOp} */
	SpecialBinOp = 'builtin:s-bop',
	/** for env-returning builtins (`globalenv`/`baseenv`/`emptyenv`) that point into the search-path stack, see {@link processStackEnv} */
	StackEnv = 'builtin:stack-env',
	/** for `stop` calls */
	Stop = 'builtin:stop',
	/** for `stopifnot` calls, see {@link processStopIfNot} */
	StopIfNot = 'builtin:stopifnot',
	/** support for `:=` in subsetting assignments, see {@link processAccess} */
	TableAssignment = 'table:assign',
	/** for `try` calls, see {@link processTryCatch} */
	Try = 'builtin:try',
	/** for `attach` calls that inject environment contents into the search path, see {@link processAttach} */
	Attach = 'builtin:attach',
	/** for `new.env` and related environment-creation calls, see {@link processNewEnv} */
	NewEnv = 'builtin:nenv',
	/** for unnamed directly-linked function calls */
	Unnamed = 'unnamed',
	/** for vector construction calls, see {@link processVector} */
	Vector = 'builtin:vector',
	/** for `while` loops, see {@link processWhileLoop} */
	WhileLoop = 'builtin:wl',
	/** for `with` calls that evaluate an expression inside a named environment, see {@link processWithEnv} */
	With = 'builtin:with',
}