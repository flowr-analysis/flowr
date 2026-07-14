import type { KnownParser } from '../../r-bridge/parser';
import { retrieveVersionInformation } from '../../util/version';
import { defaultSigDbPath, readManifestFile, type SigDbScope } from '../../project/sigdb/manifest';
import { color, Colors, FontStyles, formatter } from '../../util/text/ansi';
import { pathToFileURL } from 'node:url';

/**
 * Returns a version string for the REPL including flowR, R, and the engine in use.
 */
export async function versionReplString(parser: KnownParser): Promise<string> {
	const version = await retrieveVersionInformation(parser);
	const rVersion = version.r === 'none' ? '' : version.r === 'unknown' ? ', R version unknown' : `, R v${version.r}`;
	const treeSitterVer = parser.name === 'tree-sitter' ? `, R grammar v${parser.treeSitterVersion()}` : '';
	return `flowR repl v${version.flowr}${rVersion}${treeSitterVer} (${version.engine} engine)`;
}

/**
 * Compact, dimmed note on the bundled signature databases (merged into the engine parenthesis): one linked ref per
 * scope present on disk (`current`, `full-history`) with its last update; `base` only when nothing richer ships.
 * The full history is on disk as `history.*` (mounted alongside `current.*`), or a merged `full.*` in a baked container.
 */
function sigDbSummaryString(): string {
	const dim = (s: string) => color(s, Colors.White, formatter, { style: FontStyles.Faint });
	const entries: { label: string, file: string, date?: string }[] = [];
	const add = (label: string, file: string | undefined): void => {
		if(file === undefined) {
			return;
		}
		let date: string | undefined;
		try {
			date = readManifestFile(file).date;
		} catch{ /* a corrupt/unreadable manifest must not break --version */ }
		entries.push({ label, file, date });
	};
	add('current', defaultSigDbPath('current'));
	add('full-history', defaultSigDbPath('full') ?? defaultSigDbPath('history' as SigDbScope));
	if(entries.length === 0) {
		add('base', defaultSigDbPath('base'));
	}
	if(entries.length === 0) {
		return dim('no sigdb');
	}
	// keep the color escapes outside the OSC 8 region (link text stays clean) for wider terminal support
	const link = (text: string, file: string): string => dim(formatter.hyperlink(text, pathToFileURL(file).href));
	// if every ref shares the same date, print it once at the end instead of after each label
	const shared = entries.every(e => e.date !== undefined && e.date === entries[0].date) ? entries[0].date : undefined;
	const refs = entries.map(e => link(shared === undefined && e.date !== undefined ? `${e.label} ${e.date}` : e.label, e.file));
	return dim('sigdb: ') + refs.join(dim(', ')) + (shared !== undefined ? dim(` ${shared}`) : '');
}

/**
 * Prints the version information for the REPL including flowR, R, and the bundled signature databases.
 */
export async function printVersionRepl(parser: KnownParser): Promise<void> {
	const sigdb = sigDbSummaryString();
	// merge the sigdb note into the trailing engine parenthesis: `(... engine, sigdb: ...)`
	console.log((await versionReplString(parser)).replace(/\)$/, () => `, ${sigdb})`));
}
