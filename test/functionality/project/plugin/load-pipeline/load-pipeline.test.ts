import { describe, expect, it } from 'vitest';
import { RandomRCodeGenerator, SeededRandom } from '../../../util/project/plugin/random-r-code-generator';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import type { RObjectData } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { RDAParser } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { FlowrTextFile } from '../../../../../src/project/context/flowr-file';
import seedrandom from 'seedrandom';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

		const tempFolder = fs.mkdtempSync(path.resolve(os.tmpdir(), '/tmp/flowr-load-pipeline-test'));

		for(let i = 0; i < runs; i++) {
			const file = `${tempFolder}/test_${i}.rda`;
			const rng = seedrandom((seed + i).toString());
			const rnd = new SeededRandom(rng);

			const encoding = rnd.pick(saveFormats);
			const version = rnd.pick(versions);
			const compression = rnd.pick(compressions);

			it(`Encoding: ${encoding}, Version: ${version}, Compression: ${compression} - run ${i} - seed ${seed + i}`, () => {

				const rcg = new RandomRCodeGenerator(rnd);

				const { rCode, vars } = rcg.generateRCode(objectsPerRun, maxNestingLevel);

				const shellCode = `${rCode}
					save(${vars.join(', ')}, file="${file}", ascii = ${encoding}, version = ${version})`;
				const rShell = new RShellExecutor();
				rShell.run(shellCode);

				const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
				rShell.close();

				expect([...varsAndTypesFromShell.keys()].sort())
					.toEqual(vars.sort());

				// const parser = new RDAParser();
				// const result = timed(
				// `run ${i} - no shortcut`,
				// () => parser.parseRDA(new FlowrTextFile(file))
				// );
				//
				// expect(result).toBeDefined();
				//
				// expectNames(result as RObjectData[], varsAndTypesFromShell);

				// expectTypes(result as RObjectData[], varsAndTypesFromShell);

				// -----------------------------------------------------------------------------------------------------

				const shortcutParser = new RDAParser();
				const result2 = shortcutParser.parseRDA(new FlowrTextFile(file), true);

				expect(result2).toBeDefined();

				expectNames(result2 as RObjectData[], varsAndTypesFromShell);

				// expectTypes(result2 as RObjectData[], varsAndTypesFromShell);
			});
		}

		process.on('exit', () => {
			try {
				fs.rmSync(tempFolder, { recursive: true, force: true });
			} catch(e) {
				console.error('Error during cleanup:', e);
			}
		});
	});

	describe('load-pipeline real-world', () => {
		const dir = 'test/functionality/project/plugin/load-pipeline/zenodo/files';
		if(!(fs.existsSync(dir) && fs.readdirSync(dir).length > 0)) {
			it.skip('skipped - no RDA files found', () => {});
			return;
		}

		const files = fs.readdirSync(dir).filter(file => file.toLowerCase().endsWith('.rdata') || file.toLowerCase().endsWith('.rda')).map(file => path.join(dir, file));

		for(const file of files) {
			it(`File: ${file}`, () => {
				const rShell = new RShellExecutor();
				const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
				rShell.close();

				if(!varsAndTypesFromShell || varsAndTypesFromShell.size === 0) {
					return;
				}

				// const parser = new RDAParser();
				// const result = parser.parseRDA(new FlowrTextFile(file));
				//
				// expect(result).toBeDefined();
				//
				// expectNames(result as RObjectData[], varsAndTypesFromShell);
				// -----------------------------------------------------------------------------------------------------

				const shortcutParser = new RDAParser();
				const result2 = shortcutParser.parseRDA(new FlowrTextFile(file), true);

				expect(result2).toBeDefined();

				expectNames(result2 as RObjectData[], varsAndTypesFromShell);

				// expectTypes(result2 as RObjectData[], varsAndTypesFromShell);
			});
		}
	});
});

/**
 * Loads an RDA file in a fresh R environment and returns a map of variable names to their types.
 * @param file    - Path to the RDA file to load
 * @param rShell  - The R shell executor to use for running the R code
 * @returns A map from variable name to its R type string
 */
export function getVarsAndTypesFromShell(file: string, rShell: RShellExecutor) {
	const output = rShell.run(`
		e <- new.env()
		
		vars <- load("${file}", envir = e)

		for(v in vars) {
			cat(v, "::", typeof(e[[v]]), "\\n")
		}
	`);

	const result = new Map<string, string>();

	for(const line of output.split('\n')) {
		const [name, type] = line.split('::').map(x => x.trim());

		if(name && type) {
			result.set(name, type);
		}
	}

	return result;
}

function expectNames(result: RObjectData[], vars: Map<string, string>) {
	expect(result?.flatMap(x => x.name).sort()).toEqual([...vars.keys()].sort());
}

const SexpToRType: Record<number, string> = {
	0:  'NULL',
	1:  'symbol',
	2:  'pairlist',
	3:  'closure',
	4:  'environment',
	5:  'prom',
	6:  'language',
	7:  'special',
	8:  'builtin',
	9:  'character',
	10: 'logical',
	13: 'integer',
	14: 'double',
	15: 'complex',
	16: 'character',
	17: '...',
	19: 'list',
	20: 'expression',
	24: 'raw',
	25: 'S4',
};

function _expectTypes(result: RObjectData[], types: Map<string, string>) {
	for(const obj of result) {
		const expected = types.get(obj.name as string);

		if(obj.type === 4) {
			expect(['NULL', 'environment']).toContain(expected);
			continue;
		}

		const actualType = SexpToRType[obj.type as number];

		if(actualType !== expected) {
			console.log(obj);
			console.log(types.get(obj.name as string));

		}

		expect(actualType).toBe(expected);
	}
}