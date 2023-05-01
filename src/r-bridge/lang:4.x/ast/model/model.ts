import { SourceRange } from "../../../../util/range"
import { Type } from "./type"
import { MergeableRecord } from "../../../../util/objects"
import { RNa, RNull } from "../../values"
import { RExpressionList } from "./nodes/RExpressionList"
import { RNumber } from "./nodes/RNumber"
import { RSymbol } from "./nodes/RSymbol"
import { RLogical } from "./nodes/RLogical"
import { RString } from "./nodes/RString"
import { RBinaryOp } from "./nodes/RBinaryOp"
import { RUnaryOp } from "./nodes/RUnaryOp"
import { RIfThenElse } from "./nodes/RIfThenElse"
import { RRepeatLoop } from "./nodes/RRepeatLoop"

import { RWhileLoop } from "./nodes/RWhileLoop"
import { RFunctionCall } from "./nodes/RFunctionCall"
import { RForLoop } from "./nodes/RForLoop"
import { RComment } from "./nodes/RComment"

export * from "./nodes/RBinaryOp"
export * from "./nodes/RExpressionList"
export * from "./nodes/RForLoop"
export * from "./nodes/RFunctionCall"
export * from "./nodes/RIfThenElse"
export * from "./nodes/RLogical"
export * from "./nodes/RNumber"
export * from "./nodes/RRepeatLoop"
export * from "./nodes/RString"
export * from "./nodes/RSymbol"
export * from "./nodes/RUnaryOp"
export * from "./nodes/RWhileLoop"
export * from "./nodes/RComment"

/** simply used as an empty interface with no information about additional decorations */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NoInfo {
}

/**
 * @typeParam Info - can be used to store additional information about the node
 */
export type Base<Info = NoInfo, LexemeType = string> = {
  type:   Type
  /** the original string retrieved from R, can be used for further identification */
  lexeme: LexemeType
} & MergeableRecord & Info

export interface WithChildren<Info, Children extends Base<Info, string | undefined>> {
  children: Children[]
}

export type Leaf<Info = NoInfo, LexemeType = string> = Base<Info, LexemeType>

export interface Location {
  location: SourceRange
}

export type NamespaceIdentifier = string

export interface Namespace {
  /* null for unknown atm */
  namespace: NamespaceIdentifier | undefined
}



// TODO: special constants
export type RConstant<Info>       = RNumber<Info> | RString<Info> | RLogical<Info> | RSymbol<Info, typeof RNull | typeof RNa>

export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info>
export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>
export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>
export type RCalls<Info>          = RFunctionCall<Info>
export type ROther<Info>          = RComment<Info>
export type RNode<Info = NoInfo>  = RExpressionList<Info> | ROther<Info> | RCalls<Info> | RConstructs<Info> | RUnaryOp<Info> | RBinaryOp<Info> | RSingleNode<Info>
