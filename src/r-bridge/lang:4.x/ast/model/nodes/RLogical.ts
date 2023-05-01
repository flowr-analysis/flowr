import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export type RLogicalValue = boolean;

export type RLogical<Info = NoInfo> = {
  readonly type: Type.Logical
  content:       RLogicalValue
} & Leaf<Info> & Location
