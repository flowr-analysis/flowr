import { Leaf, Location, NoInfo } from "../model"
import { RType } from "../type"

export interface RBreak<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Break;
}
