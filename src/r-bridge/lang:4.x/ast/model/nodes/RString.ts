import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"
import { RStringValue } from "../../../values"

export type RString<Info = NoInfo> = {
  readonly type: Type.String;
  content:       RStringValue;
} & Leaf<Info> &
  Location;
