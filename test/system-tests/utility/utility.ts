import { exec } from 'child_process';

/**
 * Runs the flowr repl and feeds input to the repl
 * @param input - input to feed
 * @returns Repl Output
 */

/**
 *
 */
export async function flowrRepl(input: string[]): Promise<string> {
	const process = new Promise<string>((resolve, reject) => {
		const child = exec('npm run flowr', { timeout: 60 * 1000 }, (error, stdout, _) => {
			if(error) {
				reject(new Error(`${error.name}: ${error.message}\n${stdout}`));
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
	});

	return await process;
}

/**
 * Runs a command and terminates it automatically if it outputs a certain string
 * This is useful, so we don't have to set timeouts and hope the output will be produced in time.
 * @param command - Command to run
 * @param terminateOn - (optional) string to kill the process on
 * @param timeout - (optional) timeout in milliseconds
 * @returns output of command
 */
export async function run(command: string, terminateOn?: string, timeout = 60 * 1000): Promise<string> {
	const process = new Promise<string>((resolve, reject) => {
		const child = exec(command, { timeout }, (error, stdout, _) => {
			if(error) {
				reject(new Error(`${error.name}: ${error.message}\n${stdout}`));
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
	});

	return await process;
}

