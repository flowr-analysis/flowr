import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"

export interface RFunctionDefinition<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Function;
  /** the R formals */
  parameters:    RNode<Info>[];
  // TODO: enforce expression list?
  body:          RNode<Info>;
}
