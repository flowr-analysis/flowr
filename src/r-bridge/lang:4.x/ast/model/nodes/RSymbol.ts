import { Leaf, Location, Namespace, NoInfo } from "../model"
import { Type } from "../type"

export type RSymbol<Info = NoInfo, T extends string = string> = {
  readonly type: Type.Symbol;
  content:       T;
} & Leaf<Info> &
  Namespace &
  Location;
