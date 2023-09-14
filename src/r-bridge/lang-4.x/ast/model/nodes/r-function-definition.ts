import { Base, Location, NoInfo } from "../model"
import { RType } from "../type"
import { RParameter } from './r-parameter'
import { RExpressionList } from './r-expression-list'

export interface RFunctionDefinition<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.FunctionDefinition;
	/** the R formals, to our knowledge they must be unique */
	parameters:    RParameter<Info>[];
	body:          RExpressionList<Info>;
}
