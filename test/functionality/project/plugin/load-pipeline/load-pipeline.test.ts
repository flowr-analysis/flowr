import { describe, expect, it } from 'vitest';
import { RandomRCodeGenerator, SeededRandom } from '../../../util/project/plugin/random-r-code-generator';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { RDAParser } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { FlowrTextFile } from '../../../../../src/project/context/flowr-file';
import seedrandom from 'seedrandom';
import fs from 'fs';
import path from 'path';

describe('rda-files', () => {
	describe('load-pipeline random', () => {
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

				const shellCode = `${rCode}
					save(${vars.join(', ')}, file="${file}", ascii = ${encoding}, version = ${version})`;
				const rShell = new RShellExecutor();
				rShell.run(shellCode);

				const shellVars = getVarsFromShell(file, rShell);
				rShell.close();

				expect(shellVars)
					.toEqual(vars.sort());

				const parser = new RDAParser();
				const result = await timed(
					`run ${i} - no shortcut`,
					() => parser.parseRDA(new FlowrTextFile(file))
				);

				expect(result).toBeDefined();

				expect(result?.flatMap(x => x.name)).toEqual(vars);

				// -----------------------------------------------------------------------------------------------------

				const shortcutParser = new RDAParser();
				const result2 = await timed(
					`run ${i} - shortcut`,
					() => shortcutParser.parseRDA(new FlowrTextFile(file), true)
				);

				expect(result2).toBeDefined();

				expect(result2?.flatMap(x => x.name)).toEqual(vars);
			});
		}
	});

	describe('load-pipeline real-world', () => {
		const dir = 'test/testfiles/project/plugins/rda-files/';
		const files = fs.readdirSync(dir).filter(file => file.toLowerCase().endsWith('.rdata') || file.toLowerCase().endsWith('.rda')).map(file => path.join(dir, file));

		for(const file of files) {
			it(`File: ${file}`, async() => {
				const rShell = new RShellExecutor();
				const shellVars = getVarsFromShell(file, rShell);
				rShell.close();

				if(!shellVars || shellVars.length === 0) {
					return;
				}

				const parser = new RDAParser();
				const result = await timed(
					`${file} - no shortcut`,
					() => parser.parseRDA(new FlowrTextFile(file))
				);

				expect(result).toBeDefined();

				expect(result?.flatMap(x => x.name).sort()).toEqual(shellVars.sort());

				// -----------------------------------------------------------------------------------------------------

				const shortcutParser = new RDAParser();
				const result2 = await timed(
					`run ${file} - shortcut`,
					() => shortcutParser.parseRDA(new FlowrTextFile(file), true)
				);

				expect(result2).toBeDefined();

				expect(result2?.flatMap(x => x.name).sort()).toEqual(shellVars.sort());
			});
		}
	});
});

function getVarsFromShell(file: string, rShell: RShellExecutor) {
	const vars = rShell.run(`
		e <- new.env()
		print(load("${file}", envir = e))
		rm(e)
		gc()
	`);
	return parseROutputToList(vars).sort();
}

function parseROutputToList(output: string): string[] {
	return output
		.split('\n')
		.flatMap(line => line.match(/"([^"]+)"/g) || [])
		.map(s => s.replace(/"/g, ''));
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
	const t0 = performance.now();
	const res = await fn();
	const t1 = performance.now();

	console.log(`${label}: ${t1 - t0} ms`);
	return res;
}