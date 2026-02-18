import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { ParentInformation } from '../processing/decorate';
import type { NodeId } from '../processing/node-id';
import type { RFunctionArgument } from './r-function-call';
import { EmptyArgument } from './r-function-call';
import type { BrandedIdentifier } from '../../../../../dataflow/environments/identifier';

/**
 * Represents a named or unnamed argument of a function definition in R.
 */
export interface RArgument<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.Argument;
	/* the name is represented as a symbol to additionally get location information */
	name:          RSymbol<Info, BrandedIdentifier> | undefined;
	value:         RNode<Info> | undefined;
}

/**
 * Represents an unnamed argument of a function definition in R, i.e. an argument without a name.
 * For the helper object, see {@link RArgument.isUnnamed}.
 */
export interface RUnnamedArgument<Info = NoInfo> extends RArgument<Info> {
	name:  undefined;
	value: RNode<Info>;
}

/**
 * Helper for working with {@link RArgument} AST nodes.
 */
export const RArgument = {
	name: 'RArgument',
	/**
	 * Type guard for {@link RArgument} nodes.
	 * @see {@link RArgument.isUnnamed} - to check whether an argument is unnamed
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RArgument<Info> {
		return node?.type === RType.Argument;
	},
	/**
	 * Type guard for named arguments, i.e. arguments with a name.
	 */
	isNamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RArgument<Info> & { name: RSymbol<Info, BrandedIdentifier> } {
		return RArgument.is(node) && node.name !== undefined;
	},
	/**
	 * Type guard for unnamed arguments, i.e. arguments without a name.
	 */
	isUnnamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RUnnamedArgument<Info> {
		return RArgument.is(node) && node.name === undefined && node.value !== undefined;
	},
	/**
	 * Retrieve the argument with the given id from the list of arguments.
	 */
	getWithId<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], id: NodeId | undefined): Exclude<RFunctionArgument<OtherInfo & ParentInformation>, typeof EmptyArgument> | undefined {
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
	},
	/**
	 * Retrieve the value of the argument with the given id from the list of arguments.
	 */
	getValue<OtherInfo>(args: readonly RFunctionArgument<OtherInfo & ParentInformation>[], id: NodeId | undefined): RNode<OtherInfo> | undefined {
		return RArgument.getWithId(args, id)?.value;
	}
} as const;
