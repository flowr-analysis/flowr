import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RParameter } from './r-parameter';
import type { AstIdMap, ParentInformation } from '../processing/decorate';

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
	...RNode,
	name: 'RFunctionDefinition',
	/**
	 * Type guard for {@link RFunctionDefinition} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RFunctionDefinition<Info> {
		return node?.type === RType.FunctionDefinition;
	},
	/**
	 * Checks whether the given id is part of a function definition, and if so, this returns the id of the
	 * inner-most function definition.
	 * @see {@link RFunctionDefinition.rootFunctionDefinition} - for the outer-most function definition
	 */
	wrappingFunctionDefinition<Info = NoInfo>(this: void, n: RNode<ParentInformation & Info> | undefined, idMap: AstIdMap<ParentInformation & Info>): RFunctionDefinition<ParentInformation & Info> | undefined {
		for(const p of RNode.iterateParents(n, idMap)) {
			if(RFunctionDefinition.is(p)) {
				return p;
			}
		}
		return undefined;
	},
	/**
	 * Checks whether the given id is part of a function definition, and if so, this returns the id of the
	 * outer-most function definition.
	 * @see {@link RFunctionDefinition.wrappingFunctionDefinition} - for the inner-most function definition
	 */
	rootFunctionDefinition<Info = NoInfo>(this: void, n: RNode<ParentInformation & Info> | undefined, idMap: AstIdMap<ParentInformation & Info>): RFunctionDefinition<ParentInformation & Info> | undefined {
		let root: RNode<ParentInformation & Info> | undefined = undefined;
		for(const p of RNode.iterateParents(n, idMap)) {
			if(RFunctionDefinition.is(p)) {
				root = p;
			}
		}
		return root;
	}
} as const;