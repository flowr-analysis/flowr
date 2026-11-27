import type { Column } from '../../../util/range';

/** Where the failing code of a guard reason is, as stored guards keep it: `line:column`, prefixed by `pkg::name:` for one in another function than `self`. */
export const StoredLocation = {
	name: 'StoredLocation',
	format(this: void, { fn, line, column }: { readonly fn: string, readonly line: number, readonly column: Column }, self: string): string {
		return `${fn === self ? '' : fn + ':'}${line}:${column}`;
	},
	/** The location `loc` gives, its function `self` when it names none, and no line for an empty `loc`. */
	parse(this: void, loc: string, self: string): { readonly fn: string, readonly line?: number, readonly column?: Column } {
		const parts = loc.split(':');
		const fn = parts.slice(0, -2).join(':');
		return loc === '' ? { fn: self } : { fn: fn === '' ? self : fn, line: Number(parts.at(-2)), column: Number(parts.at(-1)) };
	},
	/** How a page shows the line of a parsed location after the function: `, line 3:4`, nothing without a line. */
	lineSuffix(this: void, { line, column }: { readonly line?: number, readonly column?: Column }): string[] {
		return line === undefined ? [] : [`, line ${line}:${column}`];
	}
} as const;
