import fs from 'fs';
import path from 'path';
import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile, FlowrTextFile } from '../../../context/flowr-file';
import { type RObject, type RObjectData, RDAParser, SexpType } from './flowr-rda-file';
import { uniqueArray } from '../../../../util/collections/arrays';

/**
 * One parsed `.Rd` manual page. A page documents every name it lists as an {@link RdPage.aliases|alias}, which is
 * what makes the page (and not the file name) the unit R's help system resolves against.
 */
export interface RdPage {
	/** the `\name{}` of the page, i.e. its topic; the file's basename when the page states none */
	readonly name:      string;
	/** every `\alias{}`: the names this page documents, `plot.foo` and `sin,float32-method` included */
	readonly aliases:   readonly string[];
	/** the `\keyword{}` entries, e.g. `internal`, `datasets`, `manip` */
	readonly keywords:  readonly string[];
	/** the `\docType{}`, e.g. `methods`, `class`, `data`, `package`; absent for an ordinary function page */
	readonly docType?:  string;
	/** the `\title{}` as plain text */
	readonly title?:    string;
	/**
	 * The `\usage{}` block as R code, one entry per usage *expression*: a call broken over several lines is
	 * one entry, and `\method{print}{foo}(x, ...)` reads as the `print.foo(x, ...)` it stands for.
	 */
	readonly usage:     readonly string[];
	/** `\arguments{\item{a, b}{...}}` unfolded to one entry per argument name, mapped to its description */
	readonly arguments: ReadonlyMap<string, string>;
}

/** How a name was matched to its manual page, see {@link RdIndex.topicOf}. */
export const enum RdMatch {
	/** the page lists the name as an `\alias{}` */
	Alias       = 'alias',
	/** the name is a page's `\name{}` */
	Page        = 'page',
	/** a replacement function documented next to its reader, or the other way round (`dim<-` on `dim`) */
	Replacement = 'replacement',
	/** an S4 method documented under its `generic,signature-method` alias, or the generic answering for it */
	S4Method    = 's4-method',
	/** an S3 method with no page of its own, answered by the page of its generic (`print.foo` by `print`) */
	S3Generic   = 's3-generic'
}

/** Which page documents a name, and what made it the answer. */
export interface RdTopicMatch {
	readonly topic: string;
	readonly via:   RdMatch;
}

/**
 * An S4 method alias, `generic,signature-method`: `sin,float32-method`, and the multi-argument signatures the
 * operators take, `[,myclass,ANY,ANY-method`. The generic is everything up to the *first* comma, as no R name
 * holds one, which also keeps the pattern free of the backtracking a lazy prefix would invite.
 */
const S4MethodAlias = /^([^,]+),.*-method$/;

/**
 * The manual of a package: every {@link RdPage} it holds plus the alias-to-topic mapping the pages (or an
 * installed package's `help/AnIndex`) state. Ask it {@link RdIndex.topicOf|which page documents a name} and
 * {@link RdIndex.documents|whether a name is documented at all}.
 */
export class RdIndex {
	/** alias to the topic documenting it */
	private readonly aliases  = new Map<string, string>();
	/** topic to its page, only for the pages that were parsed (an `AnIndex` states no page content) */
	private readonly pages    = new Map<string, RdPage>();
	/** generic name to the topic of an S4 method registered on it, so `sin` finds `sin,float32-method`'s page */
	private readonly s4       = new Map<string, string>();
	/** the distinct topics, grown as aliases arrive so {@link topics} never has to rebuild the union */
	private readonly topicSet = new Set<string>();
	/** topic to its title, from whatever source stated one (`INDEX`, `Meta/Rd.rds`, a page's `\title{}`) */
	private readonly titles   = new Map<string, string>();
	/** memoized {@link topics}, dropped whenever {@link topicSet} grows */
	private topicList: readonly string[] | undefined;

	/** Adds a parsed page with all of its aliases. */
	public add(page: RdPage): this {
		this.pages.set(page.name, page);
		this.alias(page.name, page.name);
		for(const alias of page.aliases) {
			this.alias(alias, page.name);
		}
		if(page.title !== undefined) {
			this.titles.set(page.name, page.title);
		}
		return this;
	}

	/**
	 * Adds the `topic -> title` entries of an `INDEX` or a `demo/00Index`. Such a table states no aliases, so
	 * every topic documents itself and nothing else.
	 */
	public addTopics(entries: Iterable<readonly [string, string]>): this {
		for(const [topic, title] of entries) {
			this.alias(topic, topic);
			if(title.length > 0 && !this.titles.has(topic)) {
				this.titles.set(topic, title);
			}
		}
		return this;
	}

