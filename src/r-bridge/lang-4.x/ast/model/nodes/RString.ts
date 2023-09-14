import { Leaf, Location, NoInfo } from "../model"
import { RType } from "../type"
import { RStringValue } from "../../../values"

export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.String;
	content:       RStringValue;
}
