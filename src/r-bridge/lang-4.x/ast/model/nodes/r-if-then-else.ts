import { Base, Location, NoInfo, RNode } from '../model'
import { RType } from '../type'
import { RExpressionList } from './r-expression-list'

export interface RIfThenElse<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.IfThenElse;
	condition:     RNode<Info>;
	then:          RExpressionList<Info>;
	otherwise?:    RExpressionList<Info>;
}
