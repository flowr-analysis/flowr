/**
 * Token types as they are produced by the R parser
 *
 * @see #Type
 */
export const enum RawRType {
	/** T1 */
	NullConst = "NULL_CONST",
	/** T2 */
	NumericConst = "NUM_CONST",
	/** T3 */
	StringConst = "STR_CONST",
	/** T4 */
	EqualAssign = "EQ_ASSIGN",
	/** T5 */
	EqualFormals = "EQ_FORMALS",
	/** T6 */
	EqualSub = "EQ_SUB",
	/** T7 */
	LeftAssign = "LEFT_ASSIGN",
	/** T8 */
	RightAssign = "RIGHT_ASSIGN",
	/** T9 */
	And = "AND",
	/** T10 */
	And2 = "AND2",
	/** T11 */
	Eq = "EQ",
	/** T12 */
	Ge = "GE",
	/** T13 */
	Gt = "GT",
	/** T14 */
	Le = "LE",
	/** T15 */
	Lt = "LT",
	/** T16 */
	Ne = "NE",
	/** T17 */
	Or = "OR",
	/** T18 */
	Or2 = "OR2",
	/** T19 */
	Pipe = "PIPE",
	/** T20 */
	Pipebind = "PIPEBIND",
	/** T21 */
	Special = "SPECIAL",
	/** T22 */
	Plus = "+",
	/** T23 */
	Minus = "-",
	/** T24 */
	Times = "*",
	/** T25 */
	Div = "/",
	/** T26 */
	Colon = ":",
	/** T27 */
	Exclamation = "!",
	/** T28 */
	Exp = "^",
	/** T29 */
	Question = "?",
	/** T30 */
	Tilde = "~",
	/** T31 */
	Break = "BREAK",
	/** T32 */
	Else = "ELSE",
	/** T33 */
	For = "FOR",
	/** T34 */
	ForCondition = "forcond",
	/** T35 */
	If = "IF",
	/** T36 */
	ForIn = "IN",
	/** T37 */
	Next = "NEXT",
	/** T38 */
	Repeat = "REPEAT",
	/** T39 */
	While = "WHILE",
	/** T40 */
	Function = "FUNCTION",
	/** T41 */
	Lambda = "\\",
	/** T42 */
	DoubleBracketLeft = "LBB",
	/** T43 */
	Slot = "SLOT",
	/** T44 */
	Dollar = "$",
	/** T45 */
	At = "@",
	/** T46 */
	BracketLeft = "[",
	/** T47 */
	BracketRight = "]",
	/** T48 */
	NsGet = "::",
	/** T49 */
	NsGetInt = ":::",
	/** T50 */
	Symbol = "SYMBOL",
	/** T51 */
	SymbolFunctionCall = "SYMBOL_FUNCTION_CALL",
	/** T52 */
	SymbolPackage = "SYMBOL_PACKAGE",
	/** T53 */
	SymbolSub = "SYMBOL_SUB",
	/** T54 */
	SymbolFormals = "SYMBOL_FORMALS",
	/** T55 */
	Comment = "COMMENT",
	/** T56 */
	LineDirective = "LINE_DIRECTIVE",
	/** T57 */
	ParenLeft = "(",
	/** T58 */
	ParenRight = ")",
	/** T59 */
	Comma = ",",
	/** T60 */
	Semicolon = ";",
	/** T61 */
	BraceLeft = "{",
	/** T62 */
	BraceRight = "}",
	/** T63 */
	Expression = "expr",
	/** T64
	 *
	 * https://github.com/REditorSupport/languageserver/issues/327
	 * https://github.com/REditorSupport/languageserver/pull/328
	 */
	ExprOfAssignOrHelp = "expr_or_assign_or_help",
	/** T65 */
	ExpressionList = "exprlist",
}

/**
 * Types as we use them for our normalized AST
 *
 * @see #RawRType
 */
export const enum Type {
	/** {@link RAccess} */
	Access = "RAccess",
	/** {@link RArgument} */
	Argument = "RArgument",
	/** {@link RBinaryOp} */
	BinaryOp = "RBinaryOp",
	/** {@link RExpressionList} */
	ExpressionList = "RExpressionList",
	/** {@link RForLoop} */
	ForLoop = "RForLoop",
	/** {@link RFunctionCall} */
	FunctionCall = "RFunctionCall",
	/** {@link RFunctionDefinition} */
	FunctionDefinition = "RFunctionDefinition",
	/** {@link RIfThenElse} */
	IfThenElse = "RIfThenElse",
	/** {@link RParameter} */
	Parameter = "RParameter",
	/** {@link RPipe} */
	Pipe = "RPipe",
	/** {@link RRepeatLoop} */
	RepeatLoop = "RRepeatLoop",
	/** {@link RUnaryOp} */
	UnaryOp = "RUnaryOp",
	/** {@link RWhileLoop} */
	WhileLoop = "RWhileLoop",
	/** {@link RBreak} */
	Break = "RBreak",
	/** {@link RComment} */
	Comment = "RComment",
	/** {@link RLineDirective} */
	LineDirective = "RLineDirective",
	/** {@link RLogical} */
	Logical = "RLogical",
	/** {@link RNext} */
	Next = "RNext",
	/** {@link RNumber} */
	Number = "RNumber",
	/** {@link RString} */
	String = "RString",
	/** {@link RSymbol} */
	Symbol = "RSymbol",
	/* ------ special types ------ */
	Delimiter = "RDelimiter",
}

/**
 * Validates, whether the given type can be used as a symbol in R
 *
 * @see RawRType
 */
export function isSymbol(type: string): boolean {
	return (
		type === RawRType.Symbol ||
    type === RawRType.SymbolPackage ||
    type === RawRType.SymbolFunctionCall ||
    type === RawRType.NullConst ||
    type === RawRType.Slot
	)
}
