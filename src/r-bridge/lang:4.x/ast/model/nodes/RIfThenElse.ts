import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RExpressionList } from './RExpressionList'

export interface RIfThenElse<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.If;
  condition:     RNode<Info>;
  then:          RExpressionList<Info>;
  otherwise?:    RExpressionList<Info>;
}
