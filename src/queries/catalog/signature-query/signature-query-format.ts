import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import type { OutputFormatter } from '../../../util/text/ansi';
import { bold, italic, color, hyperlink, Colors, FontStyles } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { executeSignatureQuery, cranPageUrl, signatureQueryCompleter } from './signature-query-executor';
import { baseRPackages } from '../../../util/r-base-packages';

/**
 * Inspects the loaded signature database(s) (see the {@link https://github.com/flowr-analysis/flowr/wiki/Package-Database|Package Database wiki}).
 * The `package` and `function` fields accept glob wildcards (`*`, `?`), and `version` accepts an exact version,
 * a glob (`3.*`), or a semver range (`>=3.0.0`, `3.x`). With no `package` it summarizes the loaded databases;
 * a single exact package/function yields the full view (signature, definition location, CRAN-mirror source link,
 * rdrr.io docs); a wildcard yields the matching set.
 */
export interface SignatureQuery extends BaseQueryFormat {
	readonly type:      'signature';
	/** the package to inspect (glob wildcards allowed); omit for a summary of the loaded databases */
	readonly package?:  string;
	/** the function/symbol within {@link package} to inspect (glob wildcards allowed) */
	readonly function?: string;
	/** a version spec: an exact version, a glob (`3.*`), or a semver range (`>=3.0.0`, `3.x`) */
	readonly version?:  string;
	/** list every function of the package instead of a short sample */
	readonly all?:      boolean;
	/** raise the wildcard-search cap (return the full match list instead of the first few) */
	readonly full?:     boolean;
}

/** one parameter of a function signature */
export interface SignatureParameterView {
	readonly name:     string;
	readonly required: boolean;
	readonly forced:   boolean;
	readonly default?: string;
}

/** the detailed view of a single function within a package */
export interface SignatureFunctionView {
	readonly name:       string;
	readonly package:    string;
	readonly version?:   string;
	readonly exported:   boolean;
	readonly properties: readonly string[];
	readonly parameters: readonly SignatureParameterView[];
	readonly callees:    readonly string[];
	readonly file?:      string;
	readonly line?:      number;
	/** deep link into the read-only CRAN GitHub mirror, when the definition location + a CRAN version are known */
	readonly sourceUrl?: string;
	/** rdrr.io documentation link for the function, when it maps to a documentable topic */
	readonly docUrl?:    string;
	/** whether the function looks like an S3 generic (has `<generic>.<class>` dispatch targets in the same package) */
	readonly s3generic?: boolean;
	/** the `<generic>.<class>` dispatch targets found in the same package */
	readonly s3methods?: readonly string[];
}

/** one declared dependency of a package */
export interface SignatureDependencyView {
	readonly type:        string;
	readonly name:        string;
	readonly constraint?: string;
}

/** the full view of a package as stored in the signature database */
export interface SignaturePackageView {
	readonly name:          string;
	readonly version:       string;
	/** the version the analyzer resolved the package to, if it differs from {@link version} */
	readonly resolved?:     string;
	readonly base:          boolean;
	readonly cran:          boolean;
	/** the CRAN source tarball url, when known */
	readonly cranUrl?:      string;
	/** the CRAN package landing page (`cran.r-project.org/package=<pkg>`), for CRAN packages */
	readonly cranPage?:     string;
	/** the package's read-only CRAN GitHub mirror (`github.com/cran/<pkg>`), for CRAN packages */
	readonly repoUrl?:      string;
	readonly releaseDate?:  string;
	readonly exportsTotal:  number;
	readonly functionCount: number;
	readonly constants:     readonly string[];
	readonly internalCount: number;
	readonly deprecated:    readonly string[];
	/** for a base package: the R releases it was part of core, ascending */
	readonly coreVersions?: readonly string[];
	readonly dependencies:  readonly SignatureDependencyView[];
	readonly functions:     readonly SignatureFunctionView[];
}

/** a compact hit from a wildcard function search */
export interface SignatureMatchView {
	readonly package:    string;
	readonly name:       string;
	readonly exported:   boolean;
	readonly version?:   string;
	readonly file?:      string;
	readonly line?:      number;
	readonly sourceUrl?: string;
	readonly docUrl?:    string;
}

/** a hit from a wildcard package search */
export interface SignaturePackageMatch {
	readonly name:      string;
	readonly base:      boolean;
	readonly cran:      boolean;
	readonly latest?:   string;
	/** the versions matching the version spec (present only for a versioned search) */
	readonly versions?: readonly string[];
	readonly cranPage?: string;
}

/** metadata of one loaded signature database */
export interface SignatureDatabaseView {
	readonly scope:   string;
	readonly version: number;
	readonly date:    string;
}

