import { retrieveVersionInformation } from './commands/repl-version';
import type { KnownParser } from '../../r-bridge/parser';

export async function versionReplString(parser: KnownParser): Promise<string> {
	const version = await retrieveVersionInformation(parser);
	const rVersion = version.r === 'none' ? '' : version.r === 'unknown' ? ', R version unknown' : `, R v${version.r}`;
	return `flowR repl using flowR v${version.flowr}${rVersion} (${version.engine} engine)`;
}
export async function printVersionRepl(parser: KnownParser): Promise<void> {
	console.log(await versionReplString(parser));
}
