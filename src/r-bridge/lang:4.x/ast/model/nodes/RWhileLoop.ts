import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from '../type'

/**
 * ```ts
 * while ( <condition> ) <body>
 * ```
 */
export type RWhileLoop<Info = NoInfo> = {
  readonly type: Type.While
  condition:     RNode<Info>
  body:          RNode<Info>
} & Base<Info> & Location
