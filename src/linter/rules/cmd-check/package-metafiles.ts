import path from 'path';
import type { SyntaxNode } from 'web-tree-sitter';
import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { RFunctionCall, EmptyArgument, type PotentiallyEmptyRArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { MatchArgs } from '../../../dataflow/graph/match-args';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../../../dataflow/environments/identifier';
import { type CmdCheckResult, packageInfo, projectNodes } from './cmd-check-util';
import { type PackageFiles, packageFiles } from './package-files';

/** what is wrong with a package file, named after the `R CMD check` finding it corresponds to */
export type PackageMetafilesKind =
	| 'empty-index'
	| 'empty-demo-index'
	| 'undocumented-demo'
	| 'missing-demo'
	| 'citation-syntax'
	| 'citation-entry-type'
	| 'citation-missing-field'
	| 'citation-location'
	| 'citation-superseded'
	| 'relative-link';

export interface PackageMetafilesResult extends CmdCheckResult {
	readonly kind: PackageMetafilesKind
	/** the package file the finding is about, relative to the package root */
	readonly file: string
}

export interface PackageMetafilesConfig extends MergeableRecord {
	/** check the `INDEX` and the `demo/00Index` of the package (default `true`) */
	readonly index:         boolean
	/** check `inst/CITATION` (its syntax, entry types and required fields) and the location of other CITATION files (default `true`) */
	readonly citation:      boolean
	/** report the citation functions superseded by a newer one, which `R CMD check` accepts (default `true`) */
	readonly superseded:    boolean
	/** check that the relative links of the README, NEWS and vignettes point to files of the package (default `true`) */
	readonly relativeLinks: boolean
}

export interface PackageMetafilesMetadata extends MergeableRecord {
	/** the package files whose content was inspected */
	readonly checkedFiles: number
}

/** the `BibTeX` entry types `R CMD check` knows, with their required fields (alternatives joined by `|`) */
const BibTeXRequiredFields: ReadonlyMap<string, readonly string[]> = new Map(Object.entries({
	article:       ['author', 'title', 'journal', 'year'],
	book:          ['author|editor', 'title', 'publisher', 'year'],
	booklet:       ['title'],
	inbook:        ['author|editor', 'title', 'chapter', 'publisher', 'year'],
	incollection:  ['author', 'title', 'booktitle', 'publisher', 'year'],
	inproceedings: ['author', 'title', 'booktitle', 'year'],
	manual:        ['title'],
	mastersthesis: ['author', 'title', 'school', 'year'],
	misc:          [],
	phdthesis:     ['author', 'title', 'school', 'year'],
	proceedings:   ['title', 'year'],
	techreport:    ['author', 'title', 'institution', 'year'],
	unpublished:   ['author', 'title', 'note']
}));

/** the formal arguments `R CMD check` reads the entries of `citEntry()` and `bibentry()` by, the fields follow them */
const CitEntryFormals = ['entry', 'textVersion', 'header', 'footer'] as const;
const BibEntryFormals = ['bibtype', 'textVersion', 'header', 'footer', 'other'] as const;

/** the citation functions with a newer replacement, the replacement's name */
const SupersededCitation: ReadonlyMap<string, string> = new Map([
	['citEntry', 'bibentry'],
	['citHeader', 'bibentry'],
	['citFooter', 'bibentry'],
	['personList', 'person'],
	['as.personList', 'person']
]);

/** the documents whose relative links are checked */
const LinkedDocument = /^(README|NEWS)\.md$|^vignettes\/.*\.(Rmd|md)$/;
/** a markdown link `](target)` or an HTML `href`/`src` attribute, the target in the first or second group */
const LinkTarget = /\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)|\b(?:href|src)\s*=\s*"([^"]*)"/g;

type Report = (kind: PackageMetafilesKind, file: string, line: number, message: string) => void;

