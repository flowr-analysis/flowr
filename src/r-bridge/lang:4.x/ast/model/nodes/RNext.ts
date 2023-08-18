import { Leaf, Location, NoInfo } from "../model"
import { Type } from "../type"

export interface RNext<Info = NoInfo> extends Location, Leaf<Info> {
    readonly type: Type.Next;
}
