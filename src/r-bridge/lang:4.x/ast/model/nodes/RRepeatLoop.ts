import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from '../type'

/**
 * ```ts
 * repeat <body>
 * ```
 */
export interface RRepeatLoop<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Repeat
  body:          RNode<Info>
}
