import { Base, Location, NoInfo, RNode } from '../model'
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
  /** arguments can be undefined, for example when calling as `a(1, ,3)` */
  arguments:        (RNode<Info> | undefined)[];
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
  /** marks function calls like `3 %xxx% 4` which have been written in special infix notation */
  infixSpecial?:    boolean;
  /** arguments can be undefined, for example when calling as `a(1, ,3)` */
  arguments:        (RNode<Info> | undefined)[];
}

export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;
