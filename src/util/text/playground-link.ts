import { packForUrl, unpackFromUrl } from './url-encoding';
import { uniqueArray } from '../collections/arrays';

/** the parts of the page a mark can point at, rather than a place in the script */
export enum PlaygroundBox {
	/** the program slice the page built for the criterion the cursor sits on */
	Slice = 'slice',
	/** flowR's own repl, which a mark of this name opens as it marks it */
	Repl  = 'repl',
	/** what the dependency query found */
	Deps  = 'deps',
	/** what the linter found */
	Lints = 'lints'
}

/**
 * What a link can point at, written the way flowR names a place in a script:
 *
 * - `12` is the whole line, `12-15` the lines from 12 to 15
 * - `12@sum` is the name `sum` on line 12, `12:5` whatever starts at that column
 * - `lint:<rule>` is everything a linting rule reported, `lint:<rule>@12` its finding on that line
 * - `dep:<kind>` is what the dependency query found of that kind, `dep:<kind>@12` the one on that line
 * - a {@link PlaygroundBox} is one of the boxes of the page itself
 * @see {@link PlaygroundMark.isValid} to check one, {@link PlaygroundMark.compress} to shorten a list
 */
export type PlaygroundMark = `${number}` | `${number}-${number}` | `${number}:${number}` | `${number}@${string}`
	| `lint:${string}` | `dep:${string}` | PlaygroundBox;

/** a mark that stands for a place in the script: a line, a range, a column, or a name on a line */
const CodeMarkPattern = /^\d+(:\d+|-\d+|@.+)?$/;
/** a mark that stands for what an analysis found: `lint:<rule>[@<line>]`, `dep:<kind>[@<line>]` */
const FoundMarkPattern = /^(lint|dep):[^@,]+(@\d+)?$/;
/** how many lines one range may stand for, so a hand-written link cannot ask for a million marks */
const MaxExpandedRange = 500;
/** the longest link the page still opens, and the longest a chat client hands on in one piece */
const MaxSharedLink = 4000;

/**
 * What a fragment carries unescaped: the unreserved characters plus the sub-delimiters a link is still read
 * with, minus `&` and `+`, which mean something of their own here. The `u` flag keeps a character outside the
 * basic plane one match, so escaping never splits a surrogate pair.
 */
