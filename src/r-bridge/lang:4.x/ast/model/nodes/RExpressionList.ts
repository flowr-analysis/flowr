import { Base, Location, NoInfo, RNode, WithChildren } from "../model"
import { Type } from "../type"

export interface RExpressionList<Info = NoInfo> extends WithChildren<Info, RNode<Info>>, Base<Info, string | undefined>, Partial<Location> {
	readonly type:     Type.ExpressionList;
	readonly content?: string;
}

