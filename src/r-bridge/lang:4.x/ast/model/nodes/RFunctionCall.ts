import { Base, Location, NoInfo, RNode } from "../model"
import { Type } from "../type"
import { RSymbol } from "./RSymbol"

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
  functionName:     RSymbol<Info>;
  arguments:        RNode<Info>[];
}

export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;
