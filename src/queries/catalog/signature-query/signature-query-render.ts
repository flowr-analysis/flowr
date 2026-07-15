import type { OutputFormatter } from '../../../util/text/ansi';
import { bold, italic, color, Colors, FontStyles } from '../../../util/text/ansi';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import { cranPageUrl } from './signature-query-executor';
import { baseRPackages } from '../../../util/r-base-packages';
import type { SignatureFunctionView, SignaturePackageView, SignatureQueryResult } from './signature-query-format';

/** print an in-repl usage guide for the signature query */
export function printSignatureHelp(output: ReplOutput): void {
	const f = output.formatter;
	const ex = (cmd: string, desc: string): void => output.stdout(`  ${bold(cmd, f)}\n      ${italic(desc, f)}`);
	output.stdout(bold('Signature Database Query', f) + italic('  (inspects the databases that resolve library()/`::` calls)', f));
	output.stdout('');
	output.stdout(`${bold('Usage', f)}  :query @signature [<package>[@<version>][::<function>] [<function>]]`);
	output.stdout('');
	output.stdout(bold('Examples', f));
	ex(':query @signature', 'summarize the loaded databases');
	ex(':query @signature ggplot2', 'a package: version, exports, dependencies, links');
	ex(':query @signature ggplot2::aes', 'one function (or `ggplot2 aes`, `ggplot2@3.5.0 aes`)');
	ex(':query @signature gg* geom_*', 'glob search (versions also take ranges: >=4.0.0, 4.x)');
	output.stdout('');
	output.stdout(italic(':query* dumps the full JSON (every function, the whole match set).', f));
}

/** how many names to show inline before an `+N more`: a short sample for a package's functions, more for lists */
const SampleFns = 5;
const MaxList   = 25;

const baseSet = new Set(baseRPackages());

/** a package name linked to its CRAN page (unless it is base R / the `R` language pseudo-package) */
function linkPackage(name: string, f: OutputFormatter): string {
	return name === 'R' || baseSet.has(name) ? name : f.hyperlink(name, cranPageUrl(name));
}

/** a `file:line` location, linked to its source when a url is known */
function linkLocation(file: string, line: number | undefined, url: string | undefined, f: OutputFormatter): string {
	const text = `${file}${line !== undefined ? `:${line}` : ''}`;
	return url ? f.hyperlink(text, url) : text;
}

/** render a function signature as `name(a, b = default, ...)` with defaults dimmed */
function renderSignature(f: OutputFormatter, fn: SignatureFunctionView): string {
	const params = fn.parameters.map(p => p.default !== undefined ? `${p.name} = ${italic(p.default, f)}` : p.name).join(', ');
	return `${bold(fn.name, f)}(${params})`;
}

/** render the full view of a single function into `result` */
export function pushFunction(result: string[], f: OutputFormatter, fn: SignatureFunctionView): void {
	const generic = fn.s3generic ? `  ${color('S3 generic', Colors.Magenta, f, { style: FontStyles.Bold })}` : '';
	result.push(`   ╰ ${color(fn.package, Colors.Cyan, f, { style: FontStyles.Bold })}::${bold(fn.name, f)}${fn.version ? ` ${color('v' + fn.version, Colors.Green, f)}` : ''}${generic}`);
	result.push(`      ╰ ${renderSignature(f, fn)}`);
	const tags = [fn.exported ? color('exported', Colors.Green, f) : color('internal', Colors.Yellow, f),
		...fn.properties.filter(p => p !== 'exported').map(p => italic(p, f))];
	result.push(`      ╰ ${tags.join('  ')}`);
	if(fn.file) {
		const loc = `${fn.file}${fn.line !== undefined ? `:${fn.line}` : ''}`;
		result.push(`      ╰ ${italic('source', f)}  ${fn.sourceUrl ? `${loc}  ${f.hyperlink(fn.sourceUrl, fn.sourceUrl)}` : loc}`);
	}
	if(fn.docUrl) {
		result.push(`      ╰ ${italic('docs', f)}    ${f.hyperlink(fn.docUrl, fn.docUrl)}`);
	}
	const listLine = (label: string, items: readonly string[], max: number): void => {
		if(!items.length) {
			return;
		}
		const more = items.length > max ? italic(` (+${items.length - max} more)`, f) : '';
		result.push(`      ╰ ${italic(label, f)} (${items.length}): ${items.slice(0, max).join(', ')}${more}`);
	};
	listLine('dispatches to', fn.s3methods ?? [], MaxList);
	listLine('calls', fn.callees, MaxList);
}

