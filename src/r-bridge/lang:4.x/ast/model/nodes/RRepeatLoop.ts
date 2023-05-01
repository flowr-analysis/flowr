import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from '../type'

/**
 * ```ts
 * repeat <body>
 * ```
 */
export type RRepeatLoop<Info = NoInfo> = {
  readonly type: Type.Repeat
  body:          RNode<Info>
} & Base<Info> & Location
