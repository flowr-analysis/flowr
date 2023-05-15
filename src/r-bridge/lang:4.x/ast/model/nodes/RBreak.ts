import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export interface RBreak<Info = NoInfo> extends Location, Leaf<Info> {
  readonly type: Type.Break;
}
