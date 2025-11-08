import type { KnownParser } from '../../r-bridge/parser';
import { retrieveVersionInformation } from '../../util/version';

/**
 *
 */
export async function versionReplString(parser: KnownParser): Promise<string> {
	const version = await retrieveVersionInformation(parser);
	const rVersion = version.r === 'none' ? '' : version.r === 'unknown' ? ', R version unknown' : `, R v${version.r}`;
	const treeSitterVer = parser.name === 'tree-sitter' ? `, R grammar v${parser.treeSitterVersion()}` : '';
	return `flowR repl using flowR v${version.flowr}${rVersion}${treeSitterVer} (${version.engine} engine)`;
}
/**
 *
 */
export async function printVersionRepl(parser: KnownParser): Promise<void> {
	console.log(await versionReplString(parser));
}
