import { Leaf, Location, NoInfo, RNode } from '../model'
import { Type } from "../type"

/**
 * Prompts like `? a`
 */
export interface RQuestion<Info = NoInfo> extends Location, Leaf<Info> {
  readonly type: Type.Question;
  asked:         RNode<Info>;
}
