import { Leaf, Location, Namespace, NoInfo } from "../model"
import { Type } from "../type"

export interface RSymbol<Info = NoInfo, T extends string = string> extends Leaf<Info>, Namespace, Location {
  readonly type: Type.Symbol;
  content:       T;
}
