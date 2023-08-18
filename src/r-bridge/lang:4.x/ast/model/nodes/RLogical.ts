import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export type RLogicalValue = boolean;

export interface RLogical<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: Type.Logical
	content:       RLogicalValue
}
