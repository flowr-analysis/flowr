import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from '../type'
import { RSymbol } from './RSymbol'

/**
 * ```ts
 * for(<variable> in <vector>) <body>
 * ```
 */
export type RForLoop<Info = NoInfo> = {
  readonly type: Type.For
  /** variable used in for-loop: <p> `for(<variable> in ...) ...`*/
  variable:      RSymbol<Info>
  /** vector used in for-loop: <p> `for(... in <vector>) ...`*/
  vector:        RNode<Info>
  /** body used in for-loop: <p> `for(... in ...) <body>`*/
  body:          RNode<Info>
} & Base<Info> & Location
