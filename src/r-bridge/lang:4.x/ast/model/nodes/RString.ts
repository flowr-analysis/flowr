import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"
import { RStringValue } from "../../../values"

export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
  readonly type: Type.String;
  content:       RStringValue;
}
