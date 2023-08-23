import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from "../type"

export interface RPipe<Info = NoInfo> extends Base<Info>, Location {
	readonly type: Type.Pipe;
	readonly lhs:  RNode<Info>;
	readonly rhs:  RNode<Info>;
}

