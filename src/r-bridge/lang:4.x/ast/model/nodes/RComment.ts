import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export type RComment<Info = NoInfo> = {
  readonly type: Type.Comment;
  content:       string;
} & Leaf<Info> &
  Location;