/** render the full view of a single package into `result` */
export function pushPackage(result: string[], f: OutputFormatter, p: SignaturePackageView): void {
	const kind = p.base ? color(' base R', Colors.Yellow, f, { style: FontStyles.Bold })
		: p.cran ? color(' CRAN', Colors.Blue, f, { style: FontStyles.Bold }) : '';
	result.push(`   ╰ ${color(p.name, Colors.Cyan, f, { style: FontStyles.Bold })} ${color('v' + p.version, Colors.Green, f)}${p.resolved ? italic(` (analyzer resolved ${p.resolved})`, f) : ''}${kind}`);
	if(p.releaseDate) {
		result.push(`      ╰ ${italic(`released ${p.releaseDate}`, f)}`);
	}
	if(p.cranPage) {
		result.push(`      ╰ ${italic('docs', f)}    ${f.hyperlink(p.cranPage, p.cranPage)}`);
	}
	const links: string[] = [];
	if(p.repoUrl) {
		links.push(f.hyperlink('mirror', p.repoUrl));
	}
	if(p.cranUrl) {
		links.push(f.hyperlink('tarball', p.cranUrl));
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
		const shown = p.constants.slice(0, MaxList);
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
		const sample = p.functions.slice(0, SampleFns).map(fn => bold(fn.name, f)).join(', ');
		const more = p.functions.length > SampleFns ? italic(` … +${p.functions.length - SampleFns} more (:query* for the full JSON)`, f) : '';
		result.push(`         ╰ ${italic('e.g.', f)} ${sample}${more}`);
	}
}

/** render the function hits of a wildcard search into `result` */
export function pushMatches(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	const matches = out.matches ?? [];
	const cap = out.truncated ? italic(` (capped at ${matches.length})`, f) : '';
	result.push(`   ╰ ${bold(String(out.matchCount ?? matches.length), f)} function${matches.length === 1 ? '' : 's'} matched${cap}`);
	for(const m of matches) {
		const loc = m.file ? `  ${linkLocation(m.file, m.line, m.sourceUrl, f)}` : '';
		const doc = m.docUrl ? `  ${f.hyperlink('docs', m.docUrl)}` : '';
		result.push(`      ╰ ${color(m.package, Colors.Cyan, f)}::${bold(m.name, f)}${m.version ? italic(` v${m.version}`, f) : ''}${loc}${doc}`);
	}
}

/** render the package hits of a wildcard package search into `result` */
export function pushPackages(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	const packages = out.packages ?? [];
	const cap = out.truncated ? italic(` (capped at ${packages.length})`, f) : '';
	result.push(`   ╰ ${bold(String(packages.length), f)} package${packages.length === 1 ? '' : 's'} matched${cap}`);
	for(const pm of packages) {
		const name = pm.cranPage ? f.hyperlink(color(pm.name, Colors.Cyan, f), pm.cranPage) : color(pm.name, Colors.Cyan, f);
		const kind = pm.base ? italic(' base R', f) : pm.cran ? italic(' CRAN', f) : '';
		const vers = pm.versions ? `: ${pm.versions.join(', ')}` : pm.latest ? ` ${color('v' + pm.latest, Colors.Green, f)}` : '';
		result.push(`      ╰ ${name}${vers}${kind}`);
	}
}

/** render the summary of the loaded databases into `result` */
export function pushSummary(result: string[], f: OutputFormatter, out: SignatureQueryResult): void {
	if(out.databases.length === 0 && out.sourceCount === 0) {
		result.push(`   ╰ ${italic('No signature databases are loaded (the solver may be disabled or no bundle was found).', f)}`);
		return;
	}
	result.push(`   ╰ ${bold(String(out.packageCount), f)} packages across ${out.sourceCount} source${out.sourceCount === 1 ? '' : 's'}`);
	for(const db of out.databases) {
		result.push(`      ╰ ${color(db.scope, Colors.Cyan, f)}${db.version ? ` v${db.version}` : ''}${db.date ? italic(` (${db.date})`, f) : ''}`);
	}
}
