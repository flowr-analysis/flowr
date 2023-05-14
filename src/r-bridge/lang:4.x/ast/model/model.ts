import { SourceRange } from "../../../../util/range"
import { Type } from "./type"
import { MergeableRecord } from "../../../../util/objects"
import { RNa, RNull } from "../../values"
import {
  RExpressionList,
  RNumber,
  RSymbol,
  RLogical,
  RString,
  RBinaryOp,
  RUnaryOp,
  RIfThenElse,
  RRepeatLoop, RForLoop, RWhileLoop,
  RComment, RFunctionCall
} from './nodes'

/** simply used as an empty interface with no information about additional decorations */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NoInfo {
}

/**
 * Provides the common base of all {@link RNode | RNodes}.
 * <p>
 * TODO: allow to enforce information to be present
 *
 * @typeParam Info - can be used to store additional information about the node
 * @typeParam LexemeType - the type of the lexeme, probably always a string or `string | undefined`
 */
export interface Base<Info, LexemeType = string> extends MergeableRecord{
  type:   Type
  /** the original string retrieved from R, can be used for further identification */
  lexeme: LexemeType
  /** allows to attach additional information to the node */
  info?:  Info
}

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

export type RNodeWithInfo<Info> = RNode<Info> & { info: Info }
