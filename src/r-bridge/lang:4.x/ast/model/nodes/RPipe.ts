import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from "../type"

export interface RPipe<Info = NoInfo> extends Base<Info>, Location {
  readonly type: Type.Pipe;
  readonly lhs:  RNode<Info>;
  // TODO: deal with bind x |> . => f(.)
  readonly rhs:  RNode<Info>;
}