/** the entries of an index file, as `R`'s `tools:::read.00Index` reads them: paragraphs of `item<spaces>description` lines */
function readIndex(text: string): { item: string, description: string }[] {
	const entries: { item: string, description: string }[] = [];
	/* `readLines` drops the final newline, which `strsplit` would otherwise turn into an empty item */
	const body = text.endsWith('\n') ? text.slice(0, -1) : text;
	for(const chunk of body.split(/\n[ \t\n]*\n/)) {
		if(!/( {3}|\t)/.test(chunk)) {
			continue;
		}
		for(const line of chunk.replace(/\n[ \t]+/g, '\t').split('\n')) {
			const [item, ...rest] = line.split(/[ \t]/);
			entries.push({ item, description: rest.filter(t => t !== '').join(' ') });
		}
	}
	return entries;
}

/** the line (1-based) of the first line of `text` that starts with `item`, `1` if none does */
function lineOf(text: string, item: string): number {
	const i = text.split('\n').findIndex(l => l.trim().split(/[ \t]/)[0] === item);
	return i < 0 ? 1 : i + 1;
}

/** whether the package contains the folder `dir` (or any file below it) */
function hasDir(files: PackageFiles, dir: string): boolean {
	return files.entries.some(e => e.relative === dir || e.relative.startsWith(`${dir}/`));
}

/** the `.R` and `.r` files directly in `demo/` whose name starts with a letter, as `R CMD check` takes them as demos */
function demoTopics(files: PackageFiles): { topic: string, file: string }[] {
	return files.entries
		.filter(e => !e.isDirectory && /^demo\/[A-Za-z][^/]*\.[Rr]$/.test(e.relative))
		.map(e => ({ topic: e.relative.slice('demo/'.length, -2), file: e.relative }));
}

/** `R CMD check` only counts an argument as a field if it has a value that is neither `NULL` nor blank */
function isEmptyValue(value: RNode<ParentInformation> | undefined): boolean {
	return value === undefined || RNode.lexeme(value) === 'NULL' || RString.is(value) && value.content.str.trim() === '';
}

/** the names of the named, non-empty arguments of a call (lower-cased, as `R CMD check` compares them) */
function fieldNames(args: readonly PotentiallyEmptyRArgument<ParentInformation>[]): string[] {
	return args.flatMap(a => a === EmptyArgument || a.name === undefined || isEmptyValue(a.value) ? [] : [Identifier.getName(a.name.content).toLowerCase()]);
}

/** the entries of `demo/00Index`, the index and the demos must agree on */
function checkIndices(files: PackageFiles, report: Report): number {
	let read = 0;
	const index = files.read('INDEX');
	if(index !== undefined) {
		read++;
		if(index === '') {
			report('empty-index', 'INDEX', 1, 'Empty file \'INDEX\'.');
		}
	}
	if(!hasDir(files, 'demo')) {
		return read;
	}
	read++;
	const demoIndex = files.read('demo/00Index');
	if(demoIndex === undefined || demoIndex === '') {
		report('empty-demo-index', 'demo/00Index', 1, 'Empty or missing file \'demo/00Index\'.');
		return read;
	}
	const entries = readIndex(demoIndex);
	const topics = demoTopics(files);
	const described = new Map<string, string>();
	for(const { item, description } of entries) {
		if(!described.has(item)) {
			described.set(item, description);
		}
	}
	for(const { topic, file } of topics) {
		if((described.get(topic) ?? '').trim() === '') {
			report('undocumented-demo', file, 1, `Demos with missing or empty index information: '${topic}' (in '${file}')`);
		}
	}
	const known = new Set(topics.map(t => t.topic));
	for(const { item } of entries) {
		if(!known.has(item)) {
			report('missing-demo', 'demo/00Index', lineOf(demoIndex, item), `Demo index entry without corresponding demo: '${item}'`);
		}
	}
	return read;
}

