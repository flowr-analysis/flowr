import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: Type.LineDirective;
	line:          number;
	file:          string;
}