	/** Adds the pages of an installed package's `Meta/Rd.rds`, which states aliases and titles but no content. */
	public addMeta(entries: Iterable<RdMetaEntry>): this {
		for(const entry of entries) {
			this.alias(entry.name, entry.name);
			for(const alias of entry.aliases) {
				this.alias(alias, entry.name);
			}
			if(entry.title !== undefined && !this.titles.has(entry.name)) {
				this.titles.set(entry.name, entry.title);
			}
		}
		return this;
	}

	/** Adds the `alias -> topic` pairs of an installed package's `help/AnIndex`, which lists no page content. */
	public addAliases(mapping: Iterable<readonly [string, string]>): this {
		for(const [alias, topic] of mapping) {
			this.alias(alias, topic);
		}
		return this;
	}

	private alias(alias: string, topic: string): void {
		if(!this.aliases.has(alias)) {
			this.aliases.set(alias, topic);
		}
		if(!this.topicSet.has(topic)) {
			this.topicSet.add(topic);
			this.topicList = undefined;
		}
		const s4 = S4MethodAlias.exec(alias);
		if(s4 && !this.s4.has(s4[1])) {
			this.s4.set(s4[1], topic);
		}
	}

	/** Every topic (page name) the manual knows, in insertion order. */
	public topics(): readonly string[] {
		return this.topicList ??= [...this.topicSet];
	}

	/** The parsed page of `topic`, `undefined` when only its aliases are known (an `AnIndex` without `man/`). */
	public page(topic: string): RdPage | undefined {
		return this.pages.get(topic);
	}

	/** The one-line title of `topic`, `undefined` when no source that stated the topic also stated one. */
	public title(topic: string): string | undefined {
		return this.titles.get(topic);
	}

	/** Whether the manual holds nothing at all, so no answer of it means "undocumented". */
	public get empty(): boolean {
		return this.aliases.size === 0;
	}

	/**
	 * The page documenting `name`, resolved the way R's help system does: its own alias first, then the
	 * fallbacks that let a name share a page -- a replacement function with its reader, an S4 method with its
	 * `generic,signature-method` alias, and an S3 `generic.class` method with the page of its generic
	 * (longest generic first, so `as.data.frame.matrix` tries `as.data.frame` before `as.data`).
	 */
	public topicOf(name: string): RdTopicMatch | undefined {
		const direct = this.aliases.get(name);
		if(direct !== undefined) {
			return { topic: direct, via: this.pages.has(name) && direct === name ? RdMatch.Page : RdMatch.Alias };
		}
		/* `dim<-` is documented on `dim`'s page far more often than on one of its own */
		const swapped = name.endsWith('<-') ? name.slice(0, -2) : name + '<-';
		const replacement = this.aliases.get(swapped);
		if(replacement !== undefined) {
			return { topic: replacement, via: RdMatch.Replacement };
		}
		/* a method the package registered is only documented under its `generic,signature-method` alias */
		const s4 = S4MethodAlias.exec(name);
		const method = s4 ? this.aliases.get(s4[1]) : this.s4.get(name);
		if(method !== undefined) {
			return { topic: method, via: RdMatch.S4Method };
		}
		for(let dot = name.lastIndexOf('.'); dot > 0; dot = name.lastIndexOf('.', dot - 1)) {
			const generic = this.aliases.get(name.slice(0, dot));
			if(generic !== undefined) {
				return { topic: generic, via: RdMatch.S3Generic };
			}
		}
		return undefined;
	}

	/** Whether any page documents `name` (see {@link topicOf} for what counts). */
	public documents(name: string): boolean {
		return this.topicOf(name) !== undefined;
	}

	/**
	 * The manual of the package installed at `dir`, read from its `help/AnIndex`. An installed package ships
	 * no `man/`, so this states the alias-to-topic mapping and no page content.
	 * @param dir - the package's installation directory, i.e. the one holding its `DESCRIPTION`
	 */
	public static fromInstalledPackage(dir: string): RdIndex | undefined {
		const index = path.join(dir, 'help', 'AnIndex');
		if(!fs.existsSync(index)) {
			return undefined;
		}
		try {
			return new RdIndex().addAliases(parseAnIndex(fs.readFileSync(index, 'utf8')));
		} catch{
			return undefined;
		}
	}
}

