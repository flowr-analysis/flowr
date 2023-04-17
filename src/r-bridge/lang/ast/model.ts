import { type MergeableRecord } from '../../../util/objects'
import { type RNa, type RNull, type RNumberValue, type RStringValue } from '../values'
import { BiMap } from '../../../util/bimap'

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

type RToInternalMapping = BiMap<string, string>

export const ArithmeticOperators: readonly string[] = ['+', '-', '*', '/', '^', '**', '%/%', '%*%', '%o%', '%x%'] as const
// '**' will be treated as '^'
export const ArithmeticOperatorsR: readonly string[] = ArithmeticOperators.filter(op => op !== '**')

// arithmetic operations are mapped 1:1 (specials with % are treated differently anyway)
export const ArithmeticOperatorsMapping: RToInternalMapping = new BiMap(ArithmeticOperators.map(op => [op, op === '**' ? '^' : op]))

export const ComparisonOperatorsMapping: RToInternalMapping = new BiMap(Object.entries({
  EQ: '==',
  NE: '!=',
  LT: '<',
  GT: '>',
  LE: '<=',
  GE: '>='
}))

export const ComparisonOperatorsR: readonly string[] = [...ComparisonOperatorsMapping.keys()]
export const ComparisonOperators: readonly string[] = [...ComparisonOperatorsMapping.values()]

export const LogicalOperatorsMapping: RToInternalMapping = new BiMap(Object.entries({
  AND2: '&&',
  AND: '&',
  OR2: '||',
  OR: '|',
  NOT: '!',
  IN: '%in%'
}))

export const LogicalOperatorsR: readonly string[] = [...LogicalOperatorsMapping.keys()]
export const LogicalOperators: readonly string[] = [...LogicalOperatorsMapping.values()]

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

export function rangeFrom(line1: number | string, col1: number | string, line2: number | string, col2: number | string): Range {
  // TODO: do we have to ensure ordering?
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

/**
 * @return > 0 if r1 > r2, < 0 if r1 < r2, 0 if r1 === r2
 */
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

interface Location {
  location: Range
}

export interface RExprList extends WithChildren<RNode>, Base<string | undefined> {
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

export type RBinaryOpFlavor = 'arithmetic' | 'comparison' | 'logical'

export interface RBinaryOp extends Base, Location {
  readonly type: Type.BinaryOp
  readonly flavor: RBinaryOpFlavor
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
