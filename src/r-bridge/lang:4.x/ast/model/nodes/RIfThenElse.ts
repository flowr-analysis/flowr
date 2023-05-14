import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"

export interface RIfThenElse<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.If;
  condition:     RNode<Info>;
  then:          RNode<Info>;
  otherwise?:    RNode<Info>;
}
