import fs from 'fs';
import path from 'path';
import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrTextFile, FlowrWrappedFile } from '../../../context/flowr-file';
import { type RObject, type RObjectData, attributeOf, RDAParser, SexpType, stringsOf } from './flowr-rda-file';
import { uniqueArray } from '../../../../util/collections/arrays';
import { isNotUndefined } from '../../../../util/assert';
import { dottedSplits } from '../../../../util/text/strings';
import { compactRecord } from '../../../../util/objects';

/** One parsed `.Rd` manual page; it documents every name it lists as an {@link RdPage.aliases|alias}, not just its file name. */
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
	/** the `\usage{}` block, one entry per usage *expression*, with `\method{print}{foo}(x)` read as `print.foo(x)` */
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

/** an S4 method alias, `sin,float32-method`; the generic is everything up to the first comma, as no R name holds one */
const S4MethodAlias = /^([^,]+),.*-method$/;

/** The manual of a package: its {@link RdPage}s plus the alias-to-topic mapping they (or an installed package's `help/AnIndex`) state. See {@link RdIndex.topicOf} and {@link RdIndex.documents}. */
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
		return this.addPage(page.name, page.aliases, page.title, true);
	}

	/** Adds the pages of an installed package's `Meta/Rd.rds`, which states aliases and titles but no content. */
	public addMeta(entries: Iterable<RdMetaEntry>): this {
		for(const { name, aliases, title } of entries) {
			this.addPage(name, aliases, title);
		}
		return this;
	}

	/** Adds the `topic -> title` entries of an `INDEX` or `demo/00Index`; such a table states no aliases. */
	public addTopics(entries: Iterable<readonly [string, string]>): this {
		for(const [topic, title] of entries) {
			this.addPage(topic, [], title.length > 0 ? title : undefined);
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

	private addPage(topic: string, aliases: readonly string[], title: string | undefined, overwriteTitle = false): this {
		this.alias(topic, topic);
		for(const alias of aliases) {
			this.alias(alias, topic);
		}
		if(title !== undefined && (overwriteTitle || !this.titles.has(topic))) {
			this.titles.set(topic, title);
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

	/** The page documenting `name`, resolved as R's help system does: own alias first, then the fallbacks that let a name share a page (replacement, S4 method, S3 generic; longest generic first). */
	public topicOf(name: string): RdTopicMatch | undefined {
		const direct = this.aliases.get(name);
		if(direct !== undefined) {
			return { topic: direct, via: this.pages.has(name) && direct === name ? RdMatch.Page : RdMatch.Alias };
		}
		/* `dim<-` is documented on `dim`'s page far more often than on one of its own */
		const swapped = this.aliases.get(name.endsWith('<-') ? name.slice(0, -2) : name + '<-');
		if(swapped !== undefined) {
			return { topic: swapped, via: RdMatch.Replacement };
		}
		/* a method the package registered is only documented under its `generic,signature-method` alias */
		const s4 = S4MethodAlias.exec(name);
		const method = s4 ? this.aliases.get(s4[1]) : this.s4.get(name);
		if(method !== undefined) {
			return { topic: method, via: RdMatch.S4Method };
		}
		for(const [prefix] of dottedSplits(name)) {
			const generic = this.aliases.get(prefix);
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

	/** The manual of the package installed at `dir` (the installation directory, holding its `DESCRIPTION`), from its `help/AnIndex`: aliases only, as an installed package ships no `man/`. */
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

/** the non-empty lines of a table file, as the three parsers below all work line by line */
const lines = (content: string): string[] => content.split(/\r?\n/).filter(l => l.trim().length > 0);

/** one `alias<TAB>topic` line of an `AnIndex`; anything else in the file is not a pair */
const AnIndexLine = /^(\S+)[ \t]+(\S+)\s*$/;

/** Parses an installed package's `help/AnIndex`: one `alias<TAB>topic` pair per line. */
export function parseAnIndex(content: string): [alias: string, topic: string][] {
	return lines(content).map(l => AnIndexLine.exec(l)).filter(m => m !== null).map(m => [m[1], m[2]]);
}

/** Parses R's fixed-width topic table (a package's `INDEX`, a `demo/00Index`): the topic starts in the first column, indented lines continue its title. Answers what a package documents where no `man/` sources are. */
export function parseRdTopicIndex(content: string): [topic: string, title: string][] {
	const entries: [string, string][] = [];
	for(const line of lines(content)) {
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

/** Parses a package's `data/datalist`: a bare line names a dataset whose object shares its name, a `set: a b c` line one providing several under other names, which is written down nowhere else. */
export function parseDataList(content: string): [dataset: string, objects: readonly string[]][] {
	return lines(content).map(line => {
		const entry = line.trim();
		const colon = entry.indexOf(':');
		const dataset = colon < 0 ? entry : entry.slice(0, colon).trim();
		const objects = colon < 0 ? [] : entry.slice(colon + 1).split(Whitespace).filter(o => o.length > 0);
		return [dataset, objects.length > 0 ? objects : [dataset]];
	});
}

/** One page of an installed package's `Meta/Rd.rds`: topic, aliases, keywords and title, i.e. what the `man/` sources state, so an installed-only package answers the same questions a checked out one does. */
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

/** Reads the `Meta/Rd.rds` data frame (as {@link RDAParser.parseObject} returns it) into one entry per page. */
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
	/* a page with no name is no topic anyone can ask for */
	return topics.map((name, row) => !name ? undefined : compactRecord({
		name,
		file:     files[row] || undefined,
		title:    titles[row] || undefined,
		type:     types[row] || undefined,
		aliases:  stringsOf(aliases[row]),
		keywords: stringsOf(keywords[row])
	})).filter(isNotUndefined);
}

/** `text` with its Rd comments removed. A `%` starts one in every section unless escaped, and only an *odd* run of backslashes escapes it. Newlines are kept, as a comment ends at one. */
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

/** A brace group: its body and the index just past its closing `}`. */
interface RdGroup {
	readonly body: string;
	readonly end:  number;
}

/** The group starting at `open` (must index a `{`), `undefined` when unclosed; `\{` is content, not a boundary. */
function readGroup(text: string, open: number): RdGroup | undefined {
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

/** The brace group that follows `from`, skipping the whitespace between them; `undefined` when none does. */
function readGroupAfter(text: string, from: number): RdGroup | undefined {
	let at = from;
	while(at < text.length && Whitespace.test(text[at])) {
		at++;
	}
	return text[at] === '{' ? readGroup(text, at) : undefined;
}

/** Every group opened by `marker`, in order, resuming past each so a nested occurrence is not read twice. */
function* groupsAt(text: string, marker: RegExp, from = 0): Generator<RdGroup> {
	marker.lastIndex = from;
	let match: RegExpExecArray | null;
	while((match = marker.exec(text)) !== null) {
		const group = readGroup(text, match.index + match[0].length - 1);
		if(group === undefined) {
			return;
		}
		yield group;
		marker.lastIndex = Math.max(group.end, marker.lastIndex);
	}
}

/** Every `marker`-opened group paired with the group right after it, `undefined` when none follows; resumes past whichever of the two was found so neither is read twice. Shared by {@link parseArguments}'s `\item{names}{description}` and {@link parseRdMacros}'s `\newcommand{name}{body}`, which only differ in what a missing second group means to them. */
function* groupPairsAt(text: string, marker: RegExp): Generator<[first: RdGroup, second: RdGroup | undefined]> {
	for(const first of groupsAt(text, marker)) {
		const second = readGroupAfter(text, first.end);
		yield [first, second];
		marker.lastIndex = second?.end ?? first.end;
	}
}

/** matches a `\macro{` opening at the current {@link RegExp.lastIndex}, i.e. it must be set before every use */
const RdMacroUseAt = /\\([A-Za-z]+)\s*\{/y;

/** one `\macro{body}` a scan found: its name, its body, and the span of its group, see {@link macroGroups}. */
type RdMacroUseFound = [macro: string, body: string, at: number, end: number];

/** The group opening at `open` (must index a `{`), read in the same sweep as every `\macro{...}` nested inside it -- self first, then each child in the order it was found, matching a macro named `name` (`undefined` for a group with no name of its own, e.g. one just used to scope a run of text). `undefined` when the group never closes: nothing found while scanning it is trustworthy then, so the caller gives up on it too. */
function consumeGroup(text: string, open: number, name: string | undefined): { end: number, found: RdMacroUseFound[] } | undefined {
	const bodyStart = open + 1;
	const found: RdMacroUseFound[] = [];
	for(let i = bodyStart; i < text.length; i++) {
		const c = text[i];
		if(c === '{') {
			const child = consumeGroup(text, i, undefined);
			if(child === undefined) {
				return undefined;
			}
			found.push(...child.found);
			i = child.end - 1;
		} else if(c === '}') {
			const self: RdMacroUseFound[] = name === undefined ? [] : [[name, text.slice(bodyStart, i), open, i + 1]];
			return { end: i + 1, found: [...self, ...found] };
		} else if(c === '\\') {
			RdMacroUseAt.lastIndex = i;
			const use = RdMacroUseAt.exec(text);
			if(use === null) {
				i++;   // a lone escape, e.g. `\{` or `\%`, is content, not a boundary
				continue;
			}
			const child = consumeGroup(text, i + use[0].length - 1, use[1]);
			if(child === undefined) {
				return undefined;
			}
			found.push(...child.found);
			i = child.end - 1;
		}
	}
	return undefined;
}

/**
 * The bodies of every `\macro{...}` in `text`, keyed by macro and in order of appearance. A use of a macro
 * inside a recorded group of the same macro is not a second use of it, which is how a per-macro scan reads
 * `\alias{\alias{x}}`; a use of any other macro nested in there is found as usual.
 */
function macroGroups(text: string): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	const recordedUntil = new Map<string, number>();
	for(let i = 0; i < text.length; i++) {
		if(text[i] !== '\\') {
			continue;
		}
		RdMacroUseAt.lastIndex = i;
		const use = RdMacroUseAt.exec(text);
		if(use === null) {
			continue;
		}
		const group = consumeGroup(text, i + use[0].length - 1, use[1]);
		if(group === undefined) {
			break;   // an unclosed group swallows the rest of the page; nothing past it can be trusted
		}
		for(const [macro, body, at, end] of group.found) {
			if(at < (recordedUntil.get(macro) ?? 0)) {
				continue;
			}
			recordedUntil.set(macro, end);
			groups.set(macro, [...groups.get(macro) ?? [], body]);
		}
		i = group.end - 1;
	}
	return groups;
}

/** the characters an Rd backslash escapes to their literal selves, rather than starting a macro */
const RdEscapes = new Set(['%', '{', '}', '\\', '&', '$', '#', '_', '^', '~']);
/** the macros that stand for an ellipsis rather than for markup around their argument */
const RdEllipsisMacros = new Set(['dots', 'ldots']);
/** leading brace groups that hold no text: `\Sexpr{}` holds R code, `\if{}`/`\ifelse{}` open with an output format */
const RdNonTextGroups: ReadonlyMap<string, number> = new Map([['Sexpr', 1], ['if', 1], ['ifelse', 1]]);

/** the name following a backslash, e.g. the `code` of `\code{x}`; sticky so {@link plainText} need not slice */
const RdMacroName = /[A-Za-z]+/y;
/** the bracketed option a macro may carry, e.g. the `[pkg]` of `\link[pkg]{fn}`; sticky like {@link RdMacroName} */
const RdMacroOption = /\[[^\]]*\]/y;

const Whitespace = /\s/;

/** Rd markup reduced to the text it renders: escapes resolved, markup macros dropped in favor of what they wrap, whitespace collapsed. Escapes resolve *while* scanning, which is what lets base R's `\alias{\{}` survive; stripping the braces first would leave a stray backslash instead of the name. */
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

/** the `\item{a, b}` of an `\arguments{}` block, whose group holds the names one description documents */
const RdArgumentItem = /\\item\s*\{/g;

/** `\arguments{ \item{a, b}{...} }` unfolded to one entry per argument name */
function parseArguments(block: string | undefined): Map<string, string> {
	const args = new Map<string, string>();
	if(block === undefined) {
		return args;
	}
	for(const [names, description] of groupPairsAt(block, RdArgumentItem)) {
		const text = description === undefined ? '' : plainText(description.body);
		/* `\item{x, y}{...}` documents both names with the one description */
		for(const name of names.body.split(',').map(n => plainText(n)).filter(n => n.length > 0)) {
			args.set(name, text);
		}
	}
	return args;
}

/** the `\method{}{}` spellings of a usage: `\method{print}{foo}` is `print.foo`, the S4 form its alias name */
const RdUsageMethod = /\\(S4method|S3method|method)\{([^{}]*)\}\{([^{}]*)\}/g;
/** the `\dots` an Rd usage writes for the `...` parameter */
const RdUsageDots = /\\l?dots(?![A-Za-z])/g;
/** `\special{...}`, which wraps a usage R cannot state as an ordinary call */
const RdUsageSpecial = /\\special\{([^{}]*)\}/g;

/** The usage entries of a `\usage{}` block (`block`, `undefined` when the page states none) as R code, one per *expression*: an entry ends where its brackets balance again, so a call wrapped over three lines stays one usage. Rd escapes resolve to their characters. */
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
	for(const line of lines(expanded)) {
		const code = line.replace(/\\([%{}\\])/g, '$1').trim();
		if(code.length === 0) {
			continue;   // a line that is only escapes adds nothing; the bracket depth is what ends an entry
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
/** the name group of a definition holds the macro *with* its backslash, as it is written where it is used */
const RdDeclaredMacro = /^\s*\\([A-Za-z]+)\s*$/;
/** how often {@link expandRdMacros} rescans: a definition may use another, but R allows no recursion among them */
const MaxMacroExpansions = 4;

/** Parses the `\newcommand{\name}{body}` definitions of a `man/macros/` file (installed: `help/macros/`). It documents nothing itself, so pages have to be parsed {@link parseRdPage|with} it to read what they say. */
export function parseRdMacros(content: string): Map<string, RdMacro> {
	const macros = new Map<string, RdMacro>();
	const text = stripRdComments(content);
	for(const [name, body] of groupPairsAt(text, RdMacroDefinition)) {
		if(body === undefined) {
			break;
		}
		const declared = RdDeclaredMacro.exec(name.body)?.[1];
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

/** `text` (the Rd source, comments already stripped) with every use of a package-defined macro replaced by what it stands for, using `macros` (what {@link parseRdMacros} read from the package's macro files); a use carrying fewer groups than its definition takes is left alone rather than half-applied. */
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

/** Parses one `.Rd` manual page: `content` is the raw page, `fallbackName` the topic to assume when the page states no `\name{}` (usually the file's basename), and `macros` the package's own `\newcommand`s, so a page using them states what it renders. */
export function parseRdPage(content: string, fallbackName = '', macros?: RdMacros): RdPage {
	const stripped = stripRdComments(content);
	const text = macros !== undefined && macros.size > 0 ? expandRdMacros(stripped, macros) : stripped;
	const groups = macroGroups(text);
	const one = (macro: string): string | undefined => groups.get(macro)?.[0];
	const many = (macro: string): string[] => (groups.get(macro) ?? []).map(plainText).filter(e => e.length > 0);
	const [name, title, docType] = [one('name'), one('title'), one('docType')];
	return compactRecord({
		name:      name === undefined ? fallbackName : plainText(name),
		aliases:   many('alias'),
		keywords:  many('keyword'),
		docType:   docType === undefined ? undefined : plainText(docType),
		title:     title === undefined ? undefined : plainText(title),
		usage:     parseUsage(one('usage')),
		arguments: parseArguments(one('arguments'))
	});
}

/** the topic a page file documents when it states no `\name{}`: its basename without the `.Rd` extension */
function topicOfPath(filePath: string): string {
	return path.basename(filePath).replace(/\.rd$/i, '');
}

/** Decorates a text file to expose its content as the {@link RdPage} it documents. */
export class FlowrRdFile extends FlowrWrappedFile<RdPage> {
	protected loadContent(): RdPage {
		return this.pageWith();
	}

	/** The page with `macros` (what {@link parseRdMacros} read from the package's `man/macros/` files) expanded. Without any it is the cached {@link content}; with them it is parsed afresh, as the macros live in *other* files this one cannot know when loaded. */
	public pageWith(macros?: RdMacros): RdPage {
		if(macros !== undefined && macros.size === 0) {
			return this.content();
		}
		const file = this.wrapped;
		return parseRdPage(file.content().toString(), topicOfPath(file.path()), macros);
	}
}

/** Decorates an installed package's `help/AnIndex` to expose its `alias -> topic` pairs. */
export class FlowrRdIndexFile extends FlowrWrappedFile<[alias: string, topic: string][]> {
	protected loadContent(): [string, string][] {
		return parseAnIndex(this.wrapped.content().toString());
	}

	/** Reads the `help/AnIndex` of the package installed at `dir` as a file, without touching the disk yet. */
	public static forInstalledPackage(dir: string): FlowrRdIndexFile {
		return new FlowrRdIndexFile(new FlowrTextFile(path.join(dir, 'help', 'AnIndex')));
	}
}

/** Decorates a `man/macros/` file to expose the `\newcommand`s it defines for the package's pages. */
export class FlowrRdMacroFile extends FlowrWrappedFile<Map<string, RdMacro>> {
	protected loadContent(): Map<string, RdMacro> {
		return parseRdMacros(this.wrapped.content().toString());
	}
}

/** Decorates an `INDEX` (or a `demo/00Index`) to expose its `topic -> title` table. */
export class FlowrRdTopicIndexFile extends FlowrWrappedFile<[topic: string, title: string][]> {
	protected loadContent(): [string, string][] {
		return parseRdTopicIndex(this.wrapped.content().toString());
	}
}

/** Decorates an installed package's `Meta/Rd.rds` to expose the help table it serializes. */
export class FlowrRdMetaFile extends FlowrWrappedFile<RdMetaEntry[]> {
	protected loadContent(): RdMetaEntry[] {
		try {
			return rdMetaOf(new RDAParser(this.wrapped, false).parseObject());
		} catch{
			/* a bundle written by an R newer than the deserializer knows is no reason to fail the analysis */
			return [];
		}
	}
}

/** Decorates a `data/datalist` to expose which objects each of a package's datasets provides. */
export class FlowrDataListFile extends FlowrWrappedFile<[dataset: string, objects: readonly string[]][]> {
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
}

/** Collects every loaded manual source of `files` (the project's documentation files, i.e. `ctx.files.getFilesByRole(FileRole.Documentation)`) into one {@link RdIndex}: `man/` pages, `INDEX` tables, an installed package's `help/AnIndex` and `Meta/Rd.rds`. Nothing is cached, so keep the result rather than asking again. The `man/macros/` definitions come first, as a page using one only renders once they are known. */
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
