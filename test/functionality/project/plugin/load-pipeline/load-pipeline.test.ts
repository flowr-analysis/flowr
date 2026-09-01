import { rPath } from '../../../_helper/r-path';
import { describe, expect, it } from 'vitest';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import type { RObjectData } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { CompressionType, RDAParser } from '../../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import fs from 'fs';
import { FlowrTextFile } from '../../../../../src/project/context/flowr-file';
import path from 'path';
import os from 'os';
import seedrandom from 'seedrandom';
import { RandomRCodeGenerator, SeededRandom } from '../../../util/project/plugin/random-r-code-generator';

describe('rda-files', () => {
	describe('load-pipeline random', () => {
		const runs = 30;
		const seed = 0;
		const objectsPerRun = 5;
		const maxNestingLevel = 1;

		const saveFormats = [
			'TRUE', // ASCII
			'FALSE' // XDR
		];
		const versions = [
			// version 1 is not supported yet
			// '1',
			'2',
			'3'
		];
		const compressions = [
			'"gzip"',
			'"bzip2"',
			// xz decompression is not supported yet
			// '"xz"',
			'FALSE'
		];

		const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-load-pipeline-test-'));

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
					save(${vars.join(', ')}, file="${rPath(file)}", ascii = ${encoding}, version = ${version}, compress = ${compression})`;
				const rShell = new RShellExecutor();
				rShell.run(shellCode);

				const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
				rShell.close();

				expect([...varsAndTypesFromShell.keys()].sort())
					.toEqual(vars.sort());

				const result2 = new RDAParser(new FlowrTextFile(file)).parse();

				expect(result2).toBeDefined();

				expectNames(result2 as RObjectData[], varsAndTypesFromShell);
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

	describe('compression detection', () => {
		const detect = (bytes: number[], withZlib = false) =>
			new RDAParser(new FlowrTextFile('unused')).detectCompression(Buffer.from(bytes), withZlib);

		it.each([
			['gzip',                     [0x1f, 0x8b],                                                               CompressionType.CompGz],
			['bzip2 (first block magic)', [0x42, 0x5a, 0x68, 0x39, 0x31, 0x41, 0x59, 0x26, 0x53, 0x59],              CompressionType.CompBz],
			['bzip2 (second block magic)', [0x42, 0x5a, 0x68, 0x31, 0x17, 0x72, 0x45, 0x38, 0x50, 0x90],             CompressionType.CompBz],
			['zstd',                     [0x28, 0xb5, 0x2f, 0xfd],                                                   CompressionType.CompZstd],
			['xz',                       [0xfd, 0x37, 0x7a, 0x58, 0x5a],                                             CompressionType.CompXz],
			['lzma',                     [0xff, 0x4c, 0x5a, 0x4d, 0x41],                                             CompressionType.CompLzma],
			['lzma_alone',               [0x5d, 0x00, 0x00, 0x80, 0x00],                                             CompressionType.CompLzma],
			['an uncompressed RDX2',     [0x52, 0x44, 0x58, 0x32, 0x0a],                                             CompressionType.CompUnknownOrNo],
			['nothing at all',           [],                                                                         CompressionType.CompUnknownOrNo],
			['a truncated magic',        [0x1f],                                                                     CompressionType.CompUnknownOrNo],
			/* `BZh` with a block size outside 1-9, or with the block magic broken, is not bzip2 */
			['BZh with a bad block size', [0x42, 0x5a, 0x68, 0x30, 0x31, 0x41, 0x59, 0x26, 0x53, 0x59],              CompressionType.CompUnknownOrNo],
			['BZh with a broken magic',  [0x42, 0x5a, 0x68, 0x39, 0x31, 0x41, 0x59, 0x26, 0x53, 0x58],               CompressionType.CompUnknownOrNo],
			['a bzip2 header cut short', [0x42, 0x5a, 0x68, 0x39, 0x31, 0x41, 0x59, 0x26, 0x53],                     CompressionType.CompUnknownOrNo],
		])('recognizes %s', (_what, bytes, expected) => {
			expect(detect(bytes)).toBe(expected);
		});

		it('only takes a bare zlib header for gzip when asked to', () => {
			expect(detect([0x78, 0x9c])).toBe(CompressionType.CompUnknownOrNo);
			expect(detect([0x78, 0x9c], true)).toBe(CompressionType.CompGz);
		});

		it('rejects lzop, which has no reader', () => {
			expect(() => detect([0x89, 0x4c, 0x5a, 0x4f])).toThrow(/lzop/);
		});
	});

	describe('full payloads', () => {
		const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-load-payload-test-'));
		const setup = `
			cx <- complex(real = c(1, 2, 3, 4, 5), imaginary = c(-1, -2, -3, -4, -5))
			iv <- as.integer(c(10, 20, 30))
			rv <- c(1.5, 2.5, 3.5)
			sv <- c("alpha", "beta", paste(rep("x", 1500), collapse = ""))
			rw <- as.raw(c(1, 2, 255))`;

		for(const [ascii, version] of [['FALSE', '2'], ['TRUE', '2'], ['FALSE', '3'], ['TRUE', '3']]) {
			it(`reads every element back (ascii = ${ascii}, version = ${version})`, () => {
				const file = `${tempFolder}/payload_${ascii}_${version}.rda`;
				const rShell = new RShellExecutor();
				rShell.run(`${setup}
					save(cx, iv, rv, sv, rw, file = "${rPath(file)}", ascii = ${ascii}, version = ${version}, compress = FALSE)`);
				rShell.close();

				/* not the shortcut parser: we want the payloads, not just the names */
				const parsed = new RDAParser(new FlowrTextFile(file), false).parse() as RObjectData[];
				const byName = new Map(parsed.map(o => [o.name as string, o.value]));

				expect(byName.get('cx')).toEqual([1, 2, 3, 4, 5].map(r => ({ r, i: -r })));
				expect(byName.get('iv')).toEqual([10, 20, 30]);
				expect(byName.get('rv')).toEqual([1.5, 2.5, 3.5]);
				expect(byName.get('sv')).toEqual(['alpha', 'beta', 'x'.repeat(1500)]);
				expect(byName.get('rw')).toEqual([1, 2, 255]);
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

				const result2 = new RDAParser(new FlowrTextFile(file)).parse();

				expect(result2).toBeDefined();

				expectNames(result2 as RObjectData[], varsAndTypesFromShell);
			});
		}
	});
});

/**
 * Loads an RDA file in a fresh R environment and returns a map of variable names to their types.
 * @param file   - Path to the RDA file to load
 * @param rShell - The R shell executor to use for running the R code
 * @returns      A map from variable name to its R type string
 */
export function getVarsAndTypesFromShell(file: string, rShell: RShellExecutor) {
	const output = rShell.run(`
		e <- new.env()
		
		vars <- load("${rPath(file)}", envir = e)

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

function expectNames(result: RObjectData[], vars: ReadonlyMap<string, string>) {
	expect(result?.flatMap(x => x.name).sort()).toEqual([...vars.keys()].sort());
}

/* Maps the {@link SexpType} to its string representation in the R shell*/
export const SexpToRType = {
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
	16: 'string',
	17: '...',
	19: 'list',
	20: 'expression',
	24: 'raw',
	25: 'S4',
} as const;

function _expectTypes(result: RObjectData[], types: ReadonlyMap<string, string>) {
	for(const obj of result) {
		const expected = types.get(obj.name as string);

		if(obj.type === 4) {
			expect(['NULL', 'environment']).toContain(expected);
			continue;
		}

		const actualType = (SexpToRType as Record<number, string>)[obj.type as number];

		if(actualType !== expected) {
			console.log(obj);
			console.log(types.get(obj.name as string));

		}

		expect(actualType).toBe(expected);
	}
}