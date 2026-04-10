import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { ParentInformation } from '../processing/decorate';
import type { NodeId } from '../processing/node-id';
import type { RFunctionArgument } from './r-function-call';
import { EmptyArgument } from './r-function-call';

/**
 * Represents a named or unnamed argument of a function definition in R.
 */
export interface RArgument<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.Argument;
	/* the name is represented as a symbol to additionally get location information */
	name:          RSymbol<Info> | undefined;
	value:         RNode<Info> | undefined;
}

export interface RUnnamedArgument<Info = NoInfo> extends RArgument<Info> {
	name:  undefined;
	value: RNode<Info>;
}


/**
 * Retrieve the argument with the given id from the list of arguments.
 */
export function getArgumentWithId<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], id: NodeId | undefined): RFunctionArgument<OtherInfo & ParentInformation> | undefined {
	if(id === undefined) {
		return undefined;
	}
	for(const arg of args) {
		if(arg === EmptyArgument) {
			continue;
		}
		if(arg.info.id === id) {
			return arg;
		}
	}
	return undefined;
}