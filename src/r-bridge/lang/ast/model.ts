import { type MergeableRecord } from '../../../util/objects'

export enum Type {
  ExprList = 'exprlist',
  Expr = 'expr',
  Symbol = 'SYMBOL',
  Number = 'NUM_CONST',
  Assignment = 'assignment'
}

export interface Base extends MergeableRecord {
  type: Type
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

interface Range {
  start: Position
  end: Position
}

interface Location {
  location: Range
}

export interface RExprList extends WithChildren<RNode> {
  readonly type: Type.ExprList
}

export interface RExpr extends WithChildren<RNode>, Location {
  readonly type: Type.Expr
}

export interface RSymbol extends Leaf, Location {
  readonly type: Type.Symbol
  content: string
}

export interface RNumber extends Leaf, Location {
  readonly type: Type.Number
  content: number
}

export interface RAssignment extends Base, Location {
  readonly type: Type.Assignment
  op: '=' | '<-' | '<<-' | '->' | '->>'
  lhs: RExpr
  rhs: RExpr
}

// by default we do not consider exprlist to be part of the internal structure
export type RNode = RExpr | RSymbol | RNumber | RAssignment
export type RAnyNode = RNode | RExprList

export const ALL_VALID_TYPES = Object.values(Type)
