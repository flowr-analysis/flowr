import { retrieveVersionInformation } from './commands/repl-version';
import type { KnownParser } from '../../r-bridge/parser';

export async function versionReplString(parser: KnownParser): Promise<string> {
	const version = await retrieveVersionInformation(parser);
	return `flowR repl using flowR ${version.flowr}, R ${version.r}, engine ${version.engine}`;
}
export async function printVersionRepl(parser: KnownParser): Promise<void> {
	console.log(await versionReplString(parser));
}
