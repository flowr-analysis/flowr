import { escapeRegex } from '../../../util/text/strings';
import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { FileRole } from '../../../project/context/flowr-file';
import { FlowrRdFile, FlowrRdMacroFile, type RdMacro, type RdPage } from '../../../project/plugins/file-plugins/files/flowr-rd-file';
import { isExportedInInfo } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RNumber } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import { Identifier } from '../../../dataflow/environments/identifier';
import path from 'path';
import { rootDescriptionFile } from './package-files';
import { type CmdCheckResult, formalNames, packageInfo, topLevelDefinitions } from './cmd-check-util';

/** The sub-check of `R CMD check` a finding belongs to. */
export type DocumentationMismatchKind =
	/** `checking for missing documentation entries`: an exported object without an `\alias` */
	| 'undocumented-object'
	/** `checking for code/documentation mismatches`: the formals of the code and of the `\usage` differ in names or order */
	| 'argument-mismatch'
	/** `checking for code/documentation mismatches`: a default value differs between code and `\usage` */
	| 'default-mismatch'
	/** `checking Rd \usage sections`: a `\usage` argument without an `\item` */
	| 'undocumented-argument'
	/** `checking Rd \usage sections`: an `\item` for an argument the `\usage` does not have */
	| 'documented-argument-not-in-usage'
	/** `checking Rd \usage sections`: a `\usage` function without an `\alias` */
	| 'usage-without-alias';

export interface DocumentationMismatchResult extends CmdCheckResult {
	readonly kind:      DocumentationMismatchKind
	/** the object, function or argument the finding is about */
	readonly name:      string
	/** the Rd file the finding is about, absent for an undocumented object */
	readonly rdFile?:   string
	/** the function whose `\usage` or `\item` is concerned (argument findings) */
	readonly function?: string
}

export interface DocumentationMismatchConfig extends MergeableRecord {
	/** report exported objects no Rd page documents (default `true`) */
	readonly checkUndocumented:    boolean
	/** compare the formals of functions with their `\usage` (default `true`) */
	readonly checkCodoc:           boolean
	/** also compare literal default values, not only argument names and order (default `true`) */
	readonly checkDefaults:        boolean
	/** check the `\arguments` against the `\usage` (default `true`) */
	readonly checkUsage:           boolean
	/** also demand documented arguments in `\keyword{internal}` pages, which `R CMD check` does not (default `false`) */
	readonly checkInternalUsage:   boolean
	/** report the exported objects of a package that has a NAMESPACE but no Rd page at all as undocumented (default `true`) */
	readonly requireDocumentation: boolean
}

export interface DocumentationMismatchMetadata extends MergeableRecord {
	/** exported objects inspected */
	readonly consideredObjects: number
	/** Rd pages inspected */
	readonly consideredPages:   number
}

interface UsageArg {
	readonly name:     string
	readonly default?: string
}

interface UsageCall {
	readonly name:    string
	readonly args:    readonly UsageArg[]
	readonly entry:   string
	/** a replacement usage `f(x) <- value` */
	readonly replace: boolean
}

const Identifier_ = /^[A-Za-z.][\w.]*$/;
const CallHead = /^(`[^`]+`|"[^"]+"|'[^']+'|[A-Za-z.][\w.]*(?:,[^\s(]*-method)?)\s*\(/;
const NamedArg = /^(`[^`]+`|"[^"]*"|[A-Za-z.][\w.]*)\s*=(?!=)\s*([\s\S]*)$/;

