import { Base, Location, NoInfo, RFunctions, RNode } from '../model'
import { Type } from "../type"
import { RSymbol } from "./RSymbol"
import { RFunctionDefinition } from './RFunctionDefinition'

/**
 * Calls of functions like `a()` and `foo(42, "hello")`.
 *
 * @see RUnnamedFunctionCall
 */
export interface RNamedFunctionCall<Info = NoInfo> extends Base<Info>, Location {
  readonly type:    Type.FunctionCall;
  readonly flavour: 'named';
  functionName:     RSymbol<Info>;
  arguments:        RNode<Info>[];
}


/**
 * Direct calls of functions like `(function(x) { x })(3)`.
 *
 * @see RNamedFunctionCall
 */
export interface RUnnamedFunctionCall<Info = NoInfo> extends Base<Info>, Location {
  readonly type:    Type.FunctionCall;
  readonly flavour: 'unnamed';
  calledFunction:   RNode<Info>; /* can be either a function definition or another call that returns a function etc. */
  arguments:        RNode<Info>[];
}

export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;
