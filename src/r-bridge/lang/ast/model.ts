import { type MergeableRecord } from '../../../util/objects'
import { type RNa, type RNull, type RNumberValue, type RStringValue } from '../values'

/**
 * Represents the types known by R (i.e., it may contain more or others than the ones we use)
 */
export enum Type {
  ExprList = 'exprlist',
  Expr = 'expr',
  Symbol = 'SYMBOL',
  /* will be represented as a number in R */
  Boolean = 'boolean',
  /* this will be a symbol for us */
  Null = 'NULL_CONST',
  Number = 'NUM_CONST', // TODO: support negative numbers
  String = 'STR_CONST',
  Assignment = 'assignment',
  BinaryOp = 'binaryop',
  /* can be special operators like %*% or %o% */
  Special = 'SPECIAL',
  // parens will be removed and dealt with as precedences/arguments automatically
  ParenLeft = '(',
  ParenRight = ')',
}

export const ArithmeticOperators: readonly string[] = ['+', '-', '*', '/', '^']
export const ComparisonOperators: readonly string[] = ['==', '!=', '<', '>', '<=', '>=']
export const LogicalOperators: readonly string[] = ['&', '&&', '|', '||', '!']

export const SpecialOperators: readonly string[] = ['%o%', '%*%', '%/%', '%in%', '%%']

export const Operators = [...ArithmeticOperators, ...ComparisonOperators, ...LogicalOperators, ...SpecialOperators] as const
export type Operator = typeof Operators[number]

export interface Base extends MergeableRecord {
  type: Type
  // TODO: lexeme: string
}

// TODO: deep readonly variant
interface WithChildren<Children extends Base> extends Base {
  children: Children[]
}

interface Leaf extends Base {

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

export function rangeFrom(line1: number | string, col1: number | string, line2: number | string, col2: number | string): Range {
  return {
    start: { line: Number(line1), column: Number(col1) },
    end: { line: Number(line2), column: Number(col2) }
  }
}

export function mergeRanges(...rs: Range[]): Range {
  if (rs.length === 0) {
    throw new Error('Cannot merge no ranges')
  }

  return {
    start: rs.reduce((acc, r) => acc.line < r.start.line || (acc.line === r.start.line && acc.column < r.start.column) ? acc : r.start, rs[0].start),
    end: rs.reduce((acc, r) => acc.line > r.end.line || (acc.line === r.end.line && acc.column > r.end.column) ? acc : r.end, rs[0].end)
  }
}

interface Location {
  location: Range
}

export interface RExprList extends WithChildren<RNode> {
  readonly type: Type.ExprList
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

export interface RAssignment extends Base, Location {
  readonly type: Type.Assignment
  op: '=' | '<-' | '<<-' | '->' | '->>'
  lhs: RSingleNode
  rhs: RSingleNode
}

export interface RBinaryOp extends Base, Location {
  readonly type: Type.BinaryOp
  readonly flavor: 'arithmetic' | 'comparison' | 'logical'
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

// TODO: special constants
export type RConstant = RNumber | RString | RLogical | RSymbol<typeof RNull | typeof RNa>

export type RSingleNode = RSymbol | RConstant | RBinaryOp | RAssignment
export type RNode = RExprList | RSingleNode

export const ALL_VALID_TYPES = Object.values(Type)