function unquote(name: string): string {
	return /^[`"']/.test(name) ? name.slice(1, -1) : name;
}

/** the index of the bracket closing the one at `open`, string-aware */
function closing(text: string, open: number): number | undefined {
	let depth = 0;
	let quote: string | undefined;
	for(let i = open; i < text.length; i++) {
		const c = text[i];
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
		} else if((c === ')' || c === ']' || c === '}') && --depth === 0) {
			return i;
		}
	}
	return undefined;
}

/** splits `text` at the commas outside of brackets and strings */
function splitArgs(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | undefined;
	let from = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
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
		} else if(c === ',' && depth === 0) {
			parts.push(text.slice(from, i));
			from = i + 1;
		}
	}
	parts.push(text.slice(from));
	return parts.map(p => p.trim());
}

/**
 * What a `\usage` entry states: a call (or replacement call) with its arguments, `'ignored'` for a bare variable or
 * a `data()` call, and `undefined` for anything else (operators, indexing, ...), which is not understood.
 */
function parseUsageEntry(entry: string): UsageCall | 'ignored' | undefined {
	const text = entry.trim();
	if(Identifier_.test(text) || /^(`[^`]+`|"[^"]+")$/.test(text)) {
		return 'ignored';
	}
	const head = CallHead.exec(text);
	if(head === null) {
		return undefined;
	}
	const open = head[0].length - 1;
	const close = closing(text, open);
	if(close === undefined) {
		return undefined;
	}
	const rest = text.slice(close + 1).trim();
	const value = rest === '' ? undefined : /^<-\s*([A-Za-z.][\w.]*)$/.exec(rest)?.[1];
	if(rest !== '' && value === undefined) {
		return undefined;
	}
	const name = unquote(head[1]);
	if(name === 'data' && value === undefined) {
		return 'ignored';
	}
	const inner = text.slice(open + 1, close);
	const args: UsageArg[] = [];
	for(const part of inner.trim() === '' ? [] : splitArgs(inner)) {
		if(part === '') {
			continue;
		}
		const named = NamedArg.exec(part);
		if(named !== null) {
			args.push({ name: unquote(named[1]), default: named[2].trim() });
		} else if(Identifier_.test(part) || part === '...') {
			args.push({ name: part });
		} else {
			return undefined;
		}
	}
	if(value !== undefined) {
		args.push({ name: value });
	}
	return { name: value === undefined ? name : name + '<-', args, entry: text, replace: value !== undefined };
}

/** canonical form of a literal default value, `undefined` for anything that is not one */
type Literal = string;

const Escapes: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v' };

/** the value of the content of a string literal, i.e. with its escape sequences resolved */
function unescape(str: string, raw = false): string {
	return raw ? str : str.replace(/\\(.)/gs, (_, c: string) => Escapes[c] ?? c);
}

/** infinite numbers are written `Inf` and `-Inf` in R */
function infinite(num: number): Literal | undefined {
	return num === Infinity ? 'k:Inf' : num === -Infinity ? 'k:-Inf' : undefined;
}

function literalOfCode(node: RNode<ParentInformation> | undefined): Literal | undefined {
	switch(node?.type) {
		case RType.String:  return `s:${unescape(node.content.str, node.content.flag === 'raw')}`;
		case RType.Logical: return `l:${node.content}`;
		case RType.Number:  return infinite(node.content.num) ?? `n:${node.content.num}`;
		case RType.UnaryOp: {
			const num = RNumber.literalValueOf(node);
			return num === undefined ? undefined : infinite(num) ?? `n:${num}`;
		}
		case RType.Symbol: {
			const name = Identifier.getName(node.content);
			return ['NULL', 'NA', 'Inf', 'NaN'].includes(name) ? `k:${name}` : undefined;
		}
		default: return undefined;
	}
}

