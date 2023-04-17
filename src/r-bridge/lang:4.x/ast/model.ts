import { type MergeableRecord } from '../../../util/objects'
import { type RNa, type RNull, type RNumberValue, type RStringValue } from '../values'

/**
 * Represents the types known by R (i.e., it may contain more or others than the ones we use)
 */
export enum Type {
  ExprList = 'exprlist',
  Expr = 'expr',
  /*
   * https://github.com/REditorSupport/languageserver/issues/327
   * https://github.com/REditorSupport/languageserver/pull/328
   */
  ExprHelpAssignWrapper = 'expr_or_assign_or_help',
  Symbol = 'SYMBOL',
  /* will be represented as a number in R */
  Boolean = 'boolean',
  /* this will be a symbol for us */
  Null = 'NULL_CONST',
  Number = 'NUM_CONST', // TODO: support negative numbers
  String = 'STR_CONST',
  BinaryOp = 'binaryop',
  /* can be special operators like %*% or %o% */
  Special = 'SPECIAL',
  // parens will be removed and dealt with as precedences/arguments automatically
  ParenLeft = '(',
  ParenRight = ')',
  BraceLeft = '{',
  BraceRight = '}',
  If = 'IF',
  Else = 'ELSE'
}
export type StringUsedInRCode = string
export enum OperatorArity {
  Unary = 1,
  Binary = 2,
  Both = 3
}

export type OperatorFlavor = 'arithmetic' | 'comparison' | 'logical' | 'assignment'
export type OperatorFlavorInAst = OperatorFlavor | 'special'
export type OperatorWrittenAs = 'infix' | 'prefix'
export type OperatorUsedAs = 'assignment' | 'operation' | 'access'
export type OperatorName = string

export interface OperatorInformationValue extends MergeableRecord {
  name: OperatorName
  stringUsedInRAst: string
  stringUsedInternally: string
  // precedence: number // handled by R
  flavorInRAst: OperatorFlavorInAst
  flavor: OperatorFlavor
  writtenAs: OperatorWrittenAs
  arity: OperatorArity
  usedAs: OperatorUsedAs
}

