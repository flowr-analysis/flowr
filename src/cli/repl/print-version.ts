import type { KnownParser } from '../../r-bridge/parser';
import { retrieveVersionInformation } from '../../util/version';
import { defaultPkgDbPath, PkgDatabase } from '../../project/plugins/package-version-plugins/pkgdb';

/** a short `, package database: <scope> <date>` suffix for the bundled database, or empty if none */
export function pkgDbReplSuffix(): string {
	try {
		if(typeof process !== 'undefined' && process.env?.FLOWR_DISABLE_DEFAULT_PKGDB) {
			return '';
		}
		const path = defaultPkgDbPath();
		if(path === undefined) {
			return '';
		}
		const db = PkgDatabase.fromFileSync(path);
		return `, pkg-db: ${db.scope}/${db.content.date}`;
	} catch{
		return '';
	}
}

/**
 * Returns a version string for the REPL including flowR, R, and the package database in use.
 */
export async function versionReplString(parser: KnownParser): Promise<string> {
	const version = await retrieveVersionInformation(parser);
	const rVersion = version.r === 'none' ? '' : version.r === 'unknown' ? ', R version unknown' : `, R v${version.r}`;
	const treeSitterVer = parser.name === 'tree-sitter' ? `, R grammar v${parser.treeSitterVersion()}` : '';
	return `flowR repl v${version.flowr}${rVersion}${treeSitterVer} (${version.engine} engine${pkgDbReplSuffix()})`;
}

/**
 * Prints the version information for the REPL including flowR and R version.
 */
export async function printVersionRepl(parser: KnownParser): Promise<void> {
	console.log(await versionReplString(parser));
}