function literalOfDocs(text: string): Literal | undefined {
	if(/^(["'])[\s\S]*\1$/.test(text)) {
		try {
			const value = RStringValue.fromRLexeme(text);
			return `s:${unescape(value.str, value.flag === 'raw')}`;
		} catch{
			return undefined;
		}
	}
	if(/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?L?$/.test(text)) {
		return `n:${Number(text.replace(/L$/, ''))}`;
	}
	if(text === 'TRUE' || text === 'FALSE') {
		return `l:${text === 'TRUE'}`;
	}
	return ['NULL', 'NA', 'Inf', '-Inf', 'NaN'].includes(text) ? `k:${text}` : undefined;
}

const show = (lit: Literal): string => lit.startsWith('s:') ? JSON.stringify(lit.slice(2)) : lit.slice(2);

/** where in an Rd source the first of `needles` shows up at or after `from` (1-based line and column) */
function findIn(raw: string | undefined, from: RegExp | undefined, needles: readonly RegExp[]): [number, number, number] | undefined {
	if(raw === undefined) {
		return undefined;
	}
	const start = from === undefined ? 0 : Math.max(0, raw.search(from));
	let best: { index: number, length: number } | undefined;
	for(const needle of needles) {
		const m = needle.exec(raw.slice(start));
		if(m !== null && (best === undefined || m.index < best.index)) {
			best = { index: m.index, length: m[0].length };
		}
	}
	if(best === undefined) {
		return undefined;
	}
	const before = raw.slice(0, start + best.index);
	const line = before.split('\n').length;
	return [line, start + best.index - before.lastIndexOf('\n'), best.length];
}

const quoteRe = escapeRegex;

function rdLoc(file: string, raw: string | undefined, from: RegExp | undefined, needles: readonly RegExp[]): SourceLocation {
	const found = findIn(raw, from, needles) ?? findIn(raw, undefined, [/\\usage/]);
	return found === undefined ? [1, 1, 1, 1, file] : [found[0], found[1], found[0], found[1] + Math.max(found[2] - 1, 0), file];
}

/** the spellings an entry name may have in the Rd source: `print.foo` as `\method{print}{foo}` too */
function usageNeedles(name: string): RegExp[] {
	const plain = name.replace(/<-$/, '');
	const needles = [new RegExp(`${quoteRe(plain)}(?=\\s*\\()`)];
	for(let i = plain.indexOf('.', 1); i >= 0; i = plain.indexOf('.', i + 1)) {
		needles.push(new RegExp(`\\\\(?:S3)?method\\{${quoteRe(plain.slice(0, i))}\\}\\{${quoteRe(plain.slice(i + 1))}\\}`));
	}
	return needles;
}

const UsageStart = /\\usage\s*\{/;
const ArgumentsStart = /\\arguments\s*\{/;

/** a function defined at the top level of the package code, by every name it may be called as */
type CodeFunctions = ReadonlyMap<string, RFunctionDefinition<ParentInformation>>;

/** the formals of the function a usage name stands for; `foo.bar<-` may also be the replacement function `foo<-.bar` */
function codeFunctionFor(name: string, fns: CodeFunctions): { name: string, def: RFunctionDefinition<ParentInformation> } | undefined {
	const candidates = [name];
	if(name.endsWith('<-')) {
		const plain = name.slice(0, -2);
		for(let i = plain.indexOf('.', 1); i >= 0; i = plain.indexOf('.', i + 1)) {
			candidates.push(`${plain.slice(0, i)}<-${plain.slice(i)}`);
		}
	}
	for(const c of candidates) {
		const def = fns.get(c);
		if(def !== undefined) {
			return { name: c, def };
		}
	}
	return undefined;
}

function signature(name: string, args: readonly string[]): string {
	return `${name}(${args.join(', ')})`;
}

/**
 * Port of the code/documentation consistency checks of `R CMD check`:
 * - `checking for missing documentation entries` (`tools::undoc`): a code object the package exports (all top-level
 *   objects without a NAMESPACE, else those matched by `export()` and `exportPattern()`) without any Rd `\alias`;
 * - `checking for code/documentation mismatches` (`tools::codoc`): the formal arguments (names and order) of a
 *   top-level function differ from those in its Rd `\usage`, or a default value differs;
 * - `checking Rd \usage sections` (`tools::checkDocFiles`): `\usage` arguments without an `\item` ("Undocumented
 *   arguments"), `\item`s for arguments not in the `\usage` (documented arguments not in the usage), and `\usage`
 *   functions without an `\alias`.
 *
 * Each finding names its sub-check in `kind`. Beyond `R CMD check`, flowR can switch each sub-check off, only
 * compares default values that are literals on both sides, and can demand arguments in internal pages.
 */
export const DOCUMENTATION_MISMATCH = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: [] }),
	processSearchResult: async(_elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const normalize = await data.normalize();
		const results: DocumentationMismatchResult[] = [];
		/* only the package's own man/ counts, not that of packages vendored into it or shipped as test fixtures */
		const description = rootDescriptionFile(ctx);
		const manDir = description === undefined ? undefined : path.join(path.dirname(description.path()), 'man') + path.sep;
		const docFiles = ctx.files.getFilesByRole(FileRole.Documentation)
			.filter(f => manDir === undefined || path.normalize(f.path()).startsWith(manDir));
		const macros = new Map<string, RdMacro>();
		for(const f of docFiles) {
			if(f instanceof FlowrRdMacroFile) {
				for(const [n, m] of f.content()) {
					macros.set(n, m);
				}
			}
		}
		const pages = docFiles.filter(f => f instanceof FlowrRdFile).map(f => ({ file: f, path: f.path(), page: f.pageWith(macros) }));

		const functions = new Map(topLevelDefinitions(normalize, () => true).filter(d => pkg.isPackageCode(d.def.info.file)).map(d => [d.name, d.def]));

		let consideredObjects = 0;
		if(config.checkUndocumented && (pages.length > 0 || (pkg.namespace !== undefined && config.requireDocumentation))) {
			const aliases = new Set(pages.flatMap(p => p.page.aliases));
			const seen = new Set<string>();
			for(const file of normalize.ast.files) {
				if(!pkg.isPackageCode(file.filePath)) {
					continue;
				}
				for(const stmt of file.root.children) {
					if(!RBinaryOp.is(stmt) || !['<-', '=', '<<-'].includes(stmt.operator) || !RSymbol.is(stmt.lhs) && !RString.is(stmt.lhs)) {
						continue;
					}
					const name = RSymbol.is(stmt.lhs) ? Identifier.getName(stmt.lhs.content) : stmt.lhs.content.str;
					const exported = pkg.namespace === undefined || isExportedInInfo(name, { ...pkg.namespace, exportS3Generics: new Map() }) !== false;
					if(seen.has(name) || name.startsWith('.') || !exported) {
						continue;
					}
					seen.add(name);
					consideredObjects++;
					const loc = SourceLocation.fromNode(stmt.lhs);
					if(!aliases.has(name) && loc !== undefined) {
						results.push({
							certainty:  LintingResultCertainty.Certain,
							involvedId: stmt.lhs.info.id,
							loc,
							kind:       'undocumented-object',
							name,
							message:    `Undocumented code object: '${name}'`
						});
					}
				}
			}
		}

		for(const { file, path, page } of pages) {
			const raw = file.rawText();
			const rdName = path.split(/[\\/]/).pop() ?? path;
			checkPage(page, rdName, path, raw, functions, config, results);
		}
		return { results, '.meta': { consideredObjects, consideredPages: pages.length } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Documentation Mismatch',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Documentation, LintingRuleTag.Bug],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds exported objects without documentation, functions whose formals differ from their `\\usage`, and arguments missing from or extra in `\\arguments`.',
		defaultConfig: () => ({
			checkUndocumented:    true,
			checkCodoc:           true,
			checkDefaults:        true,
			checkUsage:           true,
			checkInternalUsage:   false,
			requireDocumentation: true
		})
	}
} as const satisfies LintingRule<DocumentationMismatchResult, DocumentationMismatchMetadata, DocumentationMismatchConfig>;

function checkPage(page: RdPage, rdName: string, path: string, raw: string | undefined, fns: CodeFunctions, config: DocumentationMismatchConfig, out: DocumentationMismatchResult[]): void {
	if(page.usage.length === 0) {
		return;
	}
	const calls: UsageCall[] = [];
	let partial = false;
	for(const entry of page.usage) {
		const parsed = parseUsageEntry(entry);
		if(parsed === undefined) {
			partial = true;
		} else if(parsed !== 'ignored') {
			calls.push(parsed);
		}
	}
	const add = (kind: DocumentationMismatchKind, name: string, message: string, loc: SourceLocation, fn?: string) => {
		out.push({ certainty: LintingResultCertainty.Certain, involvedId: undefined, loc, kind, name, rdFile: rdName, function: fn, message });
	};
	const usageLoc = (call: UsageCall) => rdLoc(path, raw, UsageStart, usageNeedles(call.name));

	if(config.checkCodoc && page.name !== 'defunct' && !page.name.endsWith('-defunct')) {
		for(const call of calls) {
			const code = codeFunctionFor(call.name, fns);
			if(code === undefined) {
				continue;
			}
			const codeNames = formalNames(code.def);
			const docNames = call.args.map(a => a.name);
			if(codeNames.length !== docNames.length || codeNames.some((n, i) => n !== docNames[i])) {
				add('argument-mismatch', call.name, `Codoc mismatches from Rd file '${rdName}': ${signature(call.name, docNames)} in the docs, but ${signature(code.name, codeNames)} in the code`, usageLoc(call), call.name);
				continue;
			}
			if(!config.checkDefaults) {
				continue;
			}
			for(const [i, param] of code.def.parameters.entries()) {
				const docDefault = call.args[i].default;
				if(docDefault === undefined || docDefault === '') {
					continue;
				}
				const inCode = literalOfCode(param.defaultValue);
				const inDocs = literalOfDocs(docDefault);
				const bad = param.defaultValue === undefined ? true : inCode !== undefined && inDocs !== undefined && inCode !== inDocs;
				if(bad) {
					const codeText = param.defaultValue === undefined ? 'no default' : show(inCode as Literal);
					add('default-mismatch', param.name.content, `Mismatches in argument default values for '${call.name}' in Rd file '${rdName}': argument '${param.name.content}' has ${codeText} in the code, but ${docDefault} in the docs`, usageLoc(call), call.name);
				}
			}
		}
	}

	if(!config.checkUsage) {
		return;
	}
	const aliases = new Set(page.aliases);
	if(!page.aliases.every(a => a.endsWith('-deprecated'))) {
		for(const call of calls) {
			if(!aliases.has(call.name)) {
				add('usage-without-alias', call.name, `Objects in \\usage without \\alias in Rd file '${rdName}': '${call.name}'`, usageLoc(call), call.name);
			}
		}
	}
	if(partial) {
		return;
	}
	const usageArgs = new Set(calls.flatMap(c => c.args.map(a => a.name)));
	const reported = new Set<string>();
	const internal = page.keywords.includes('internal');
	if(!internal || config.checkInternalUsage) {
		for(const call of calls) {
			for(const arg of call.args) {
				if(page.arguments.has(arg.name) || reported.has(arg.name)) {
					continue;
				}
				reported.add(arg.name);
				add('undocumented-argument', arg.name, `Undocumented arguments in Rd file '${rdName}': '${arg.name}'`, usageLoc(call), call.name);
			}
		}
	}
	const usageText = page.usage.join('\n').replace(/\\l?dots/g, '...');
	for(const arg of page.arguments.keys()) {
		const simple = /^[\w.]+$/.test(arg);
		if(usageArgs.has(arg) || simple && new RegExp(`(^|\\W)${quoteRe(arg)}($|\\W)`).test(usageText)) {
			continue;
		}
		add('documented-argument-not-in-usage', arg, `Documented arguments not in \\usage in Rd file '${rdName}': '${arg}'`,
			rdLoc(path, raw, ArgumentsStart, [new RegExp(`\\\\item\\s*\\{[^}]*${quoteRe(arg)}[^}]*\\}`)]));
	}
}