// TODO: remove flavor separation and use only one (no special)
// TODO: make it complete
/* eslint-disable */
export const OperatorDatabase: Record<StringUsedInRCode, OperatorInformationValue> & MergeableRecord = {
  '+':    { name: 'addition or unary +',          stringUsedInRAst: '+',            stringUsedInternally: '+',    flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Both,   usedAs: 'operation' },
  '-':    { name: 'subtraction or unary -',       stringUsedInRAst: '-',            stringUsedInternally: '-',    flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Both,   usedAs: 'operation' },
  '*':    { name: 'multiplication',               stringUsedInRAst: '*',            stringUsedInternally: '*',    flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '/':    { name: 'division',                     stringUsedInRAst: '/',            stringUsedInternally: '/',    flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '^':    { name: 'exponentiation',               stringUsedInRAst: '^',            stringUsedInternally: '^',    flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  /* no error, R uses ^ to represent ** in the AST */
  '**':   { name: 'alternative exponentiation',   stringUsedInRAst: '^' ,           stringUsedInternally: '**',   flavorInRAst: 'arithmetic', flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%%':   { name: 'modulus',                      stringUsedInRAst: '%%',           stringUsedInternally: '%%',   flavorInRAst: 'special',    flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%/%':  { name: 'integer division',             stringUsedInRAst: '%/%',          stringUsedInternally: '%/%',  flavorInRAst: 'special',    flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%*%':  { name: 'matrix product',               stringUsedInRAst: '%*%',          stringUsedInternally: '%*%',  flavorInRAst: 'special',    flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%o%':  { name: 'outer product',                stringUsedInRAst: '%o%',          stringUsedInternally: '%o%',  flavorInRAst: 'special',    flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%x%':  { name: 'kronecker product',            stringUsedInRAst: '%x%',          stringUsedInternally: '%x%',  flavorInRAst: 'special',    flavor: 'arithmetic',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '==':   { name: 'equal to',                     stringUsedInRAst: 'EQ',           stringUsedInternally: '==',   flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '!=':   { name: 'not equal to',                 stringUsedInRAst: 'NE',           stringUsedInternally: '!=',   flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '>':    { name: 'greater than',                 stringUsedInRAst: 'GT',           stringUsedInternally: '>',    flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '>=':   { name: 'greater than or equal to',     stringUsedInRAst: 'GE',           stringUsedInternally: '>=',   flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '<':    { name: 'less than',                    stringUsedInRAst: 'LT',           stringUsedInternally: '<',    flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '<=':   { name: 'less than or equal to',        stringUsedInRAst: 'LE',           stringUsedInternally: '<=',   flavorInRAst: 'comparison', flavor: 'comparison',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '&':    { name: 'logical and (vectorized)',     stringUsedInRAst: 'AND',          stringUsedInternally: '&',    flavorInRAst: 'logical',    flavor: 'logical',       writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '&&':   { name: 'logical and (non-vectorized)', stringUsedInRAst: 'AND2',         stringUsedInternally: '&&',   flavorInRAst: 'logical',    flavor: 'logical',       writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '|':    { name: 'logical or (vectorized)',      stringUsedInRAst: 'OR',           stringUsedInternally: '|',    flavorInRAst: 'logical',    flavor: 'logical',       writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '||':   { name: 'logical or (not-vectorized)',  stringUsedInRAst: 'OR2',          stringUsedInternally: '||',   flavorInRAst: 'logical',    flavor: 'logical',       writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  '!':    { name: 'unary not',                    stringUsedInRAst: 'NOT',          stringUsedInternally: '!',    flavorInRAst: 'logical',    flavor: 'logical',       writtenAs: 'prefix', arity: OperatorArity.Unary,  usedAs: 'operation' },
  '%in%': { name: 'matching operator',            stringUsedInRAst: '%in%',         stringUsedInternally: '%in%', flavorInRAst: 'special',    flavor: 'logical',       writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'operation' },
  // TODO: clean up flavor? should not be special
  '<-':   { name: 'left assignment',              stringUsedInRAst: 'LEFT_ASSIGN',  stringUsedInternally: '<-',   flavorInRAst: 'special',    flavor: 'assignment',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '<<-':  { name: 'left global assignment',       stringUsedInRAst: 'LEFT_ASSIGN',  stringUsedInternally: '<<-',  flavorInRAst: 'special',    flavor: 'assignment',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '->':   { name: 'right assignment',             stringUsedInRAst: 'RIGHT_ASSIGN', stringUsedInternally: '->',   flavorInRAst: 'special',    flavor: 'assignment',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '->>':  { name: 'right global assignment',      stringUsedInRAst: 'RIGHT_ASSIGN', stringUsedInternally: '->>',  flavorInRAst: 'special',    flavor: 'assignment',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '=':    { name: 'equal assignment',             stringUsedInRAst: 'EQ_ASSIGN',    stringUsedInternally: '=',    flavorInRAst: 'special',    flavor: 'assignment',    writtenAs: 'infix', arity:  OperatorArity.Binary, usedAs: 'assignment' }
}
/* eslint-enable */

export const ArithmeticOperators: readonly string[] = Object.keys(OperatorDatabase).filter(op => OperatorDatabase[op].flavor === 'arithmetic')
// '**' will be treated as '^'
export const ArithmeticOperatorsRAst: readonly string[] = ArithmeticOperators.map(op => OperatorDatabase[op].stringUsedInRAst)

export const ComparisonOperators: readonly string[] = Object.keys(OperatorDatabase).filter(op => OperatorDatabase[op].flavor === 'comparison')
export const ComparisonOperatorsRAst: readonly string[] = ComparisonOperators.map(op => OperatorDatabase[op].stringUsedInRAst)

export const LogicalOperators: readonly string[] = Object.keys(OperatorDatabase).filter(op => OperatorDatabase[op].flavor === 'logical')
export const LogicalOperatorsRAst: readonly string[] = LogicalOperators.map(op => OperatorDatabase[op].stringUsedInRAst)

export const Assignments: readonly string[] = Object.keys(OperatorDatabase).filter(op => OperatorDatabase[op].flavor === 'assignment')
export const AssignmentsRAst: readonly string[] = Assignments.map(op => OperatorDatabase[op].stringUsedInRAst)

export const Operators = [...ArithmeticOperators, ...ComparisonOperators, ...LogicalOperators] as const
export type Operator = typeof Operators[number]

export interface Base<LexemeType = string> extends MergeableRecord {
  type: Type
  /** the original string retrieved from R, can be used for further identification */
  lexeme: LexemeType
}

// TODO: deep readonly variant
interface WithChildren<Children extends Base<string | undefined>> {
  children: Children[]
}

interface Leaf<LexemeType = string> extends Base<LexemeType> {

}

// xmlparsedata uses start and end only to break ties and calculates them on max col width approximation
interface Position {
  line: number
  column: number
}

export interface Range {
  start: Position
  end: Position
}

// TODO: test
export function rangeFrom(line1: number | string, col1: number | string, line2: number | string, col2: number | string): Range {
  // TODO: do we have to ensure ordering?
  return {
    start: { line: Number(line1), column: Number(col1) },
    end: { line: Number(line2), column: Number(col2) }
  }
}

// TODO: test more
export function mergeRanges(...rs: Range[]): Range {
  if (rs.length === 0) {
    throw new Error('Cannot merge no ranges')
  }

  return {
    start: rs.reduce((acc, r) => acc.line < r.start.line || (acc.line === r.start.line && acc.column < r.start.column) ? acc : r.start, rs[0].start),
    end: rs.reduce((acc, r) => acc.line > r.end.line || (acc.line === r.end.line && acc.column > r.end.column) ? acc : r.end, rs[0].end)
  }
}

/**
 * @return > 0 if r1 > r2, < 0 if r1 < r2, 0 if r1 === r2
 */
// TODO: test
export function compareRanges(r1: Range, r2: Range): number {
  if (r1.start.line !== r2.start.line) {
    return r1.start.line - r2.start.line
  } else if (r1.start.column !== r2.start.column) {
    return r1.start.column - r2.start.column
  } else if (r1.end.line !== r2.end.line) {
    return r1.end.line - r2.end.line
  } else {
    return r1.end.column - r2.end.column
  }
}

// TODO: test
export function addRanges(r1: Range, r2: Range): Range {
  return rangeFrom(r1.start.line + r2.start.line, r1.start.column + r2.start.column, r1.end.line + r2.end.line, r1.end.column + r2.end.column)
}

interface Location {
  location: Range
}

export interface RExprList extends WithChildren<RNode>, Base<string | undefined>, Partial<Location> {
  readonly type: Type.ExprList
  readonly content?: string
}

export interface RSymbol<T extends string = string> extends Leaf, Location {
  readonly type: Type.Symbol
  content: T
}

/** includes numeric, integer, and complex */
export interface RNumber extends Leaf, Location {
  readonly type: Type.Number
  content: RNumberValue
}

export interface RLogical extends Leaf, Location {
  readonly type: Type.Boolean
  content: boolean
}

export interface RString extends Leaf, Location {
  readonly type: Type.String
  content: RStringValue
}

export interface RBinaryOp extends Base, Location {
  readonly type: Type.BinaryOp
  readonly flavor: OperatorFlavor
  // TODO: others?
  op: string
  lhs: RNode
  rhs: RNode
}

export interface RLogicalOp extends RBinaryOp {
  flavor: 'logical'
}

export interface RArithmeticOp extends RBinaryOp {
  flavor: 'arithmetic'
}

export interface RComparisonOp extends RBinaryOp {
  flavor: 'comparison'
}

export interface RIfThenElse extends Base, Location {
  readonly type: Type.If
  condition: RNode
  then: RNode
  else?: RNode
}

// TODO: special constants
export type RConstant = RNumber | RString | RLogical | RSymbol<typeof RNull | typeof RNa>

export type RSingleNode = RSymbol | RConstant
export type RNode = RExprList | RIfThenElse | RBinaryOp | RSingleNode

export const ALL_VALID_TYPES = Object.values(Type)
