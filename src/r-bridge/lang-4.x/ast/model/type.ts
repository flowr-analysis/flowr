import { assertUnreachable } from '../../../../util/assert'

/**
 * TokenTypes as they are produced by the R parser
 */
export const enum RawR {
	/** T1 */
	NullConst = "NULL_CONST",
	/** T2 */
	NumConst = "NUM_CONST",
	/** T3 */
	StrConst = "STR_CONST",
	/** T4 */
	EqAssign = "EQ_ASSIGN",
	/** T5 */
	EqFormals = "EQ_FORMALS",
	/** T6 */
	EqSub = "EQ_SUB",
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
	ForCond = "forcond",
	/** T35 */
	If = "IF",
	/** T36 */
	In = "IN",
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
	Lbb = "LBB",
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
	Expr = "expr",
	/** T64 */
	ExprOfAssignOrHelp = "expr_or_assign_or_help",
	/** T65 */
	Exprlist = "exprlist",
}

/**
 * Represents the types known by R (i.e., it may contain more or others than the ones we use)
 */
export const enum Type {
	/** `[`, `[[`, `$`, and `@` */
	Access = "access",
	ExpressionList = "exprlist",
	Expression = "expr",
	/*
   * https://github.com/REditorSupport/languageserver/issues/327
   * https://github.com/REditorSupport/languageserver/pull/328
   */
	ExprHelpAssignWrapper = "expr_or_assign_or_help",
	Symbol = "SYMBOL",
	SymbolFormals = "SYMBOL_FORMALS",
	SymbolNamedFormals = "SYMBOL_SUB",
	/* will be represented as a number in R */
	Logical = "boolean",
	/* this will be a symbol for us */
	Null = "NULL_CONST",
	Number = "NUM_CONST",
	String = "STR_CONST",
	BinaryOp = "binaryop",
	UnaryOp = "unaryop",
	LineDirective = "LINE_DIRECTIVE",
	Comment = "COMMENT",
	/* can be special operators like %*% or %o% */
	Special = "SPECIAL",
	// parens will be removed and dealt with as precedences/arguments automatically
	ParenLeft = "(",
	ParenRight = ")",
	BraceLeft = "{",
	BraceRight = "}",
	DoubleBracketLeft = "LBB",
	BracketLeft = "[",
	BracketRight = "]",
	Dollar = "$",
	At = "@",
	Slot = "SLOT",
	Semicolon = ";",
	For = "FOR",
	ForCondition = "forcond",
	ForIn = "IN",
	Repeat = "REPEAT",
	While = "WHILE",
	If = "IF",
	Else = "ELSE",
	Pipe = "PIPE",
	Comma = ",",
	FunctionCall = "SYMBOL_FUNCTION_CALL",
	FunctionDefinition = "FUNCTION",
	LambdaFunctionDefinition = "\\\\",
	SymbolPackage = "SYMBOL_PACKAGE",
	NamespaceGet = "NS_GET",
	Break = "BREAK",
	Next = "NEXT",
	EqFormals = "EQ_FORMALS",
	EqNamedArgument = "EQ_SUB",
	Parameter = "Parameter",
	Argument = "Argument",
	Delimiter = "Delimiter"
}

/**
 * Returns the name of the corresponding interface if there is one. Otherwise, this throws an error.
 */
export function mapTypeToNormalizedName(type: Type): string {
	switch(type) {
		case Type.Access:
			return "RAccess"
		case Type.Argument:
			return "RArgument"
		case Type.BinaryOp:
			return "RBinaryOp"
		case Type.Break:
			return "RBreak"
		case Type.Comment:
			return "RComment"
		case Type.ExpressionList:
			return "RExpressionList"
		case Type.For:
			return "RForLoop"
		case Type.FunctionCall:
			return "RFunctionCall"
		case Type.FunctionDefinition:
			return "RFunctionDefinition"
		case Type.If:
			return "RIfThenElse"
		case Type.LineDirective:
			return "RLineDirective"
		case Type.Logical:
			return "RLogical"
		case Type.Next:
			return "RNext"
		case Type.Number:
			return "RNumber"
		case Type.Parameter:
			return "RParameter"
		case Type.Pipe:
			return "RPipe"
		case Type.Repeat:
			return "RRepeatLoop"
		case Type.String:
			return "RString"
		case Type.Symbol:
			return "RSymbol"
		case Type.UnaryOp:
			return "RUnaryOp"
		case Type.While:
			return "RWhileLoop"
		case Type.Expression:
		case Type.Null:
		case Type.ExprHelpAssignWrapper:
		case Type.SymbolFormals:
		case Type.SymbolNamedFormals:
		case Type.Special:
		case Type.ParenLeft:
		case Type.ParenRight:
		case Type.BraceLeft:
		case Type.BraceRight:
		case Type.DoubleBracketLeft:
		case Type.BracketLeft:
		case Type.BracketRight:
		case Type.Dollar:
		case Type.At:
		case Type.Slot:
		case Type.Semicolon:
		case Type.ForCondition:
		case Type.ForIn:
		case Type.Else:
		case Type.Comma:
		case Type.LambdaFunctionDefinition:
		case Type.SymbolPackage:
		case Type.NamespaceGet:
		case Type.EqFormals:
		case Type.EqNamedArgument:
		case Type.Delimiter:
			throw new Error(`Type ${type} is not a valid normalized type`)
		default:
			assertUnreachable(type)
	}
}

/**
 * Validates, whether the given type can be used as a symbol in R
 *
 * @see Type
 */
export function isSymbol(type: string): boolean {
	return (
		type === Type.Symbol ||
    type === Type.SymbolPackage ||
    type === Type.FunctionCall ||
    type === Type.Null ||
    type === Type.Slot
	)
}
