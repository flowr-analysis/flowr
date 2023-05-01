import { Leaf, Location, NoInfo } from '../model'
import { Type } from '../type'
import { RNumberValue } from '../../../values'

/** includes numeric, integer, and complex */
export type RNumber<Info = NoInfo> = {
  readonly type: Type.Number
  content:       RNumberValue
} & Leaf<Info> & Location
