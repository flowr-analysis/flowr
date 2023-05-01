import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from "./RSymbol"

export type RFunctionCall<Info = NoInfo> = {
  readonly type: Type.FunctionCall;
  functionName:  RSymbol<Info>;
  parameters:    RNode<Info>[];
} & Base<Info> &
  Location;
