import type { ExecException } from 'child_process';
import { exec } from 'child_process';

/** How long a command may take, generous because the checkup jobs run alongside. */
const DefaultTimeout = 5 * 60 * 1000;

/** the cli the global setup bundled, run directly so no test rebuilds it while another one runs it */
export const FlowrBin = 'node dist/src/cli/flowr.min.js';

/**
 * A child that died on a signal did not fail the test, it stopped existing: a V8 abort, an OOM kill, the timeout
 * killing it. Those are worth one more attempt, where a clean non-zero exit is a verdict to report as-is.
 */
function diedAbnormally(error: ExecException): boolean {
	return error.signal !== undefined && error.signal !== null;
}

/** Everything known about a failed command, so a crash in CI is diagnosable from the message alone. */
function failure(command: string, error: ExecException, stdout: string, stderr: string): Error {
	const how = diedAbnormally(error) ? `killed by ${error.signal}` : `exit code ${error.code ?? 'unknown'}`;
	return Object.assign(
		new Error(`\`${command}\` failed (${how})\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`),
		{ crashed: diedAbnormally(error) }
	);
}

/** Runs `attempt` again once if the first run did not fail but died; see {@link diedAbnormally}. */
async function retryOnCrash<T>(attempt: () => Promise<T>): Promise<T> {
	try {
		return await attempt();
	} catch(e) {
		if(!(e as { crashed?: boolean }).crashed) {
			throw e;
		}
		console.error(`retrying once, the command did not fail but died: ${(e as Error).message.split('\n')[0]}`);
		return await attempt();
	}
}

/**
 * Runs the flowr repl and feeds input to the repl
 * @param input - input to feed
 * @returns Repl Output
 */


/**
 *
 */
export async function flowrRepl(input: string[]): Promise<string> {
	return retryOnCrash(() => new Promise<string>((resolve, reject) => {
		const child = exec(FlowrBin, { timeout: DefaultTimeout }, (error, stdout, stderr) => {
			if(error) {
				reject(failure(FlowrBin, error, stdout, stderr));
				return;
			}

			resolve(stdout);
		});

		// Send new data when flowr sends us the 'R>' prompt to avoid
		// sending data too fast
		let i = 0;
		child.stdout?.on('data', (d) => {
			const data = d as Buffer;

			if(data.toString().includes('R>')) {
				if(i < input.length) {
					child.stdin?.write(`${input[i++]}\n`);
				}
			}
		});
	}));
}

/**
 * Like {@link run}, but returns the combined stdout and stderr so diagnostics printed to stderr can be asserted on.
 * @param command - Command to run
 * @param timeout - (optional) timeout in milliseconds
 */
export async function runCaptureAll(command: string, timeout = DefaultTimeout): Promise<string> {
	return retryOnCrash(() => new Promise<string>((resolve, reject) => {
		exec(command, { timeout }, (error, stdout, stderr) => {
			const output = `${stdout}${stderr}`;
			if(error && output.length === 0) {
				reject(failure(command, error, stdout, stderr));
			} else {
				resolve(output);
			}
		});
	}));
}

/**
 * Runs a command and terminates it automatically if it outputs a certain string
 * This is useful, so we don't have to set timeouts and hope the output will be produced in time.
 * @param command - Command to run
 * @param terminateOn - (optional) string to kill the process on
 * @param timeout - (optional) timeout in milliseconds
 * @returns output of command
 */
export async function run(command: string, terminateOn?: string, timeout = DefaultTimeout): Promise<string> {
	return retryOnCrash(() => new Promise<string>((resolve, reject) => {
		const child = exec(command, { timeout }, (error, stdout, stderr) => {
			if(error) {
				reject(failure(command, error, stdout, stderr));
				return;
			}

			resolve(stdout);
		});

		if(terminateOn) {
			let buffer = '';
			child.stdout?.on('data', (d: Buffer) => {
				buffer += d.toString();

				if(buffer.includes(terminateOn)) {
					child.kill('SIGKILL');
					resolve(buffer);
				}
			});
		}
	}));
}