/** the CITATION files `R CMD check` finds outside of `inst/` (where `inst/CITATION` is the standard place) */
function checkCitationLocations(files: PackageFiles, report: Report): void {
	for(const e of files.entries) {
		if(e.isDirectory || e.relative === 'inst/CITATION' || !/^CITATION(\.[A-Za-z0-9]+)?$/.test(path.posix.basename(e.relative))) {
			continue;
		}
		report('citation-location', e.relative, 1, `Found the CITATION file in a non-standard place: '${e.relative}', most likely 'inst/CITATION' should be used instead`);
	}
}

/** the first node of a syntax tree the parser could not make sense of */
function firstError(node: SyntaxNode): SyntaxNode | undefined {
	if(node.isError || node.isMissing) {
		return node;
	}
	for(const child of node.children) {
		const found = firstError(child);
		if(found !== undefined) {
			return found;
		}
	}
	return undefined;
}

/**
 * Checks `inst/CITATION` as `R CMD check` does (`tools:::.check_citation`): it has to parse, and each top-level
 * `citEntry()` or `bibentry()` needs a known entry type and the fields that type requires. Superseded citation
 * functions are reported as well. Returns the number of files read (0 or 1).
 */
function checkCitationFile(files: PackageFiles, data: ReadonlyFlowrAnalysisProvider, config: PackageMetafilesConfig, report: Report): number {
	const rel = 'inst/CITATION';
	const text = files.read(rel);
	if(text === undefined) {
		return 0;
	}
	const tree = data.parseStandalone(text);
	const error = tree.rootNode.hasError ? firstError(tree.rootNode) : undefined;
	if(error !== undefined) {
		if(config.citation) {
			report('citation-syntax', rel, error.startPosition.row + 1, `Invalid citation information in '${rel}': unexpected code at line ${error.startPosition.row + 1}`);
		}
		return 1;
	}
	const ast = data.normalizeStandalone(text);
	if(config.superseded) {
		for(const node of projectNodes(ast)) {
			if(!RFunctionCall.isNamed(node)) {
				continue;
			}
			const name = Identifier.getName(node.functionName.content);
			const replacement = SupersededCitation.get(name);
			if(replacement !== undefined) {
				report('citation-superseded', rel, SourceLocation.fromNode(node)?.[0] ?? 1, `${name}() is superseded by ${replacement}(), use that instead`);
			}
		}
	}
	if(config.citation) {
		let entry = 0;
		for(const expr of ast.ast.files.flatMap(f => f.root.children)) {
			if(!RFunctionCall.isNamed(expr)) {
				continue;
			}
			const fn = Identifier.getName(expr.functionName.content);
			if(fn !== 'citEntry' && fn !== 'bibentry') {
				continue;
			}
			entry++;
			const line = SourceLocation.fromNode(expr)?.[0] ?? 1;
			const bibentry = fn === 'bibentry';
			const bound = MatchArgs.toNames(expr.arguments, bibentry ? BibEntryFormals : CitEntryFormals);
			const typeValue = bound.get(bibentry ? 'bibtype' : 'entry')?.value;
			const type = typeValue !== undefined && RString.is(typeValue) ? typeValue.content.str : undefined;
			const required = type === undefined ? undefined : BibTeXRequiredFields.get(type.toLowerCase());
			if(required === undefined) {
				const shown = type ?? (typeValue === undefined ? '' : RNode.lexeme(typeValue) ?? '');
				report('citation-entry-type', rel, line, `entry ${entry}: invalid type '${shown}'`);
				continue;
			}
			const boundArgs = new Set(bound.values());
			const others = expr.arguments.filter((a): a is RArgument<ParentInformation> => a !== EmptyArgument && !boundArgs.has(a));
			const fields = fieldNames(others);
			const other = bound.get('other')?.value;
			if(bibentry && other !== undefined && RFunctionCall.isNamed(other) && Identifier.getName(other.functionName.content) === 'list') {
				fields.push(...fieldNames(other.arguments));
			}
			const missing = required.filter(alternatives => !alternatives.split('|').some(f => fields.includes(f)));
			if(missing.length > 0) {
				report('citation-missing-field', rel, line, `entry ${entry} (${type}): missing required field(s) ${missing.map(m => `'${m}'`).join(', ')}`);
			}
		}
	}
	return 1;
}