export interface SignatureQueryResult extends BaseQueryResult {
	readonly databases:    readonly SignatureDatabaseView[];
	readonly packageCount: number;
	readonly sourceCount:  number;
	/** set when a single package was requested and found */
	readonly package?:     SignaturePackageView;
	/** set when a single function was requested and found */
	readonly function?:    SignatureFunctionView;
	/** function hits from a wildcard search */
	readonly matches?:     readonly SignatureMatchView[];
	readonly matchCount?:  number;
	/** package hits from a wildcard package search (no function given) */
	readonly packages?:    readonly SignaturePackageMatch[];
	/** whether the match list was capped */
	readonly truncated?:   boolean;
	/** a not-found / disabled note, with optional near-match suggestions */
	readonly message?:     string;
	readonly suggestions?: readonly string[];
}

/** print an in-repl usage guide for the signature query */
function printSignatureHelp(output: ReplOutput): void {
	const f = output.formatter;
	const ex = (cmd: string, desc: string): void => output.stdout(`  ${bold(cmd, f)}\n      ${italic(desc, f)}`);
	output.stdout(bold('Signature Database Query', f) + italic('  (inspects the databases that resolve library()/`::` calls)', f));
	output.stdout('');
	output.stdout(`${bold('Usage', f)}  :query @signature [<package>[@<version>][::<function>] [<function>]] [--all] [--full]`);
	output.stdout('');
	output.stdout(bold('Examples', f));
	ex(':query @signature', 'summarize the loaded databases');
	ex(':query @signature ggplot2', 'a package: version, exports, dependencies, CRAN/mirror links');
	ex(':query @signature ggplot2 aes', 'one function: signature, definition location, docs, S3 dispatch');
	ex(':query @signature ggplot2::aes', 'the same, using the pkg::fn shorthand');
	ex(':query @signature ggplot2@3.5.0 aes', 'a function at an exact version');
	ex(':query @signature gg* geom_*', 'glob search: geom_* functions in gg* packages');
	ex(':query @signature * print', 'every package that defines print');
	ex(':query @signature stats@4.*', 'a version glob (also ranges: >=4.0.0, 4.x)');
	output.stdout('');
	output.stdout(italic('--all expands a package\'s full function list, --full raises the search cap, and :query* dumps the full JSON.', f));
}

/** parse a signature-query repl line into a query: `pkg`, `pkg fn`, `pkg::fn`, `pkg@ver`, globs, `--all`, `--full` */
function signatureQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'signature'> {
	const positional = line.filter(t => t.length > 0 && !t.startsWith('--'));
	const all = line.includes('--all');
	const full = line.includes('--full');
	if(positional[0] === 'help' || line.includes('--help') || line.includes('-h')) {
		printSignatureHelp(output);
		return { query: [] };
	}
	const [first, second] = positional;
	if(!first) {
		return { query: [{ type: 'signature', ...(all ? { all: true } : {}), ...(full ? { full: true } : {}) }] };
	}
	// `pkg::fn` shorthand, then `pkg@version`
	const dbl = first.indexOf('::');
	const left = dbl >= 0 ? first.slice(0, dbl) : first;
	const fnFromColon = dbl >= 0 ? first.slice(dbl + 2) : undefined;
	const at = left.indexOf('@');
	const pkg = at >= 0 ? left.slice(0, at) : left;
	const version = at >= 0 ? left.slice(at + 1) : undefined;
	const fn = second ?? fnFromColon;
	return {
		query: [{
			type: 'signature',
			...(pkg ? { package: pkg } : {}),
			...(fn ? { function: fn } : {}),
			...(version ? { version } : {}),
			...(all ? { all: true } : {}),
			...(full ? { full: true } : {})
		}]
	};
}

const MaxCallees   = 20;
const MaxMethods   = 30;
const MaxConstants = 30;
const SampleFns    = 8;

const baseSet = new Set(baseRPackages());

/** a package name linked to its CRAN page (unless it is base R / the `R` language pseudo-package) */
function linkPackage(name: string, f: OutputFormatter): string {
	return name === 'R' || baseSet.has(name) ? name : hyperlink(name, cranPageUrl(name), f);
}

/** a `file:line` location, linked to its source when a url is known */
function linkLocation(file: string, line: number | undefined, url: string | undefined, f: OutputFormatter): string {
	const text = `${file}${line !== undefined ? `:${line}` : ''}`;
	return url ? hyperlink(text, url, f) : text;
}

/** render a function signature as `name(a, b = default, ...)` with defaults dimmed */
function renderSignature(f: OutputFormatter, fn: SignatureFunctionView): string {
	const params = fn.parameters.map(p => p.default !== undefined ? `${p.name} = ${italic(p.default, f)}` : p.name).join(', ');
	return `${bold(fn.name, f)}(${params})`;
}

