// TODO: others?
import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { BinaryOperatorFlavor } from "../operators"

export type RBinaryOp<Info = NoInfo> = {
  readonly type:   Type.BinaryOp;
  readonly flavor: BinaryOperatorFlavor;
  op:              string;
  lhs:             RNode<Info>;
  rhs:             RNode<Info>;
} & Base<Info> &
  Location;

export type RLogicalBinaryOp<Info = NoInfo> = {
  flavor: 'logical'
} & RBinaryOp<Info>

export type RArithmeticBinaryOp<Info = NoInfo> = {
  flavor: 'arithmetic'
} & RBinaryOp<Info>

export type RComparisonBinaryOp<Info = NoInfo> = {
  flavor: 'comparison'
} & RBinaryOp<Info>

export type RAssignmentOp<Info = NoInfo> = {
  flavor: 'assignment'
} & RBinaryOp<Info>
