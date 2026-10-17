import type { Leaf, Location, NoInfo } from '../model';
import { RNode } from '../model';
import type { RStringValue } from '../../../convert-values';
import { RType } from '../type';
import { SemVer } from 'semver';
import { MIN_VERSION_RAW_STABLE } from '../versions';

export type RQuote = '"' | '\'' | '`';

/**
 * Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
 */
export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.String;
	content:       RStringValue;
}

/**
 * Helper for working with {@link RString} AST nodes.
 */
export const RString = {
	...RNode,
	name: 'RString',
	/**
	 * Type guard for RString nodes.
	 * @lintIgnore node-is node-is-optional
	 * @see {@link RString}
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RString<Info> {
		return node?.type === RType.String;
	},
	/**
	 * Splits off the matching R quotes (double, single, or backtick) wrapping `str`; the `quote` is undefined and the
	 * `content` is `str` itself if there are none. Escapes are not interpreted.
	 * @see {@link RString.unquote} - if only the content matters
	 */
	splitQuotes(this: void, str: string): { readonly quote: RQuote | undefined, readonly content: string } {
		const quote = str[0];
		if(str.length > 1 && (quote === '"' || quote === '\'' || quote === '`') && str[str.length - 1] === quote) {
			return { quote, content: str.slice(1, -1) };
		}
		return { quote: undefined, content: str };
	},
	/**
	 * The text without the R quotes (double, single, or backtick) around it; unchanged if it has none.
	 * @see {@link RString.splitQuotes} - to learn which quote was used
	 */
	unquote(this: void, str: string): string {
		return RString.splitQuotes(str).content;
	},
	/**
	 * Returns the minimum R version that supports raw strings (in a stable format).
	 * @see {@link RString}
	 */
	rawStringAvailableFromRVersion(): SemVer {
		return new SemVer(MIN_VERSION_RAW_STABLE);
	}
};