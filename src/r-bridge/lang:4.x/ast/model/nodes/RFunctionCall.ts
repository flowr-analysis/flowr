import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from "./RSymbol"

export interface RFunctionCall<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.FunctionCall;
  functionName:  RSymbol<Info>;
  parameters:    RNode<Info>[];
}