const FragmentSafe = /[^A-Za-z0-9\-._~!$'()*,;:@/?=]/gu;

/**
 * The helper object associated with {@link PlaygroundMark}, which makes it easy to check a mark and to
 * keep a list of them as short as a link should be.
 */
export const PlaygroundMark = {
	name: 'PlaygroundMark',
	/**
	 * Checks whether a value has a valid mark syntax. This does not check whether the mark points at
	 * anything: a line past the end of the script is valid and simply marks nothing.
	 */
	isValid(this: void, mark: unknown): mark is PlaygroundMark {
		if(typeof mark !== 'string' || mark.includes(',')) {
			return false;
		}
		return (Object.values(PlaygroundBox) as string[]).includes(mark)
			|| CodeMarkPattern.test(mark) || FoundMarkPattern.test(mark);
	},
	/**
	 * The same marks, as short as they go: without repetition, without what another mark already covers,
	 * and with runs of plain lines written as ranges. A link is read by people as well as by the page,
	 * so this shortens rather than packs.
	 */
	compress(this: void, marks: readonly PlaygroundMark[]): PlaygroundMark[] {
		const kept = uniqueArray(marks.filter(PlaygroundMark.isValid));
		/* `lint:<rule>` stands for each of its findings, so the single ones beside it say nothing more */
		const whole = kept.filter(mark => FoundMarkPattern.test(mark) && !mark.includes('@'));
		const left = kept.filter(mark => !whole.some(all => mark.startsWith(`${all}@`)));
		const lines = left.filter(mark => /^\d+$/.test(mark)).map(Number).sort((a, b) => a - b);
		const ranges: PlaygroundMark[] = [];
		for(let i = 0; i < lines.length;) {
			let end = i;
			while(end + 1 < lines.length && lines[end + 1] === lines[end] + 1) {
				end++;
			}
			ranges.push(end > i ? `${lines[i]}-${lines[end]}` : `${lines[i]}`);
			i = end + 1;
		}
		return [...ranges, ...left.filter(mark => !/^\d+$/.test(mark))];
	},
	/** the inverse of {@link PlaygroundMark.compress}: every range back to the lines it stands for */
	expand(this: void, marks: readonly string[]): PlaygroundMark[] {
		return marks.flatMap((mark): PlaygroundMark[] => {
			const range = /^(\d+)-(\d+)$/.exec(mark);
			if(range === null) {
				return PlaygroundMark.isValid(mark) ? [mark] : [];
			}
			const [from, to] = [Number(range[1]), Number(range[2])];
			return from <= to && to - from < MaxExpandedRange
				? Array.from({ length: to - from + 1 }, (_, i): PlaygroundMark => `${from + i}`)
				: [];
		});
	}
};

/** everything a link can say about the page it opens; whatever is left out the page fills in itself */
export interface PlaygroundLinkParts {
	/** the script the page opens with; left out, the page keeps its own sample */
	readonly code?:       string;
	/** what the page marks when it opens, and what alt-click toggles from there on */
	readonly marks?:      readonly PlaygroundMark[];
	/** the boxes that open folded away, for whatever the example is not about */
	readonly collapsed?:  readonly PlaygroundBox[];
	/** where the cursor lands, as a slicing criterion (`12@sum`, `12:5`) or a bare line */
	readonly at?:         string;
	/** slice forward from the criterion rather than backward */
	readonly forward?:    boolean;
	/** the lines outside the slice step back, as the `dim the rest` box does on the page */
	readonly dim?:        boolean;
	/** the repl is open, rather than folded away under the panes */
	readonly replOpen?:   boolean;
	/** the whole slice is shown, rather than as much of it as the window has room for */
	readonly wholeSlice?: boolean;
	/** the configuration keys that differ from the defaults, as `a.b.c=<json>` */
	readonly config?:     readonly string[];
	/** how wide the code pane is, in percent, and how tall the repl is, in pixels */
	readonly split?:      number;
	readonly repl?:       number;
	/** another deployment of the page, for a local build or a fork */
	readonly base?:       string;
}

/**
 * Everything about flowR's playground that is not the page itself: what a link to it carries, and how
 * one is written. The page reads back exactly what {@link Playground.link} writes.
 * @example
 * ```ts
 * Playground.link({ code: 'x <- 1\nprint(x)', at: '2@x', marks: ['2@x'] });
 * ```
 */
export const Playground = {
	name:    'Playground',
	/** where the page these links point at is served from */
	BaseRef: 'https://flowr-analysis.github.io/flowr/wiki/playground/',
	/** what a link can point at */
	Mark:    PlaygroundMark,
	/** the boxes of the page a mark can point at */
	Box:     PlaygroundBox,
	/**
	 * The link that opens the playground on exactly this: a script, what it points at, where its cursor
	 * sits, and how the page is laid out.
	 */
	link(this: void, parts: PlaygroundLinkParts): string {
		const { code, marks = [], collapsed = [], at, forward, dim, replOpen, wholeSlice, config = [], split, repl } = parts;
		const base = parts.base ?? Playground.BaseRef;
		const fields: [string, string][] = [];
		if(code !== undefined && code.length > 0) {
			fields.push(['c', packForUrl(code)]);
		}
		if(config.length > 0) {
			fields.push(['k', Playground.packConfig(config)]);
		}
		const kept = PlaygroundMark.compress(marks);
		if(kept.length > 0) {
			fields.push(['h', kept.join(',')]);
		}
		const folded = uniqueArray(collapsed).filter(box => (Object.values(PlaygroundBox) as string[]).includes(box));
		if(folded.length > 0) {
			fields.push(['f', folded.join(',')]);
		}
		/* one field for everything about the layout, with the trailing empty parts dropped */
		const view = [
			split === undefined ? '' : String(split),
			repl === undefined ? '' : String(repl),
			`${forward ? '>' : ''}${dim ? 'd' : ''}${replOpen ? 'r' : ''}${wholeSlice ? 'a' : ''}`
		];
		while(view.length > 0 && view[view.length - 1].length === 0) {
			view.pop();
		}
		if(view.length > 0) {
			fields.push(['v', view.join(',')]);
		}
		const position = at === undefined ? undefined
			: code === undefined ? (/^\d+:\d+$/.test(at) ? at : undefined) : Playground.positionOf(code, at);
		if(position !== undefined) {
			fields.push(['p', position]);
		}
		const hash = Playground.hash(fields);
		return hash.length > 0 ? `${base}#${hash}` : base;
	},
	/**
	 * The configuration keys as one field. A key is `a.b.c=<json>`, and the json is brackets, braces and quotes
	 * that a fragment does not carry, so it travels packed like the script rather than as a run of `%5B`.
	 */
	packConfig(this: void, config: readonly string[]): string {
		return packForUrl(config.join(';'));
	},
	/** The keys back out of that field, which older links wrote out plainly and which is read either way. */
	unpackConfig(this: void, field: string | null | undefined): string[] {
		if(!field) {
			return [];
		}
		/* a key carries its `=`, and neither packing produces one, so what has one was written before they did */
		const text = field.includes('=') ? field : unpackFromUrl(field) ?? '';
		return text.split(';').filter(key => key.length > 0);
	},
	/**
	 * Everything a fragment does not carry as itself is escaped, so a configuration's brackets, braces and
	 * quotes travel as `%5B`, `%7B` and `%22` rather than as characters a chat client, a markdown reader or
	 * a terminal cuts the address at. What is left is what {@link FragmentSafe} lists: a fragment is not a
	 * query, so `,`, `:` and `;` stand in it as they are and keep a link readable. `&` and `+` are escaped
	 * beyond that, the first because it separates the fields here and the second because a reader takes it
	 * for a space. A link is also made not to end on punctuation, because that is where a chat client stops
	 * reading it.
	 */
	hash(this: void, fields: readonly (readonly [string, string])[]): string {
		const hash = fields
			.filter(([, value]) => value.length > 0)
			.map(([key, value]) => `${key}=${value.replace(FragmentSafe, character => encodeURIComponent(character))}`)
			.join('&');
		return hash.replace(/[.,:;')]$/, character => encodeURIComponent(character));
	},
	/**
	 * Where a criterion points in the given code, as the `<line>:<column>` the page opens the cursor on.
	 * `12@sum` is the name `sum` in line 12, `12:5` that column, `12` the first name on the line.
	 */
	positionOf(this: void, code: string, criterion: string): string | undefined {
		if(!CodeMarkPattern.test(criterion)) {
			return undefined;
		}
		const cut = criterion.indexOf('@');
		const [lineText, columnText] = (cut < 0 ? criterion : criterion.slice(0, cut)).split(':');
		const name = cut < 0 ? undefined : criterion.slice(cut + 1);
		const line = Number(lineText);
		const text = code.split('\n')[line - 1];
		if(!Number.isInteger(line) || line < 1 || text === undefined) {
			return undefined;
		}
		if(columnText !== undefined) {
			const column = Number(columnText);
			return Number.isInteger(column) && column > 0 ? `${line}:${column}` : undefined;
		}
		const wanted = name ?? /[A-Za-z.][\w._]*/.exec(text)?.[0];
		if(wanted === undefined) {
			return `${line}:1`;
		}
		const at = Playground.nameIndexIn(text, wanted);
		return at === undefined ? undefined : `${line}:${at + 1}`;
	},
	/**
	 * The same script with what is nobody's business taken out: the directories a path names, addresses,
	 * and whatever a name like `token` or `password` was set to. This is what makes a script safe enough
	 * to travel in a bug report, and it is best-effort: it is not a guarantee that nothing private is left.
	 */
	sanitize(this: void, code: string): string {
		return code
			/* a secret is whatever a name says it is, whether or not it looks like one */
			.replace(/\b([\w.]*(?:token|secret|password|passwd|pwd|api[_.]?key|credential)[\w.]*)(\s*(?:<-|=|<<-)\s*)(["'])(?:\\.|(?!\3)[^\\])*\3/gi,
				(_, name: string, arrow: string, quote: string) => `${name}${arrow}${quote}<redacted>${quote}`)
			/* a path says who ran the script and where; the file it names is what the report is about */
			.replace(/(["'])((?:[A-Za-z]:[\\/]|~?\/)(?:\\.|(?!\1)[^\\])*)\1/g, (_, quote: string, path: string) => {
				const name = path.split(/[\\/]/).filter(part => part.length > 0).pop() ?? '';
				return `${quote}<path>/${name}${quote}`;
			})
			.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>');
	},
	/**
	 * The link a bug report carries, or `undefined` when the script is too long to travel in one. What
	 * {@link Playground.sanitize} takes out never enters the link.
	 */
	reportLink(this: void, code: string, parts: Omit<PlaygroundLinkParts, 'code'> = {}): string | undefined {
		const link = Playground.link({ ...parts, code: Playground.sanitize(code) });
		return link.length > MaxSharedLink ? undefined : link;
	},
	/** where a name stands in a line, as a name rather than as a substring of a longer one */
	nameIndexIn(this: void, text: string, name: string): number | undefined {
		for(const found of text.matchAll(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))) {
			const before = text[found.index - 1];
			const after = text[found.index + name.length];
			if(!/[\w._]/.test(before ?? ' ') && !/[\w._]/.test(after ?? ' ')) {
				return found.index;
			}
		}
		return undefined;
	}
};
