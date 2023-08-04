import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { UnaryOperatorFlavor } from "../operators"

export interface RUnaryOp<Info = NoInfo> extends Base<Info>, Location {
  readonly type:   Type.UnaryOp;
  readonly flavor: UnaryOperatorFlavor;
  operator:        string;
  operand:         RNode<Info>;
}

export interface RLogicalUnaryOp<Info = NoInfo> extends RUnaryOp<Info> {
  flavor: 'logical'
}

export interface RArithmeticUnaryOp<Info = NoInfo> extends RUnaryOp<Info> {
  flavor: 'arithmetic'
}

export interface RModelFormulaUnaryOp<Info = NoInfo> extends RUnaryOp<Info> {
  flavor: 'model formula'
}

