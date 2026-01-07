import { type RFunctionArgument , EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';

/**
 * Retrieve the value from an argument, if it is not empty.
 * @see {@link unpackArg} - to specifically retrieve non-named arguments
 */
export function unpackNonameArg<OtherInfo>(arg: RFunctionArgument<OtherInfo> | undefined): RNode<OtherInfo> | undefined {
	return arg === EmptyArgument || arg?.name !== undefined ? undefined : arg?.value;
}

/**
 * Retrieve the value from a non-named argument, if it is not empty.
 * @see {@link unpackNonameArg} - to specifically retrieve non-named arguments
 */
export function unpackArg<OtherInfo>(arg: RFunctionArgument<OtherInfo> | undefined): RNode<OtherInfo> | undefined {
	return arg === EmptyArgument ? undefined : arg?.value;
}

/**
 * Try to unpack the given argument, if it is not empty.
 */
export function tryUnpackNoNameArg<OtherInfo>(arg: RFunctionArgument<OtherInfo>): RNode<OtherInfo> | RFunctionArgument<OtherInfo> {
	return unpackNonameArg<OtherInfo>(arg) ?? arg;
}