import fs from 'fs';
import path from 'path';
import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile, FlowrTextFile } from '../../../context/flowr-file';

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
	/** memoized {@link topics}, dropped whenever {@link topicSet} grows */
	private topicList: readonly string[] | undefined;

	/** Adds a parsed page with all of its aliases. */
	public add(page: RdPage): this {
		this.pages.set(page.name, page);
		this.alias(page.name, page.name);
		for(const alias of page.aliases) {
			this.alias(alias, page.name);
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
		let at = names.end;
		while(at < block.length && Whitespace.test(block[at])) {
			at++;
		}
		const description = block[at] === '{' ? readGroup(block, at) : undefined;
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

/**
 * Parses one `.Rd` manual page.
 * @param content      - the raw page
 * @param fallbackName - the topic to assume when the page states no `\name{}` (usually the file's basename)
 */
export function parseRdPage(content: string, fallbackName = ''): RdPage {
	const text = stripRdComments(content);
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
 * Collects every loaded manual page and help index into one {@link RdIndex}. Nothing is cached: pass the
 * result around for as long as you need it rather than asking again per name.
 * @param files - the documentation files of the project, i.e. `ctx.files.getFilesByRole(FileRole.Documentation)`
 */
export function rdIndexOf(files: Iterable<FlowrFileProvider>): RdIndex {
	const index = new RdIndex();
	for(const file of files) {
		if(file instanceof FlowrRdFile) {
			index.add(file.content());
		} else if(file instanceof FlowrRdIndexFile) {
			index.addAliases(file.content());
		}
	}
	return index;
}
