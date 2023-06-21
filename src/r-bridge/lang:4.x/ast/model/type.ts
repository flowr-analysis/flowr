/**
 * Represents the types known by R (i.e., it may contain more or others than the ones we use)
 */
export const enum Type {
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
  Comment = "COMMENT",
  /* can be special operators like %*% or %o% */
  Special = "SPECIAL",
  // parens will be removed and dealt with as precedences/arguments automatically
  ParenLeft = "(",
  ParenRight = ")",
  BraceLeft = "{",
  BraceRight = "}",
  Semicolon = ";",
  For = "FOR",
  ForCondition = "forcond",
  ForIn = "IN",
  Repeat = "REPEAT",
  While = "WHILE",
  If = "IF",
  Else = "ELSE",
  Comma = ",",
  FunctionCall = "SYMBOL_FUNCTION_CALL",
  FunctionDefinition = "FUNCTION",
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
 * Validates, whether the given type can be used as a symbol in R
 *
 * @see Type
 */
export function isSymbol(type: string): boolean {
  return (
    type === Type.Symbol ||
    type === Type.SymbolPackage ||
    type === Type.FunctionCall ||
    type === Type.Null
  )
}
