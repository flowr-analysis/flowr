import type { RawRType } from '../../type';
import { RType } from '../../type';
import type { Location } from '../../model';
import type { MergeableRecord } from '../../../../../../util/objects';

/**
 * Combines '`{`', '`}`', '`(`', '`)`', and other delimiters used by R, they are ignored for most analysis
 * but helpful during reconstruction.
 */
export interface RDelimiter extends MergeableRecord, Location {
	readonly type:    RType.Delimiter;
	readonly lexeme:  string;
	readonly subtype: RawRType;
}

/**
 * Helper for working with {@link RDelimiter} AST nodes.
 */
export const RDelimiter = {
	/**
	 * Type guard for {@link RDelimiter} nodes.
	 */
	is(this: void, node: unknown): node is RDelimiter {
		return typeof node === 'object' && node !== null && 'type' in node && (node as RDelimiter).type === RType.Delimiter;
	}
} as const;