/** one `alias<TAB>topic` line of an `AnIndex`; anything else in the file is not a pair */
const AnIndexLine = /^(\S+)[ \t]+(\S+)\s*$/;

/**
 * Parses an installed package's `help/AnIndex`: one `alias<TAB>topic` pair per line.
 * @param content - the raw file content
 */
export function parseAnIndex(content: string): [alias: string, topic: string][] {
	const pairs: [string, string][] = [];
	for(const line of content.split(/\r?\n/)) {
		const match = AnIndexLine.exec(line);
		if(match) {
			pairs.push([match[1], match[2]]);
		}
	}
	return pairs;
}

/**
 * Parses R's fixed-width topic table: a package's `INDEX`, and the `00Index` of its `demo/`. Each entry starts
 * in the first column with the topic and continues with its title, which indented lines carry on.
 *
 * An installed package keeps this next to `help/AnIndex`, and a built one keeps it at its root, so it answers
 * what a package documents even where no `man/` sources are around to read.
 * @param content - the raw file content
 */
export function parseRdTopicIndex(content: string): [topic: string, title: string][] {
	const entries: [string, string][] = [];
	for(const line of content.split(/\r?\n/)) {
		if(line.trim().length === 0) {
			continue;
		}
		const previous = entries[entries.length - 1];
		if(Whitespace.test(line[0])) {
			/* an indented line continues the title of the entry above it */
			if(previous !== undefined) {
				previous[1] = `${previous[1]} ${line.trim()}`.trim();
			}
			continue;
		}
		const gap = line.search(Whitespace);
		entries.push(gap < 0 ? [line.trim(), ''] : [line.slice(0, gap), line.slice(gap).trim()]);
	}
	return entries;
}

/**
 * Parses a package's `data/datalist`: which R objects each of its datasets provides. A bare line names a
 * dataset whose object shares its name, a `set: a b c` line one that provides several under other names, which
 * is the only place that mapping is written down.
 * @param content - the raw file content
 */
export function parseDataList(content: string): [dataset: string, objects: readonly string[]][] {
	const sets: [string, readonly string[]][] = [];
	for(const line of content.split(/\r?\n/)) {
		const entry = line.trim();
		if(entry.length === 0) {
			continue;
		}
		const colon = entry.indexOf(':');
		if(colon < 0) {
			sets.push([entry, [entry]]);
			continue;
		}
		const dataset = entry.slice(0, colon).trim();
		const objects = entry.slice(colon + 1).split(Whitespace).map(o => o.trim()).filter(o => o.length > 0);
		sets.push([dataset, objects.length > 0 ? objects : [dataset]]);
	}
	return sets;
}

/**
 * One page of an installed package's `Meta/Rd.rds`, the table R builds its help system from. It states per
 * page what the `man/` sources do -- the topic, its aliases, keywords and title -- so a package that ships
 * only installed answers the same questions one checked out does.
 */
export interface RdMetaEntry {
	/** the `\name{}` of the page */
	readonly name:     string;
	/** the `man/` file it was built from, e.g. `acf.Rd` */
	readonly file?:    string;
	readonly title?:   string;
	/** the `\docType{}`, empty for an ordinary function page */
	readonly type?:    string;
	readonly aliases:  readonly string[];
	readonly keywords: readonly string[];
}

/** the `Meta/Rd.rds` columns, in the order R writes them; `Encoding` and `Concepts` say nothing this needs */
type RdMetaColumn = 'File' | 'Name' | 'Type' | 'Title' | 'Encoding' | 'Aliases' | 'Concepts' | 'Keywords';

/**
 * Reads the `Meta/Rd.rds` data frame an installed package carries into one {@link RdMetaEntry} per page.
 * @param table - the deserialized object, i.e. what {@link RDAParser.parseObject} returns for the file
 */