function pushFunction(result: string[], f: OutputFormatter, fn: SignatureFunctionView): void {
	const generic = fn.s3generic ? `  ${color('S3 generic', Colors.Magenta, f, { style: FontStyles.Bold })}` : '';
	result.push(`   ╰ ${color(fn.package, Colors.Cyan, f, { style: FontStyles.Bold })}::${bold(fn.name, f)}${fn.version ? ` ${color('v' + fn.version, Colors.Green, f)}` : ''}${generic}`);
	result.push(`      ╰ ${renderSignature(f, fn)}`);
	const tags = [fn.exported ? color('exported', Colors.Green, f) : color('internal', Colors.Yellow, f),
		...fn.properties.filter(p => p !== 'exported').map(p => italic(p, f))];
	result.push(`      ╰ ${tags.join('  ')}`);
	if(fn.file) {
		const loc = `${fn.file}${fn.line !== undefined ? `:${fn.line}` : ''}`;
		result.push(`      ╰ ${italic('source', f)}  ${fn.sourceUrl ? `${loc}  ${hyperlink(fn.sourceUrl, fn.sourceUrl, f)}` : loc}`);
	}
	if(fn.docUrl) {
		result.push(`      ╰ ${italic('docs', f)}    ${hyperlink(fn.docUrl, fn.docUrl, f)}`);
	}
	const listLine = (label: string, items: readonly string[], max: number): void => {
		if(!items.length) {
			return;
		}
		const more = items.length > max ? italic(` (+${items.length - max} more)`, f) : '';
		result.push(`      ╰ ${italic(label, f)} (${items.length}): ${items.slice(0, max).join(', ')}${more}`);
	};
	listLine('dispatches to', fn.s3methods ?? [], MaxMethods);
	listLine('calls', fn.callees, MaxCallees);
}

function pushPackage(result: string[], f: OutputFormatter, p: SignaturePackageView, all: boolean): void {
	const kind = p.base ? color(' base R', Colors.Yellow, f, { style: FontStyles.Bold })
		: p.cran ? color(' CRAN', Colors.Blue, f, { style: FontStyles.Bold }) : '';
	result.push(`   ╰ ${color(p.name, Colors.Cyan, f, { style: FontStyles.Bold })} ${color('v' + p.version, Colors.Green, f)}${p.resolved ? italic(` (analyzer resolved ${p.resolved})`, f) : ''}${kind}`);
	if(p.releaseDate) {
		result.push(`      ╰ ${italic(`released ${p.releaseDate}`, f)}`);
	}
	if(p.cranPage) {
		result.push(`      ╰ ${italic('docs', f)}    ${hyperlink(p.cranPage, p.cranPage, f)}`);
	}
	const links: string[] = [];
	if(p.repoUrl) {
		links.push(hyperlink('mirror', p.repoUrl, f));
	}
	if(p.cranUrl) {
		links.push(hyperlink('tarball', p.cranUrl, f));
	}
	if(links.length) {
		result.push(`      ╰ ${links.join('  ')}`);
	}
	if(p.coreVersions?.length) {
		const first = p.coreVersions[0], last = p.coreVersions[p.coreVersions.length - 1];
		result.push(`      ╰ ${italic('in R versions', f)}: ${first === last ? first : `${first} to ${last}`} (${p.coreVersions.length})`);
	}
	result.push(`      ╰ ${italic('exports', f)} (${p.exportsTotal}): ${p.functionCount} functions, ${p.constants.length} constants, ${p.internalCount} internal, ${p.deprecated.length} deprecated`);
	if(p.constants.length) {
		const shown = p.constants.slice(0, all ? p.constants.length : MaxConstants);
		const more = p.constants.length > shown.length ? italic(` … +${p.constants.length - shown.length} more`, f) : '';
		result.push(`      ╰ ${italic('constants', f)}: ${shown.join(', ')}${more}`);
	}
	if(p.dependencies.length) {
		const byType = new Map<string, string[]>();
		for(const d of p.dependencies) {
			const list = byType.get(d.type) ?? [];
			list.push(`${linkPackage(d.name, f)}${d.constraint ? italic(` ${d.constraint}`, f) : ''}`);
			byType.set(d.type, list);
		}
		result.push(`      ╰ ${italic('dependencies', f)} (${p.dependencies.length})`);
		for(const [type, list] of byType) {
			result.push(`         ╰ ${italic(type, f)}: ${list.join(', ')}`);
		}
	}
	if(p.functions.length) {
		result.push(`      ╰ ${italic('functions', f)} (${p.functions.length})`);
		if(all) {
			for(const fn of [...p.functions].sort((a, b) => a.name.localeCompare(b.name))) {
				result.push(`         ╰ ${renderSignature(f, fn)}`);
			}
		} else {
			const sample = p.functions.slice(0, SampleFns).map(fn => bold(fn.name, f)).join(', ');
			const more = p.functions.length > SampleFns ? italic(` … +${p.functions.length - SampleFns} more (--all, or :query* for the full JSON)`, f) : '';
			result.push(`         ╰ ${italic('e.g.', f)} ${sample}${more}`);
		}
	}
}

