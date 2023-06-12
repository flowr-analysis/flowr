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
  RArgument,
  RFunctionDefinition,
  RRepeatLoop, RForLoop, RWhileLoop,
  RComment, RFunctionCall, RBreak, RNext
} from './nodes'
import { RDelimiter } from './nodes/RDelimiter'

/** simply used as an empty interface with no information about additional decorations */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NoInfo {
}

/**
 * Provides the common base of all {@link RNode | RNodes}.
 *
 * @typeParam Info       - can be used to store additional information about the node
 * @typeParam LexemeType - the type of the lexeme, probably always a `string` or `string | undefined`
 */
export interface Base<Info, LexemeType = string> extends MergeableRecord{
  type:   Type
  /** the original string retrieved from R, can be used for further identification */
  lexeme: LexemeType
  /** allows to attach additional information to the node */
  info:   Info
}

export interface WithChildren<Info, Children extends Base<Info, string | undefined>> {
  children: Children[]
}

// we want it, so we get better merge-graphs
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Leaf<Info = NoInfo, LexemeType = string> extends Base<Info, LexemeType> {

}

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

export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info> | RBreak<Info> | RNext<Info>
export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>
export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>
export type RFunctions<Info>      = RFunctionDefinition<Info> | RFunctionCall<Info> | RArgument<Info>
export type ROther<Info>          = RComment<Info> | RDelimiter<Info>
export type RNode<Info = NoInfo>  = RExpressionList<Info> | RFunctions<Info>
                                  | ROther<Info> | RConstructs<Info>
                                  | RUnaryOp<Info> | RBinaryOp<Info> | RSingleNode<Info>

/* TODO: blocked in R

if else repeat while function for in next break
TRUE FALSE NULL Inf NaN
NA NA_integer_ NA_real_ NA_complex_ NA_character_
... ..1 ..2 etc.

*/
