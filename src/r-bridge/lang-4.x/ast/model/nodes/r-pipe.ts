import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import { SemVer } from 'semver';
import { MIN_VERSION_PIPE, MIN_VERSION_PIPE_PLACEHOLDER, MIN_VERSION_PIPE_PLACEHOLDER_EXTRACT } from '../versions';

/**
 * Variant of the binary operator, specifically for the new, built-in pipe operator.
 */
export interface RPipe<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.Pipe;
	readonly lhs:  RNode<Info>;
	readonly rhs:  RNode<Info>;
}

/**
 * Helper for working with {@link RPipe} AST nodes.
 */
export const RPipe = {
	...RNode,
	name: 'RPipe',
	/**
	 * Type guard for {@link RPipe} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RPipe<Info> {
		return node?.type === RType.Pipe;
	},
	/**
	 * Returns the minimum R version that supports the pipe operator.
	 */
	availableFromRVersion(this: void): SemVer {
		return new SemVer(MIN_VERSION_PIPE);
	},
	/**
	 * Returns the minimum R version that supports using the placeholder like '_'.
	 */
	hasPlaceHolderFromRVersion(this: void): SemVer {
		return new SemVer(MIN_VERSION_PIPE_PLACEHOLDER);
	},
	/**
	 * Returns the minimum R version that supports using the placeholder like '_' in access
	 * patterns: `_$a`
	 */
	hasAccessPlaceHolderFromRVersion(this: void): SemVer {
		return new SemVer(MIN_VERSION_PIPE_PLACEHOLDER_EXTRACT);
	}
} as const;