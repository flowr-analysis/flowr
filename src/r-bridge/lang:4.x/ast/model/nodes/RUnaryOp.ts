import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { UnaryOperatorFlavor } from "../operators"

export type RUnaryOp<Info = NoInfo> = {
  readonly type:   Type.UnaryOp;
  readonly flavor: UnaryOperatorFlavor;
  op:              string;
  operand:         RNode<Info>;
} & Base<Info> &
  Location;

export type RLogicalUnaryOp<Info = NoInfo> = {
  flavor: 'logical'
} & RUnaryOp<Info>

export type RArithmeticUnaryOp<Info = NoInfo> = {
  flavor: 'arithmetic'
} & RUnaryOp<Info>
