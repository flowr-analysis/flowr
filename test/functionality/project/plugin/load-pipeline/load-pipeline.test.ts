import { describe, expect, it } from 'vitest';
import { RandomRCodeGenerator, SeededRandom } from '../../../util/project/plugin/random-r-code-generator';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { parseRDA } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { FlowrTextFile } from '../../../../../src/project/context/flowr-file';
import seedrandom from 'seedrandom';

describe('load-pipeline', () => {
	const runs = 300;
	const seed = 0;
	const objectsPerRun = 5;
	const maxNestingLevel = 1;

	const saveFormats = [
		'TRUE', // ASCII
		'FALSE' // XDR
	];
	const versions = [
		// '1',
		'2',
		'3'
	];
	const compressions = [
		'gzip',
		'bzip2',
		'xz',
		'none'
	];

	for(let i = 0; i < runs; i++) {
		const file = `/tmp/test_${i}.rda`;
		const rng = seedrandom((seed + i).toString());
		const rnd = new SeededRandom(rng);
		const encoding = rnd.pick(saveFormats);
		const version = rnd.pick(versions);
		const compression = rnd.pick(compressions);

		it(`Encoding: ${encoding}, Version: ${version}, Compression: ${compression} - run ${i} - seed ${seed + i}`, async() => {

			const rcg = new RandomRCodeGenerator(rnd);

			const { rCode, vars } = rcg.generateRCode(objectsPerRun, maxNestingLevel);

			const shellCode = `
			${rCode}
			save(${vars.join(', ')}, file="${file}", ascii = ${encoding}, version = ${version})
			`;

			const rShell = new RShellExecutor();
			rShell.run(shellCode);
			const shellResult = rShell.run(`print(load("${file}"))`);

			expect(parseROutputToList(shellResult).sort())
				.toEqual(vars.sort());

			const result = await parseRDA(new FlowrTextFile(file));

			expect(result).toBeDefined();
			if(!result) {
				throw new Error(`Run ${i} failed`);
			}

			expect(result.flatMap(x => x.name)).toEqual(vars);
		});
	}
});

function parseROutputToList(output: string): string[] {
	return output
		.split('\n')
		.flatMap(line => line.match(/"([^"]+)"/g) || [])
		.map(s => s.replace(/"/g, ''));
}