import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from './RSymbol'

export interface RArgument<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Argument;
  name:          RSymbol<Info>;
  defaultValue:  RNode<Info> | undefined;
}
// named "tagged" expressions on call
