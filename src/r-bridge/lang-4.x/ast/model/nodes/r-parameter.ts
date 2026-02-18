import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { BrandedIdentifier } from '../../../../../dataflow/environments/identifier';

/**
 * Represents a parameter of a function definition in R.
 */
export interface RParameter<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.Parameter;
	/* the name is represented as a symbol to additionally get location information */
	name:          RSymbol<Info, BrandedIdentifier>;
	/** is it the special ... parameter? */
	special:       boolean;
	defaultValue:  RNode<Info> | undefined;
}

/**
 * Helper for working with {@link RParameter} AST nodes.
 */
export const RParameter = {
	name: 'RParameter',
	/**
	 * Type guard for {@link RParameter} nodes.
	 * @see {@link RParameter.isDotDotDotDot} - to check whether a parameter is the special `...` parameter
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RParameter<Info> {
		return node?.type === RType.Parameter;
	},
	/**
	 * Type guard for the special `...` parameter.
	 * @see {@link RParameter.is} - to check whether a node is a parameter at all
	 */
	isDotDotDotDot<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RParameter<Info> {
		return RParameter.is(node) && node.special;
	}
} as const;