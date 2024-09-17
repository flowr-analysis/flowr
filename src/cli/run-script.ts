import type { StdioProcessor } from './repl/execute';
import { waitOnScript } from './repl/execute';
import { scripts } from './common/scripts-info';
import path from 'path';

/**
 * Path-safe helper of {@link waitOnScript} for other flowR scripts.
 *
 * @see waitOnScript
 */
export async function runScript(name: keyof typeof scripts, args: readonly string[], io?: StdioProcessor, exitOnError = false): Promise<void> {
	return waitOnScript(path.resolve(__dirname,scripts[name].target), args, io, exitOnError);
}
