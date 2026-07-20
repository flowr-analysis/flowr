import { bold, faint, supportsHyperlinks } from './text/ansi';
import { SemVer } from 'semver';
import type { KnownParser } from '../r-bridge/parser';
import { guard } from './assert';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { sigDbRemoteRelease } from '../project/sigdb/sigdb-download';
import { FlowrWikiBaseRef } from '../documentation/doc-util/doc-files';

// this is automatically replaced with the current version by release-it
const version = '2.13.0';
// this is automatically replaced with the release date by release-it (regex-bumper, see package.json)
const versionDate = '2026-07-15T07:13:44Z';

/**
 * Retrieves the current flowR version as a new {@link SemVer} object.
 */
export function flowrVersion(): SemVer {
	return new SemVer(version);
}

type Version = `${number}.${number}.${number}`;

/**
 * Describes the version of flowR and the used R interpreter.
 */
export interface VersionInformation {
	/** The version of flowR */
	flowr:  Version,
	/** The version of R identified by the underlying {@link RShell} */
	r:      Version | 'unknown' | 'none',
	engine: string
}

const versionRegex = /^\d+\.\d+\.\d+/m;


/**
 * Retrieves the version information for flowR and the given parser or analysis provider.
 */
export async function retrieveVersionInformation(input: KnownParser | ReadonlyFlowrAnalysisProvider): Promise<VersionInformation> {
	const flowr = flowrVersion().toString();

	let r: string;
	let name: string;
	if('name' in input) {
		r = await input.rVersion();
		name = input.name;
	} else {
		const parserInformation = input.parserInformation();
		r = parserInformation.name === 'r-shell' ? (await parserInformation.rVersion()) : 'unknown';
		name = parserInformation.name;
	}

	guard(versionRegex.test(flowr), `flowR version ${flowr} does not match the expected format!`);
	guard(r === 'unknown' || r === 'none' || versionRegex.test(r), `R version ${r} does not match the expected format!`);

	return { flowr: flowr as Version, r: r as Version, engine: name };
}


/**
 * Displays the version information to the given output.
 */
export async function printVersionInformation(output: ReplOutput, input: KnownParser | ReadonlyFlowrAnalysisProvider, engineOnly = false) {
	const { flowr, r, engine } = await retrieveVersionInformation(input);
	const dim = (s: string) => faint(s, output.formatter);
	const rReason = r === 'none' ? ' (no R interpreter available)'
		: r === 'unknown' ? (engine === 'tree-sitter' ? ' (not queried, using the tree-sitter engine)' : ' (could not be determined)')
			: '';
	const flowrValue = versionRegex.test(flowr) ? output.formatter.hyperlink(flowr, `https://github.com/flowr-analysis/flowr/releases/tag/v${flowr}`) : flowr;
	const rows: [string, string, boolean?][] = [];
	const pluginLines: string[] = [];
	if(!engineOnly) {
		rows.push(['flowR', `${flowrValue} ${dim(`(${versionDate})`)}`]);
	}
	rows.push(
		['engine', engine],
		['R', `${r}${rReason}`, r === 'none' || r === 'unknown']
	);
	if(typeof input !== 'function' && 'inspectContext' in input) {
		// reads the current analyzer, so it reflects the databases in use (and adapts to config changes)
		const ctx = input.inspectContext();
		const setting = ctx.config.solver.sigdb.assumedRVersion ?? 'auto';
		rows.push(['assumed R', `${ctx.resolvedRVersion} ${dim(`(solver.sigdb.assumedRVersion = "${setting}")`)}`]);
		const dbs = ctx.deps.loadedSignatureDatabases();
		const sigDbUrl = sigDbRemoteRelease()?.url;
		const describe = (d: typeof dbs[number]) => {
			const entry = `${d.scope} (v${d.version}, ${d.date}${d.format ? `, ${d.format}` : ''})`;
			return sigDbUrl ? output.formatter.hyperlink(entry, sigDbUrl) : entry;
		};
		rows.push(['databases', dbs.length === 0 ? 'none' : dbs.map(describe).join(', '), dbs.length === 0]);
		// the registered plugins, grouped by prefix; collected here and printed after the table (below) so the
		// longer labels do not widen the version rows. The header links (once) to the plugin wiki section
		const wiki = `${FlowrWikiBaseRef}/Analyzer#plugins`;
		const osc8 = supportsHyperlinks();
		const names = ctx.config.defaultPlugins.map(x => typeof x === 'string' ? x : x[0]);
		const byPrefix = new Map<string, string[]>();
		for(const p of names) {
			const at = p.indexOf(':');
			const [prefix, suffix] = at < 0 ? [p, ''] : [p.slice(0, at), p.slice(at + 1)];
			byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), suffix]);
		}
		const trace = ctx.config.repl.showPlugins;
		// loaded lazily so this presentation util does not statically pull the plugin registry (and the whole
		// plugin/dataflow graph) into `util/version`, which `util/assert` depends on
		const { BuiltInPlugins } = await import('../project/plugins/plugin-registry');
		const keyByClass = new Map<string, string>(BuiltInPlugins.map(([key, producer]) => [producer.name, key]));
		const activated = new Set<string>();
		for(const cls of ctx.activatedPlugins) {
			const key = keyByClass.get(cls);
			if(key !== undefined) {
				activated.add(key);
			}
		}
		const render = (full: string, suffix: string): string => trace && !activated.has(full) ? dim(suffix) : suffix;
		const labelWidth = Math.max(...[...byPrefix.keys()].map(p => p.length));
		const header = `registered plugins (${names.length})`;
		const hint = trace ? ' (faint = did not activate)' : ' (set +repl.showPlugins=true to track activation)';
		pluginLines.push(`${bold(osc8 ? output.formatter.hyperlink(header, wiki) : header, output.formatter)}:${dim(hint)}`);
		for(const [prefix, suffixes] of [...byPrefix].sort((a, b) => a[0].localeCompare(b[0]))) {
			pluginLines.push(`  ${bold(prefix, output.formatter)}:${' '.repeat(labelWidth - prefix.length)} ${[...suffixes].sort((a, b) => a.localeCompare(b)).map(s => render(`${prefix}:${s}`, s)).join(', ')}`);
		}
		if(!osc8) {
			pluginLines.push(`  ${dim('docs: ' + wiki)}`);
		}
	}
	const width = Math.max(...rows.map(([label]) => label.length));
	for(const [label, value, faded] of rows) {
		const padding = ' '.repeat(width - label.length);
		const line = `${label}:${padding} ${value}`;
		output.stdout(faded ? dim(line) : line);
	}
	for(const line of pluginLines) {
		output.stdout(line);
	}
}
