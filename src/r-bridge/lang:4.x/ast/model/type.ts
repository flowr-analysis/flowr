import { assertUnreachable } from '../../../../util/assert'

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
	// TODO: deal with them as access operators, similarly with '[[' etc.
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

// TODO: this mapping should be removed once i have split the R-type enum from the one we use to separate the AST
/**
 * Returns the name of the corresponding interface if there is one. Otherwise, this throws an error.
 */
export function mapTypeToNormalizedName(type: Type): string {
	switch (type) {
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
