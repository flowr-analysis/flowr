import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export interface RComment<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: Type.Comment;
	content:       string;
}