export function rdMetaOf(table: RObject): RdMetaEntry[] {
	const frame = table as RObjectData;
	const columns = frame?.type === SexpType.VecSxp ? frame.value as RObjectData[] : undefined;
	const names = stringsOf(attributeOf(frame, 'names'));
	if(columns === undefined || names.length !== columns.length) {
		return [];
	}
	const column = (of: RdMetaColumn): RObjectData | undefined => columns[names.indexOf(of)];
	const text = (of: RdMetaColumn): readonly string[] => stringsOf(column(of));
	const lists = (of: RdMetaColumn): readonly RObjectData[] =>
		(column(of)?.value as RObjectData[] | undefined) ?? [];
	const [files, topics, types, titles] = [text('File'), text('Name'), text('Type'), text('Title')];
	const [aliases, keywords] = [lists('Aliases'), lists('Keywords')];
	const entries: RdMetaEntry[] = [];
	for(let row = 0; row < topics.length; row++) {
		if(!topics[row]) {
			continue;   // a page with no name is no topic anyone can ask for
		}
		entries.push({
			name:     topics[row],
			...(files[row] ? { file: files[row] } : {}),
			...(titles[row] ? { title: titles[row] } : {}),
			...(types[row] ? { type: types[row] } : {}),
			aliases:  stringsOf(aliases[row]),
			keywords: stringsOf(keywords[row])
		});
	}
	return entries;
}

/** the value of the R attribute `name`, which hang off an object as a chain of pairlist cells */
function attributeOf(obj: RObjectData | undefined, name: string): RObjectData | undefined {
	let cell = obj?.attributes?.[0];
	while(cell !== undefined) {
		if((cell.tag as RObjectData | undefined)?.name === name) {
			return cell.car as RObjectData | undefined;
		}
		const next = cell.cdr as RObjectData | undefined;
		cell = next?.type === SexpType.ListSxp ? next : undefined;
	}
	return undefined;
}

/** the strings of a character vector, empty for anything that is not one */
function stringsOf(obj: RObjectData | undefined): string[] {
	return obj?.type === SexpType.StrSxp && Array.isArray(obj.value) ? obj.value as string[] : [];
}

/**
 * `text` with its Rd comments removed. A `%` starts one -- in every section, verbatim ones included -- unless
 * it is escaped, and only an *odd* run of backslashes escapes it (`\\%` is a literal backslash followed by a
 * comment). Newlines are kept, as a comment ends at one and the sections care about their line structure.
 */
function stripRdComments(text: string): string {
	let out = '';
	let kept = 0;
	let backslashes = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(c === '%' && backslashes % 2 === 0) {
			out += text.slice(kept, i);
			const nl = text.indexOf('\n', i);
			if(nl < 0) {
				return out;
			}
			kept = nl;   // the newline the comment ends at is not part of it
			i = nl;
		}
		backslashes = c === '\\' ? backslashes + 1 : 0;
	}
	return out + text.slice(kept);
}

/**
 * The body of the brace group starting at `open` (which must index a `{`) and the index just past its `}`,
 * `undefined` when the group is never closed. An escaped brace (`\{`) is content rather than a boundary.
 */
function readGroup(text: string, open: number): { body: string, end: number } | undefined {
	let depth = 0;
	for(let i = open; i < text.length; i++) {
		const c = text[i];
		if(c === '\\') {
			i++;
		} else if(c === '{') {
			depth++;
		} else if(c === '}' && --depth === 0) {
			return { body: text.slice(open + 1, i), end: i + 1 };
		}
	}
	return undefined;
}

/** The bodies of every `\macro{...}` in `text`, in order. `macro` names a literal Rd macro, never user input. */
function macroGroups(text: string, macro: string): string[] {
	const bodies: string[] = [];
	const marker = new RegExp(`\\\\${macro}\\s*\\{`, 'g');
	let match: RegExpExecArray | null;
	while((match = marker.exec(text)) !== null) {
		const group = readGroup(text, match.index + match[0].length - 1);
		if(group === undefined) {
			break;
		}
		bodies.push(group.body);
		marker.lastIndex = group.end;
	}
	return bodies;
}

/** the characters an Rd backslash escapes to their literal selves, rather than starting a macro */
const RdEscapes = new Set(['%', '{', '}', '\\', '&', '$', '#', '_', '^', '~']);
/** the macros that stand for an ellipsis rather than for markup around their argument */
const RdEllipsisMacros = new Set(['dots', 'ldots']);
/**
 * How many of a macro's leading brace groups hold something other than text, and are therefore not rendered:
 * `\Sexpr{}` holds R code the manual builder evaluates, and `\if{}`/`\ifelse{}` open with the output format
 * their text is meant for. Without this the code, and the word `latex`, would end up in a title.
 */
const RdNonTextGroups: ReadonlyMap<string, number> = new Map([['Sexpr', 1], ['if', 1], ['ifelse', 1]]);

