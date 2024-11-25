import { $ } from 'zx';

export async function repl(input: string[]): Promise<string> {
	const proc = $`npm run flowr`.quiet().timeout('10s');

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
