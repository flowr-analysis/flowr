import { Leaf, Location, NoInfo } from '../model'
import { RType } from '../type'
import { RNumberValue } from '../../../values'

/** includes numeric, integer, and complex */
export interface RNumber<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.Number
	content:       RNumberValue
}