/**
 * Rd markup reduced to the text it renders: escapes resolved to the characters they stand for, markup macros
 * (`\code{x}`, `\link[pkg]{x}`, ...) dropped in favor of what they wrap, and whitespace collapsed.
 *
 * The escapes are resolved *while* scanning rather than after dropping the braces, which is what lets an alias
 * that is itself a brace survive: base R documents `{` as `\alias{\{}`, and a pass that stripped the braces
 * first would be left with a stray backslash instead of the name.
 */
function plainText(body: string): string {
	let out = '';
	for(let i = 0; i < body.length; i++) {
		const c = body[i];
		if(c === '{' || c === '}') {
			out += ' ';   // a boundary is no text, but it does separate the words around it
			continue;
		}
		if(c !== '\\') {
			out += c;
			continue;
		}
		const next = body[i + 1];
		if(next !== undefined && RdEscapes.has(next)) {
			out += next;
			i++;
			continue;
		}
		RdMacroName.lastIndex = i + 1;
		const macro = RdMacroName.exec(body)?.[0];
		if(macro === undefined) {
			continue;   // a lone trailing backslash says nothing
		}
		i += macro.length;
		if(RdEllipsisMacros.has(macro)) {
			out += '...';
			continue;
		}
		RdMacroOption.lastIndex = i + 1;
		const option = RdMacroOption.exec(body)?.[0];
		if(option !== undefined) {
			i += option.length;
		}
		for(let group = RdNonTextGroups.get(macro) ?? 0; group > 0; group--) {
			const skipped = readGroupAfter(body, i + 1);
			if(skipped === undefined) {
				break;
			}
			i = skipped.end - 1;
		}
	}
	return out.replace(/\s+/g, ' ').trim();
}

/**
 * The name following a backslash, e.g. the `code` of `\code{x}`. Sticky rather than anchored, so
 * {@link plainText} matches at the position it is at instead of slicing the rest of the body for every macro.
 */
const RdMacroName = /[A-Za-z]+/y;
/** the bracketed option a macro may carry, e.g. the `[pkg]` of `\link[pkg]{fn}`; sticky like {@link RdMacroName} */
const RdMacroOption = /\[[^\]]*\]/y;

const Whitespace = /\s/;

/** The brace group that follows `from`, skipping the whitespace between them; `undefined` when none does. */
function readGroupAfter(text: string, from: number): { body: string, end: number } | undefined {
	let at = from;
	while(at < text.length && Whitespace.test(text[at])) {
		at++;
	}
	return text[at] === '{' ? readGroup(text, at) : undefined;
}

