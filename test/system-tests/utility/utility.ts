import { exec } from 'child_process';

/**
 * Runs the flowr repl and feeds input to the repl
 * @param input - input to feed 
 * @returns Repl Output
 */

export async function flowrRepl(input: string[]): Promise<string> {
	const process = new Promise<string>((resolve, reject) => {
		const child = exec('npm run flowr', { timeout: 60 * 1000 }, (error, stdout, _) => {
			if(error) {
				reject(`${error.name}: ${error.message}\ns${stdout}`);
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
 * Runs a command and terminates it automaticaly if it outputs a certain string 
 * This is useful so we don't have to set timeouts and hope the output will be produced in time
 * 
 * @param command - Command to run
 * @param terminateOn - (optional) string to kill the process on
 * @returns output of command
 */
export async function run(command: string, terminateOn?: string): Promise<string> {
	const process = new Promise<string>((resolve, reject) => {
		const child = exec(command, { timeout: 60 * 1000 }, (error, stdout, _) => {
			if(error) {
				reject(`${error.name}: ${error.message}\ns${stdout}`);
			}

			resolve(stdout);
		});

		if(terminateOn) {
			child.stdout?.on('data', (d) => {
				const data = d as Buffer;
		
				if(data.toString().includes(terminateOn)) {
					child.kill();
				}
			});
		}	
	});

	return await process;
}

