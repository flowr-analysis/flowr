import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';

/**
 * Retrieve the value from an argument, if it is not empty.
 */
export function unpackArgument<OtherInfo>(arg: RFunctionArgument<OtherInfo>, noNameOnly = true): RNode<OtherInfo> | undefined {
	return arg === EmptyArgument || (noNameOnly && arg.name) ? undefined : arg.value;
}