/** `\arguments{ \item{a, b}{...} }` unfolded to one entry per argument name */
function parseArguments(block: string | undefined): Map<string, string> {
	const args = new Map<string, string>();
	if(block === undefined) {
		return args;
	}
	const marker = /\\item\s*\{/g;
	let match: RegExpExecArray | null;
	while((match = marker.exec(block)) !== null) {
		const names = readGroup(block, match.index + match[0].length - 1);
		if(names === undefined) {
			break;
		}
		const description = readGroupAfter(block, names.end);
		marker.lastIndex = description?.end ?? names.end;
		const text = description === undefined ? '' : plainText(description.body);
		/* `\item{x, y}{...}` documents both names with the one description */
		for(const name of names.body.split(',').map(n => plainText(n)).filter(n => n.length > 0)) {
			args.set(name, text);
		}
	}
	return args;
}

/**
 * The `\method{}{}` spellings a usage block may carry, rendered the way R does: `\method{print}{foo}` is the
 * function `print.foo`, and the S4 form is the `generic,signature-method` name its alias uses.
 */
const RdUsageMethod = /\\(S4method|S3method|method)\{([^{}]*)\}\{([^{}]*)\}/g;

/** the `\dots` an Rd usage writes for the `...` parameter */
const RdUsageDots = /\\l?dots(?![A-Za-z])/g;
/** `\special{...}`, which wraps a usage R cannot state as an ordinary call */
const RdUsageSpecial = /\\special\{([^{}]*)\}/g;

/**
 * The usage entries of a `\usage{}` block: R code, one entry per *expression* rather than per line, as a
 * single call may wrap across several. An entry ends where its brackets are balanced again, so a signature
 * broken over three lines stays one usage. The escapes Rd requires (`\%`, `\\`, `\{`) resolve to the
 * characters the code actually holds.
 * @param block - the body of the `\usage{}` macro, `undefined` when the page states none
 */
function parseUsage(block: string | undefined): string[] {
	if(block === undefined) {
		return [];
	}
	const expanded = block
		.replace(RdUsageMethod, (_m, kind: string, generic: string, signature: string) =>
			kind === 'S4method' ? `${generic},${signature}-method` : `${generic}.${signature}`)
		.replace(RdUsageDots, '...')
		.replace(RdUsageSpecial, '$1');
	const entries: string[] = [];
	let current = '';
	let depth = 0;
	for(const line of expanded.split(/\r?\n/)) {
		const code = line.replace(/\\([%{}\\])/g, '$1').trim();
		if(code.length === 0) {
			continue;   // a blank line adds nothing; the bracket depth is what ends an entry
		}
		current = current.length === 0 ? code : `${current} ${code}`;
		depth += bracketDepth(code);
		if(depth <= 0) {
			entries.push(current);
			current = '';
			depth = 0;
		}
	}
	if(current.length > 0) {
		entries.push(current);
	}
	return entries;
}

/** how much `code` opens more brackets than it closes, ignoring what a string literal holds */
function bracketDepth(code: string): number {
	let depth = 0;
	let quote: string | undefined = undefined;
	for(let i = 0; i < code.length; i++) {
		const c = code[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
		} else if(c === '"' || c === '\'' || c === '`') {
			quote = c;
		} else if(c === '(' || c === '[' || c === '{') {
			depth++;
		} else if(c === ')' || c === ']' || c === '}') {
			depth--;
		}
	}
	return depth;
}

/** One `\newcommand` of a `man/macros/` file: the text it stands for, and how many arguments it takes. */
export interface RdMacro {
	/** the highest `#n` the body uses, i.e. how many brace groups a use of the macro carries */
	readonly params: number;
	readonly body:   string;
}

/** Macro name (without its backslash) to what it expands to, see {@link parseRdMacros}. */
export type RdMacros = ReadonlyMap<string, RdMacro>;

/** a `\newcommand`/`\renewcommand` definition, whose two groups are the name and the body */
const RdMacroDefinition = /\\(?:re)?newcommand\s*\{/g;
/** the `#1`..`#9` placeholders a macro body substitutes its arguments into */
const RdMacroParameter = /#([1-9])/g;
/**
 * How often {@link expandRdMacros} rescans its result. A definition may use another definition, but R allows
 * no recursion among them, so a small bound covers every legal file and stops a malformed one from hanging.
 */
const MaxMacroExpansions = 4;

/**
 * Parses the `\newcommand{\name}{body}` definitions of a `man/macros/` file (installed: `help/macros/`).
 * Such a file documents nothing itself; it states markup the package's *pages* use, which is why the pages
 * have to be parsed {@link parseRdPage|with} it to read what they say.
 * @param content - the raw macro file
 */
export function parseRdMacros(content: string): Map<string, RdMacro> {
	const macros = new Map<string, RdMacro>();
	const text = stripRdComments(content);
	RdMacroDefinition.lastIndex = 0;
	let match: RegExpExecArray | null;
	while((match = RdMacroDefinition.exec(text)) !== null) {
		const name = readGroup(text, match.index + match[0].length - 1);
		const body = name === undefined ? undefined : readGroupAfter(text, name.end);
		if(name === undefined || body === undefined) {
			break;
		}
		RdMacroDefinition.lastIndex = body.end;
		/* the name group holds the macro *with* its backslash, as it is written where it is used */
		const declared = /^\s*\\([A-Za-z]+)\s*$/.exec(name.body)?.[1];
		if(declared !== undefined) {
			macros.set(declared, { params: highestMacroParameter(body.body), body: body.body });
		}
	}
	return macros;
}

/** the highest `#n` a macro body uses, which is how many arguments a use of it carries */
function highestMacroParameter(body: string): number {
	let highest = 0;
	RdMacroParameter.lastIndex = 0;
	let match: RegExpExecArray | null;
	while((match = RdMacroParameter.exec(body)) !== null) {
		highest = Math.max(highest, Number(match[1]));
	}
	return highest;
}

/**
 * `text` with every use of a {@link RdMacros|package-defined macro} replaced by what it stands for. A use that
 * does not carry the groups its definition takes is left alone rather than half-applied.
 * @param text   - the Rd source, comments already stripped
 * @param macros - what {@link parseRdMacros} read from the package's macro files
 */
export function expandRdMacros(text: string, macros: RdMacros): string {
	let out = text;
	for(let round = 0; round < MaxMacroExpansions; round++) {
		const next = expandMacrosOnce(out, macros);
		if(next === out) {
			break;
		}
		out = next;
	}
	return out;
}

/** one pass of {@link expandRdMacros}, so a body that itself uses a macro is caught by the next */
function expandMacrosOnce(text: string, macros: RdMacros): string {
	let out = '';
	let kept = 0;
	for(let i = 0; i < text.length; i++) {
		if(text[i] !== '\\') {
			continue;
		}
		RdMacroName.lastIndex = i + 1;
		const name = RdMacroName.exec(text)?.[0];
		if(name === undefined) {
			continue;
		}
		const macro = macros.get(name);
		if(macro === undefined) {
			i += name.length;   // skip the name so its own letters are not rescanned for a backslash
			continue;
		}
		let at = i + 1 + name.length;
		const args: string[] = [];
		for(let arg = 0; arg < macro.params; arg++) {
			const group = readGroupAfter(text, at);
			if(group === undefined) {
				break;
			}
			args.push(group.body);
			at = group.end;
		}
		if(args.length < macro.params) {
			i = at;   // not enough groups to apply it, so this use stays as written
			continue;
		}
		out += text.slice(kept, i) + macro.body.replace(RdMacroParameter, (m, n: string) => args[Number(n) - 1] ?? m);
		kept = at;
		i = at - 1;
	}
	return out + text.slice(kept);
}

/**
 * Parses one `.Rd` manual page.
 * @param content      - the raw page
 * @param fallbackName - the topic to assume when the page states no `\name{}` (usually the file's basename)
 * @param macros       - the package's own `\newcommand`s, so a page using them states what it renders
 */
export function parseRdPage(content: string, fallbackName = '', macros?: RdMacros): RdPage {
	const stripped = stripRdComments(content);
	const text = macros !== undefined && macros.size > 0 ? expandRdMacros(stripped, macros) : stripped;
	const name = macroGroups(text, 'name')[0];
	const title = macroGroups(text, 'title')[0];
	const docType = macroGroups(text, 'docType')[0];
	return {
		name:      name === undefined ? fallbackName : plainText(name),
		aliases:   macroGroups(text, 'alias').map(a => plainText(a)).filter(a => a.length > 0),
		keywords:  macroGroups(text, 'keyword').map(k => plainText(k)).filter(k => k.length > 0),
		...(docType !== undefined ? { docType: plainText(docType) } : {}),
		...(title !== undefined ? { title: plainText(title) } : {}),
		usage:     parseUsage(macroGroups(text, 'usage')[0]),
		arguments: parseArguments(macroGroups(text, 'arguments')[0])
	};
}

/** the topic a page file documents when it states no `\name{}`: its basename without the `.Rd` extension */
function topicOfPath(filePath: string): string {
	return path.basename(filePath).replace(/\.rd$/i, '');
}

/**
 * Decorates a text file to expose its content as the {@link RdPage} it documents.
 * Prefer {@link FlowrRdFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrRdFile extends FlowrFile<RdPage> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): RdPage {
		return parseRdPage(this.wrapped.content().toString(), topicOfPath(this.wrapped.path()));
	}

	/**
	 * The page as {@link content} reads it, but with the package's own `\newcommand`s expanded. A page that
	 * uses none is the cached {@link content} itself; one that does is parsed afresh, as the macros live in
	 * other* files and so cannot be known when this one is loaded on its own.
	 * @param macros - what {@link parseRdMacros} read from the package's `man/macros/` files
	 */
	public pageWith(macros: RdMacros): RdPage {
		return macros.size === 0 ? this.content()
			: parseRdPage(this.wrapped.content().toString(), topicOfPath(this.wrapped.path()), macros);
	}

	/** Lifts a file to a {@link FlowrRdFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrRdFile, role?: FileRole): FlowrRdFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRdFile ? file : new FlowrRdFile(file);
	}
}

/**
 * Decorates an installed package's `help/AnIndex` to expose its `alias -> topic` pairs.
 * Prefer {@link FlowrRdIndexFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrRdIndexFile extends FlowrFile<[alias: string, topic: string][]> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): [string, string][] {
		return parseAnIndex(this.wrapped.content().toString());
	}

	/** Lifts a file to a {@link FlowrRdIndexFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrRdIndexFile, role?: FileRole): FlowrRdIndexFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRdIndexFile ? file : new FlowrRdIndexFile(file);
	}

	/** Reads the `help/AnIndex` of the package installed at `dir` as a file, without touching the disk yet. */
	public static forInstalledPackage(dir: string): FlowrRdIndexFile {
		return new FlowrRdIndexFile(new FlowrTextFile(path.join(dir, 'help', 'AnIndex')));
	}
}

/**
 * Decorates a `man/macros/` file to expose the `\newcommand`s it defines for the package's pages.
 * Prefer {@link FlowrRdMacroFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrRdMacroFile extends FlowrFile<Map<string, RdMacro>> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): Map<string, RdMacro> {
		return parseRdMacros(this.wrapped.content().toString());
	}

	/** Lifts a file to a {@link FlowrRdMacroFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrRdMacroFile, role?: FileRole): FlowrRdMacroFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRdMacroFile ? file : new FlowrRdMacroFile(file);
	}
}

/**
 * Decorates an `INDEX` (or a `demo/00Index`) to expose its `topic -> title` table.
 * Prefer {@link FlowrRdTopicIndexFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrRdTopicIndexFile extends FlowrFile<[topic: string, title: string][]> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): [string, string][] {
		return parseRdTopicIndex(this.wrapped.content().toString());
	}

	/** Lifts a file to a {@link FlowrRdTopicIndexFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrRdTopicIndexFile, role?: FileRole): FlowrRdTopicIndexFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRdTopicIndexFile ? file : new FlowrRdTopicIndexFile(file);
	}
}

/**
 * Decorates an installed package's `Meta/Rd.rds` to expose the help table it serializes.
 * Prefer {@link FlowrRdMetaFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrRdMetaFile extends FlowrFile<RdMetaEntry[]> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): RdMetaEntry[] {
		try {
			return rdMetaOf(new RDAParser(this.wrapped, false).parseObject());
		} catch{
			/* a bundle written by an R newer than the deserializer knows is no reason to fail the analysis */
			return [];
		}
	}

	/** Lifts a file to a {@link FlowrRdMetaFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrRdMetaFile, role?: FileRole): FlowrRdMetaFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRdMetaFile ? file : new FlowrRdMetaFile(file);
	}
}

/**
 * Decorates a `data/datalist` to expose which objects each of a package's datasets provides.
 * Prefer {@link FlowrDataListFile.from}, which avoids re-wrapping and handles roles.
 */