/** the target of a link in `from` as a path of the package, `undefined` for links that leave the package alone (URLs, anchors, absolute paths) */
function localTarget(from: string, target: string): string | undefined {
	if(/^([A-Za-z][A-Za-z0-9+.-]*:|\/)/.test(target)) {
		return undefined;
	}
	const local = target.split(/[#?]/)[0];
	if(local === '') {
		return undefined;
	}
	const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), local));
	return resolved === '.' ? undefined : resolved;
}

/** the relative links of the README, NEWS and vignettes that name no file of the package */
function checkRelativeLinks(files: PackageFiles, report: Report): number {
	const known = new Set(files.entries.map(e => e.relative));
	let read = 0;
	for(const doc of files.entries.filter(e => !e.isDirectory && LinkedDocument.test(e.relative))) {
		const text = files.read(doc.relative);
		if(text === undefined) {
			continue;
		}
		read++;
		for(const m of text.matchAll(LinkTarget)) {
			const target = m[1] ?? m[2];
			const resolved = localTarget(doc.relative, target);
			if(resolved !== undefined && !known.has(resolved)) {
				report('relative-link', doc.relative, text.slice(0, m.index).split('\n').length, `Found the (possibly) invalid relative link '${target}' in '${doc.relative}', no such file in the package`);
			}
		}
	}
	return read;
}

/**
 * Port of the `R CMD check` notes on the metadata files of a package: the `INDEX` and the `demo/00Index` as
 * `checking index information` reads them (empty files, demos without an index entry and entries without a demo),
 * `inst/CITATION` as `checking package subdirectories` reads it (`tools:::.check_citation`: a syntax error, an invalid
 * entry type, or a missing required field of a `citEntry()` or `bibentry()`) and the CITATION files in a non-standard
 * place, and the relative links of the README and vignettes that `checking relative paths in package URLs` looks at
 * (`tools:::.check_package_urls_relative_paths`, which only sees the installed help and vignette HTML).
 * Unlike `R CMD check`, it reads the files statically (no R is run), and also reports the citation functions that are
 * superseded by a newer one.
 */
export const PACKAGE_METAFILES = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const files = packageFiles(ctx, packageInfo(ctx).name);
		const results: PackageMetafilesResult[] = [];
		if(files === undefined) {
			return { results, '.meta': { checkedFiles: 0 } };
		}
		const report: Report = (kind, file, line, message) => results.push({
			certainty:  LintingResultCertainty.Certain,
			involvedId: undefined,
			loc:        files.locate(file, line),
			kind,
			file,
			message
		});
		let checked = 0;
		if(config.index) {
			checked += checkIndices(files, report);
		}
		if(config.citation) {
			checkCitationLocations(files, report);
		}
		if(config.citation || config.superseded) {
			checked += checkCitationFile(files, data, config, report);
		}
		if(config.relativeLinks) {
			checked += checkRelativeLinks(files, report);
		}
		return { results, '.meta': { checkedFiles: checked } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.kind} in ${result.file} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `${result.message} (at ${SourceLocation.format(result.loc)})`
	},
	info: {
		name:          'Package Metafiles',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the `R CMD check` notes on the metafiles of a package: *"checking index information"* (empty `INDEX` or `demo/00Index`, demos missing from or without a `demo/00Index` entry), *"checking package subdirectories"* (`inst/CITATION` that does not parse, `citEntry()` or `bibentry()` calls with an invalid entry type or missing required fields, CITATION files in a non-standard place), and *"checking relative paths in package URLs"* (relative links of the README and vignettes to files the package does not contain). Unlike `R CMD check`, no R code is run, and it also reports the citation functions superseded by `bibentry()` or `person()`, which `R CMD check` accepts.',
		defaultConfig: () => ({
			index:         true,
			citation:      true,
			superseded:    true,
			relativeLinks: true
		})
	}
} as const satisfies LintingRule<PackageMetafilesResult, PackageMetafilesMetadata, PackageMetafilesConfig>;
