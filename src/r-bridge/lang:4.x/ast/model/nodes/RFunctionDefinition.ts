import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RArgument } from './RArgument'

export interface RFunctionDefinition<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Function;
  /** the R formals, to our knowledge they must be unique */
  arguments:     RArgument<Info>[];
  // TODO: enforce expression list?
  body:          RNode<Info>;
}