export class FlowrDataListFile extends FlowrFile<[dataset: string, objects: readonly string[]][]> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): [string, readonly string[]][] {
		return parseDataList(this.wrapped.content().toString());
	}

	/** The objects `data(<dataset>)` brings into scope, empty for a dataset this file does not list. */
	public objectsOf(dataset: string): readonly string[] {
		return this.content().find(([name]) => name === dataset)?.[1] ?? [];
	}

	/** Every object any of the package's datasets provides. */
	public objects(): string[] {
		return uniqueArray(this.content().flatMap(([, objects]) => objects));
	}

	/** Lifts a file to a {@link FlowrDataListFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrDataListFile, role?: FileRole): FlowrDataListFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrDataListFile ? file : new FlowrDataListFile(file);
	}
}

/**
 * Collects every loaded manual source into one {@link RdIndex}: the `man/` pages, the `INDEX` tables, an
 * installed package's `help/AnIndex` and `Meta/Rd.rds`. Nothing is cached: pass the result around for as long
 * as you need it rather than asking again per name.
 *
 * The `man/macros/` definitions are gathered first, as a page that uses one only states what it renders once
 * they are known.
 * @param files - the documentation files of the project, i.e. `ctx.files.getFilesByRole(FileRole.Documentation)`
 */
export function rdIndexOf(files: Iterable<FlowrFileProvider>): RdIndex {
	const all = [...files];
	const macros = new Map<string, RdMacro>();
	for(const file of all) {
		if(file instanceof FlowrRdMacroFile) {
			for(const [name, macro] of file.content()) {
				macros.set(name, macro);
			}
		}
	}
	const index = new RdIndex();
	for(const file of all) {
		if(file instanceof FlowrRdFile) {
			index.add(file.pageWith(macros));
		} else if(file instanceof FlowrRdIndexFile) {
			index.addAliases(file.content());
		} else if(file instanceof FlowrRdTopicIndexFile) {
			index.addTopics(file.content());
		} else if(file instanceof FlowrRdMetaFile) {
			index.addMeta(file.content());
		}
	}
	return index;
}
