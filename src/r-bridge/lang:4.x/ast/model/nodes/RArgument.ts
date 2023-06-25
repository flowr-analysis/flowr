import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from './RSymbol'

/**
 * Represents a named or unnamed argument of a function definition in R.
 */
export interface RArgument<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Argument;
  /* the name is represented as a symbol to additionally get location information */
  name:          RSymbol<Info> | undefined;
  value:         RNode<Info>;
}
