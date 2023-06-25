import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from './RSymbol'

/**
 * Represents an R Indexing operation with `$`, `@`, `[[`, or `[`.
 */
interface RAccessBase<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Access;
  /** the accessed container */
  name:          RSymbol<Info>;
  op:            '[' | '[[' | '$' | '@';
}

export interface RNamedAccess<Info = NoInfo> extends RAccessBase<Info> {
  op:     '$' | '@';
  access: string;
}

/** access can be a number, a variable or an expression that resolves to one, a filter etc. */
export interface RIndexAccess<Info = NoInfo> extends RAccessBase<Info> {
  op:     '[' | '[[';
  access: RNode<Info>[]
}

export type RAccess<Info = NoInfo> = RNamedAccess<Info> | RIndexAccess<Info>

