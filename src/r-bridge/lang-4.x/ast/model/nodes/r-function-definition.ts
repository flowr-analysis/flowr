import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RParameter } from './r-parameter';

/**
 * ```r
 * function(<parameters>) <body>
 * ```
 * or:
 * ```r
 * \(<parameters>) <body>
 * ```
 */
export interface RFunctionDefinition<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.FunctionDefinition;
	/** the R formals, to our knowledge, they must be unique */
	parameters:    RParameter<Info>[];
	body:          RNode<Info>;
}

/**
 * Helper for working with {@link RFunctionDefinition} AST nodes.
 */
export const RFunctionDefinition = {
	/**
	 * Type guard for {@link RFunctionDefinition} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RFunctionDefinition<Info> {
		return node?.type === RType.FunctionDefinition;
	}
} as const;