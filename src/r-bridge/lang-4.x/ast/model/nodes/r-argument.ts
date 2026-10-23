import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { ParentInformation } from '../processing/decorate';
import type { NodeId } from '../processing/node-id';
import type { PotentiallyEmptyRArgument } from './r-function-call';
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
 * @helper ast
 */
export const RArgument = {
	...RNode,
	name: 'RArgument',
	/**
	 * Type guard for {@link RArgument} nodes.
	 * @lintIgnore node-is node-is-optional
	 * @see {@link RArgument.isUnnamed} - to check whether an argument is unnamed
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RArgument<Info> {
		return node?.type === RType.Argument;
	},
	/**
	 * Type guard for arguments that are empty, i.e. {@link EmptyArgument}.
	 */
	isEmpty<Info = NoInfo>(this: void, node: RNode<Info> | typeof EmptyArgument | undefined): node is typeof EmptyArgument {
		return node === EmptyArgument;
	},
	/**
	 * Type guard for arguments that are _not_ empty, i.e. _not_ {@link EmptyArgument}.
	 * It only removes the marker, it does not claim the rest is an {@link RArgument}.
	 * @see {@link RArgument.is} - to additionally check that the node is an argument
	 */
	isNotEmpty<T>(this: void, node: T): node is Exclude<T, typeof EmptyArgument> {
		return node !== EmptyArgument;
	},
	/**
	 * Type guard for named arguments, i.e. arguments with a name.
	 */
	isNamed<Info = NoInfo>(this: void, node: RNode<Info> | typeof EmptyArgument | undefined): node is RArgument<Info> & { name: RSymbol<Info, BrandedIdentifier> } {
		return node !== EmptyArgument && RArgument.is(node) && node.name !== undefined;
	},
	/**
	 * Type guard for unnamed arguments, i.e. arguments without a name.
	 */
	isUnnamed<Info = NoInfo>(this: void, node: RNode<Info> | typeof EmptyArgument | undefined): node is RUnnamedArgument<Info> {
		return node !== EmptyArgument && RArgument.is(node) && node.name === undefined && node.value !== undefined;
	},
	/**
	 * The value of an argument, the node itself for anything else, `undefined` for an empty argument.
	 * @see {@link RArgument.unnamedValueOf} - to only accept unnamed arguments
	 */
	valueOf<Info = NoInfo>(this: void, node: RNode<Info> | typeof EmptyArgument | undefined): RNode<Info> | undefined {
		return node === EmptyArgument ? undefined : RArgument.is(node) ? node.value : node;
	},
	/**
	 * The value of an unnamed argument, `undefined` if the argument is named, empty, or absent.
	 * @see {@link RArgument.valueOf} - to also accept named arguments
	 */
	unnamedValueOf<Info = NoInfo>(this: void, arg: PotentiallyEmptyRArgument<Info> | undefined): RNode<Info> | undefined {
		return arg === EmptyArgument || arg?.name !== undefined ? undefined : arg?.value;
	},
	/**
	 * The value of an unnamed argument, or the argument itself if it is named or empty.
	 * @see {@link RArgument.unnamedValueOf}
	 */
	unnamedValueOrArg<Info = NoInfo>(this: void, arg: PotentiallyEmptyRArgument<Info>): RNode<Info> | PotentiallyEmptyRArgument<Info> {
		return RArgument.unnamedValueOf<Info>(arg) ?? arg;
	},
	/**
	 * The non-empty argument with exactly the given `name`, `undefined` if there is none.
	 */
	findNamed<Info = NoInfo>(this: void, args: readonly PotentiallyEmptyRArgument<Info>[], name: string): RArgument<Info> | undefined {

		return args.find((a): a is RArgument<Info> => a !== EmptyArgument && a.name?.content === name);
	},
	/**
	 * Type guard for arguments with a value, i.e. arguments that are not just placeholders without a value.
	 */
	isWithValue<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RArgument<Info> & { value: RNode<Info> } {
		return RArgument.is(node) && node.value !== undefined;
	},
	getWithId<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], id: NodeId | undefined): Exclude<PotentiallyEmptyRArgument<OtherInfo & ParentInformation>, typeof EmptyArgument> | undefined {
		return id === undefined ? undefined : args.filter(RArgument.isNotEmpty).find(arg => arg.info.id === id);
	},
	/**
	 * Retrieve the value of the argument with the given id from the list of arguments.
	 */
	getValue<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], id: NodeId | undefined): RNode<OtherInfo> | undefined {
		return RArgument.getWithId(args, id)?.value;
	}
} as const;
