import { Base, Location, NoInfo } from "../model"
import { Type } from "../type"
import { RParameter } from './RParameter'
import { RExpressionList } from './RExpressionList'

export interface RFunctionDefinition<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.FunctionDefinition;
  /** the R formals, to our knowledge they must be unique */
  parameters:    RParameter<Info>[];
  body:          RExpressionList<Info>;
}