function pushMatches(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	const matches = out.matches ?? [];
	const cap = out.truncated ? italic(` (capped at ${matches.length}; --full, or :query* for the full JSON)`, f) : '';
	result.push(`   ╰ ${bold(String(out.matchCount ?? matches.length), f)} function${matches.length === 1 ? '' : 's'} matched${cap}`);
	for(const m of matches) {
		const loc = m.file ? `  ${linkLocation(m.file, m.line, m.sourceUrl, f)}` : '';
		const doc = m.docUrl ? `  ${hyperlink('docs', m.docUrl, f)}` : '';
		result.push(`      ╰ ${color(m.package, Colors.Cyan, f)}::${bold(m.name, f)}${m.version ? italic(` v${m.version}`, f) : ''}${loc}${doc}`);
	}
}

function pushPackages(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	const packages = out.packages ?? [];
	const cap = out.truncated ? italic(` (capped at ${packages.length}; --full, or :query* for the full JSON)`, f) : '';
	result.push(`   ╰ ${bold(String(packages.length), f)} package${packages.length === 1 ? '' : 's'} matched${cap}`);
	for(const pm of packages) {
		const name = pm.cranPage ? hyperlink(color(pm.name, Colors.Cyan, f), pm.cranPage, f) : color(pm.name, Colors.Cyan, f);
		const kind = pm.base ? italic(' base R', f) : pm.cran ? italic(' CRAN', f) : '';
		const vers = pm.versions ? `: ${pm.versions.join(', ')}` : pm.latest ? ` ${color('v' + pm.latest, Colors.Green, f)}` : '';
		result.push(`      ╰ ${name}${vers}${kind}`);
	}
}

function pushSummary(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	if(out.databases.length === 0 && out.sourceCount === 0) {
		result.push(`   ╰ ${italic('No signature databases are loaded (the solver may be disabled or no bundle was found).', f)}`);
		return;
	}
	result.push(`   ╰ ${bold(String(out.packageCount), f)} packages across ${out.sourceCount} source${out.sourceCount === 1 ? '' : 's'}`);
	for(const db of out.databases) {
		result.push(`      ╰ ${color(db.scope, Colors.Cyan, f)}${db.version ? ` v${db.version}` : ''}${db.date ? italic(` (${db.date})`, f) : ''}`);
	}
}

export const SignatureQueryDefinition = {
	executor:        executeSignatureQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result, query) => {
		const out = queryResults as QueryResults<'signature'>['signature'];
		const all = (query as readonly SignatureQuery[]).some(q => q.type === 'signature' && q.all);
		result.push(`Query: ${bold('signature', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.function) {
			pushFunction(result, formatter, out.function);
		} else if(out.package) {
			pushPackage(result, formatter, out.package, all);
		} else if(out.matches) {
			pushMatches(result, formatter, out);
		} else if(out.packages) {
			pushPackages(result, formatter, out);
		} else if(!out.message) {
			pushSummary(result, formatter, out);
		}
		if(out.message) {
			const hint = out.suggestions?.length ? ` ${italic('Did you mean:', formatter)} ${out.suggestions.join(', ')}?` : '';
			result.push(`   ╰ ${color(out.message, Colors.Red, formatter)}${hint}`);
		}
		return true;
	},
	fromLine:  signatureQueryLineParser,
	completer: signatureQueryCompleter,
	schema:    Joi.object({
		type:     Joi.string().valid('signature').required().description('The type of the query.'),
		package:  Joi.string().optional().description('The package to inspect (glob wildcards allowed); omit for a summary of the loaded databases.'),
		function: Joi.string().optional().description('A function/symbol to inspect (glob wildcards allowed).'),
		version:  Joi.string().optional().description('A version spec: an exact version, a glob (3.*), or a semver range (>=3.0.0, 3.x).'),
		all:      Joi.boolean().optional().description('List every function of the package instead of a short sample.'),
		full:     Joi.boolean().optional().description('Raise the wildcard-search cap and return the full match list.')
	}).description('Inspects the loaded signature database(s): loaded databases, a package, a function, or wildcard matches.'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'signature'>;
