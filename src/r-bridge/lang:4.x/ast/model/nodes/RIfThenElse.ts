import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"

export type RIfThenElse<Info = NoInfo> = {
  readonly type: Type.If;
  condition:     RNode<Info>;
  then:          RNode<Info>;
  otherwise?:    RNode<Info>;
} & Base<Info> &
  Location;
