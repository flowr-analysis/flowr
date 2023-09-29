import { Leaf, Location, NoInfo } from '../model'
import { RType } from '../type'

export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.LineDirective;
	line:          number;
	file:          string;
}
