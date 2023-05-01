import { Base, Location, NoInfo, RNode, WithChildren } from "../model"
import { Type } from "../type"

export type RExpressionList<Info = NoInfo> = {
  readonly type:     Type.ExpressionList;
  readonly content?: string;
} & WithChildren<Info, RNode<Info>> &
  Base<Info, string | undefined> &
  Partial<Location>;

