import { $, sleep } from 'zx';

export async function repl(input: string[]): Promise<string> {
	const proc = $`npm run flowr`.quiet().timeout('30s');

	let i = 0;
	proc.stdout.on('data', (d) => {
		const data = d as Buffer;

		if(data.toString().includes('R>')) {
			if(i < input.length) {
				proc.stdin.write(`${input[i++]}\n`);
			}
		}
	});

	const output = await proc.text();
	proc.stdin.end();
	return output;
}

export async function npmRun(cmd: string, args: string): Promise<string> {
	const proc = $`npm run ${cmd} -- ${args}`.quiet();
	await sleep('5s');
	await proc.kill();
	return proc.text();
}
