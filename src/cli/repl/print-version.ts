import { retrieveVersionInformation } from './commands/repl-version';
import type { KnownParser } from '../../r-bridge/parser';

export async function printVersionRepl(parser: KnownParser): Promise<void> {
	const version = await retrieveVersionInformation(parser);
	console.log(`flowR repl using flowR ${version.flowr}, R ${version.r}, engine ${version.engine}`);
}
