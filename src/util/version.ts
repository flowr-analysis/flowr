import { FontStyles } from './text/ansi';
import { SemVer } from 'semver';
import type { KnownParser } from '../r-bridge/parser';
import { guard } from './assert';
import type { ReplOutput } from '../cli/repl/commands/repl-main';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { sigDbRemoteRelease } from '../project/sigdb/sigdb-download';

// this is automatically replaced with the current version by release-it
const version = '2.12.3';
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
	const faint = (s: string) => output.formatter.format(s, { style: FontStyles.Faint });
	const rReason = r === 'none' ? ' (no R interpreter available)'
		: r === 'unknown' ? (engine === 'tree-sitter' ? ' (not queried, using the tree-sitter engine)' : ' (could not be determined)')
			: '';
	const flowrValue = versionRegex.test(flowr) ? output.formatter.hyperlink(flowr, `https://github.com/flowr-analysis/flowr/releases/tag/v${flowr}`) : flowr;
	const rows: [string, string, boolean?][] = [];
	if(!engineOnly) {
		rows.push(['flowR', `${flowrValue} ${faint(`(${versionDate})`)}`]);
	}
	rows.push(
		['engine', engine],
		['R', `${r}${rReason}`, r === 'none' || r === 'unknown']
	);
	if(typeof input !== 'function' && 'inspectContext' in input) {
		// reads the current analyzer, so it reflects the databases in use (and adapts to config changes)
		const ctx = input.inspectContext();
		const setting = ctx.config.solver.sigdb.assumedRVersion ?? 'auto';
		rows.push(['assumed R', `${ctx.resolvedRVersion} ${faint(`(solver.sigdb.assumedRVersion = "${setting}")`)}`]);
		const dbs = ctx.deps.loadedPackageDatabases();
		const sigDbUrl = sigDbRemoteRelease()?.url;
		const describe = (d: typeof dbs[number]) => {
			const entry = `${d.scope} (v${d.version}, ${d.date}${d.format ? `, ${d.format}` : ''})`;
			return sigDbUrl ? output.formatter.hyperlink(entry, sigDbUrl) : entry;
		};
		rows.push(['databases', dbs.length === 0 ? 'none' : dbs.map(describe).join(', '), dbs.length === 0]);
	}
	const width = Math.max(...rows.map(([label]) => label.length));
	for(const [label, value, faded] of rows) {
		const padding = ' '.repeat(width - label.length);
		const line = `${label}:${padding} ${value}`;
		output.stdout(faded ? faint(line) : line);
	}
}
