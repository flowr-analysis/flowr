import type { Leaf, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';

/**
 * Special comment to signal line mappings (e.g., in generated code) to the interpreter.
 */
export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.LineDirective;
	line:          number;
	file:          string;
}

/**
 * Helper for working with {@link RLineDirective} AST nodes.
 */
export const RLineDirective = {
	name: 'RLineDirective',
	/**
	 * Type guard for {@link RLineDirective} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RLineDirective<Info> {
		return node?.type === RType.LineDirective;
	}
} as const;