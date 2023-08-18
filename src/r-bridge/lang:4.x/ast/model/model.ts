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
	RParameter,
	RFunctionDefinition,
	RRepeatLoop, RForLoop, RWhileLoop,
	RComment, RFunctionCall, RBreak, RNext,
	RArgument, RNamedAccess, RIndexAccess, RLineDirective
} from './nodes'
import { OtherInfoNode } from './nodes/info'
import { RPipe } from './nodes'

/** simply used as an empty interface with no information about additional decorations */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NoInfo {
}

/**
 * Will be used to reconstruct the source of the given element in the R-ast.
 * This will not be part of most comparisons as it is mainly of interest to the reconstruction of R code.
 */
interface Source {
  /**
   * The range is different from the assigned {@link Location} as it refers to the complete source range covered by the given
   * element.
   * <p>
   * As an example for the difference, consider a for loop, the location of `for` will be just the three characters,
   * but the *range* will be everything including the loop body.
   */
  fullRange?:        SourceRange
  /**
   * Similar to {@link Source.fullRange} this contains the complete R lexeme of the given element.
   */
  fullLexeme?:       string
  additionalTokens?: OtherInfoNode[]
}

/**
 * Provides the common base of all {@link RNode | RNodes}.
 *
 * @typeParam Info       - can be used to store additional information about the node
 * @typeParam LexemeType - the type of the lexeme, probably always a `string` or `string | undefined`
 */
export interface Base<Info, LexemeType = string> extends MergeableRecord {
  type:   Type
  /** the original string retrieved from R, can be used for further identification */
  lexeme: LexemeType
  /** allows to attach additional information to the node */
  info:   Info & Source
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

export type RSingleNode<Info>     = RComment<Info> | RSymbol<Info> | RConstant<Info> | RBreak<Info> | RNext<Info> | RLineDirective<Info>
export type RLoopConstructs<Info> = RForLoop<Info> | RRepeatLoop<Info> | RWhileLoop<Info>
export type RConstructs<Info>     = RLoopConstructs<Info> | RIfThenElse<Info>
export type RFunctions<Info>      = RFunctionDefinition<Info> | RFunctionCall<Info> | RParameter<Info> | RArgument<Info>
export type ROther<Info>          = RComment<Info> | RLineDirective<Info>
export type RNode<Info = NoInfo>  = RExpressionList<Info> | RFunctions<Info>
                                  | ROther<Info> | RConstructs<Info> | RNamedAccess<Info> | RIndexAccess<Info>
                                  | RUnaryOp<Info> | RBinaryOp<Info> | RSingleNode<Info>  | RPipe<Info>

/* TODO: blocked in R

if else repeat while function for in next break
TRUE FALSE NULL Inf NaN
NA NA_integer_ NA_real_ NA_complex_ NA_character_
... ..1 ..2 etc.

*/
