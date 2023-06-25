import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"

/**
 * Represents an R Indexing operation with `$`, `@`, `[[`, or `[`.
 */
interface RAccessBase<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Access;
  /** the accessed container/variable/expression */
  accessed:      RNode<Info>;
  operand:       '[' | '[[' | '$' | '@';
}

export interface RNamedAccess<Info = NoInfo> extends RAccessBase<Info> {
  operand: '$' | '@';
  access:  string;
}

/** access can be a number, a variable or an expression that resolves to one, a filter etc. */
export interface RIndexAccess<Info = NoInfo> extends RAccessBase<Info> {
  operand: '[' | '[[';
  /** is null if the access is empty, e.g. `a[,3]` */
  access:  (RNode<Info> | null)[]
}

export type RAccess<Info = NoInfo> = RNamedAccess<Info> | RIndexAccess<Info>

