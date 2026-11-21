import { describe, test, assert } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { executeLintingRule } from '../../../../src/linter/linter-executor';
import { LintingResults } from '../../../../src/linter/linter-format';

/** R 4.6 `save()` outputs of a small object, as hex: `x <- 1` (ascii, binary, gzip, version 2, bzip2, xz), `.Random.seed` and `y <- 2` */
const Saves: Readonly<Record<string, string>> = {
	ascii: '524441330a410a330a3236333638310a3139373838380a350a5554462d380a313032360a310a3236323135330a310a780a31340a310a310a3235340a',
	bin:   '524458330a580a000000030004060100030500000000055554462d3800000402000000010004000900000001780000000e000000013ff0000000000000000000fe',
	gz:    '1f8b08000000000000030b728930e68ae06260606066606163646066053219584343dc742d18185898801c460616064e105d0124f8400cfb0f0c30f00f009c80659441000000',
	v2:    '524458320a580a00000002000406010002030000000402000000010004000900000001780000000e000000013ff0000000000000000000fe',
	bz:    '425a6839314159265359cd345c8700001b5e80ff310002084085001640004040012000545068d1a1a681834f524d0da8d1a189331a45226b025d0cd4440b83919c6521398edfd95b7faf9cdeca2a0c2ee48a70a1219a68b90e',
	xz:    'fd377a585a0000016922de36020021011c00000010cf58cce0004000345d00291107546811e46e52caa033c5250703ba5e64da7c00414989fb1b42f93abd073ec2b20e8738cdea1dd813d56d18e3eca4a4dc00009c80659400014c4124c4917d9042990d010000000001595a',
	seed:  '524458330a580a000000030004060100030500000000055554462d380000040200000001000400090000000c2e52616e646f6d2e736565640000000d0000000100000001000000fe',
	yy:    '524458330a580a000000030004060100030500000000055554462d3800000402000000010004000900000001790000000e000000014000000000000000000000fe'
};

/** lints a package on disk (the files are written to a fresh folder) and answers the kind, file and message of each finding */
async function lintOnDisk(files: Readonly<Record<string, string | Buffer>>, config: Record<string, unknown> = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-pkg-data-'));
	try {
		for(const [f, c] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
			fs.writeFileSync(path.join(root, f), c);
		}
		fs.mkdirSync(path.join(root, 'R'), { recursive: true });
		fs.writeFileSync(path.join(root, 'R', 'code.R'), 'x <- 1');
		const analyzer = await new FlowrAnalyzerBuilder().build();
		analyzer.addRequest(`file://${root}`);
		await analyzer.dataflow();
		const results = LintingResults.unpackSuccess(await executeLintingRule('package-data', analyzer, config));
		return results.results.map(r => ({ kind: r.kind, file: r.file, message: r.message }));
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

const Pkg = 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n';
const Ascii3 = 'RDA3\nA\n3\n';
const Ascii2 = 'RDA2\nA\n2\n';

describe('flowR linter', withTreeSitter(parser => {
	describe('package-data', () => {
		describe('contents of the data directory', () => {
			assertLinterPackage('allowed data files are fine', parser, 'x <- 1', 'package-data', [], {
				files: { 'data/x.csv': 'a,b', 'data/y.R': 'y <- 1', 'data/z.tab.gz': '' }
			});
			assertLinterPackage('file type R does not read as data', parser, 'x <- 1', 'package-data', [
				{ kind: 'data-directory', file: 'data/notes.md' }
			], { files: { 'data/notes.md': 'hi' } });
			assertLinterPackage('upper-case RDA extension is not allowed', parser, 'x <- 1', 'package-data', [
				{ kind: 'data-directory', file: 'data/x.RDA' }
			], { files: { 'data/x.RDA': '' } });
			assertLinterPackage('subdirectory in data', parser, 'x <- 1', 'package-data', [
				{ kind: 'data-directory', file: 'data/sub' }
			], { files: { 'data/sub/x.csv': '' } });
			assertLinterPackage('hidden files are not listed by R', parser, 'x <- 1', 'package-data', [], {
				files: { 'data/.gitkeep': '', 'data/x.csv': '' }
			});
			assertLinterPackage('datalist with a malformed line', parser, 'x <- 1', 'package-data', [
				{ kind: 'data-directory', file: 'data/datalist', loc: [2, 1, 2, 1, '/pkg/data/datalist'] }
			], { files: { 'data/datalist': 'x: a\nbad line here\n', 'data/x.csv': '' } });
			assertLinterPackage('datalist entries are fine', parser, 'x <- 1', 'package-data', [], {
				files: { 'data/datalist': 'x: a, b\ny\n', 'data/x.csv': '' }
			});
		});

		describe('LazyData', () => {
			assertLinterPackage('LazyData without data directory', parser, 'x <- 1', 'package-data', [
				{ kind: 'lazydata', file: 'DESCRIPTION', loc: [3, 1, 3, 1, '/pkg/DESCRIPTION'] }
			], { files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: true\n' } });
			assertLinterPackage('LazyData with data directory', parser, 'x <- 1', 'package-data', [], {
				files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: true\n', 'data/x.csv': '' }
			});
			assertLinterPackage('LazyData off, compression stated', parser, 'x <- 1', 'package-data', [
				{ kind: 'lazydata', file: 'DESCRIPTION', message: '\'LazyDataCompression\' is specified without \'LazyData\'' }
			], { files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: no\nLazyDataCompression: xz\n' } });
			assertLinterPackage('LazyData off, nothing stated', parser, 'x <- 1', 'package-data', [], {
				files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: no\n' }
			});
			assertLinterPackage('LazyDataCompression without data directory', parser, 'x <- 1', 'package-data', [
				{ kind: 'lazydata', file: 'DESCRIPTION', message: '\'LazyData\' is specified without a \'data\' directory' },
				{ kind: 'lazydata', file: 'DESCRIPTION', message: '\'LazyDataCompression\' is specified without a \'data\' directory' }
			], { files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: true\nLazyDataCompression: xz\n' } });
			assertLinterPackage('LazyDataCompression without LazyData', parser, 'x <- 1', 'package-data', [
				{ kind: 'lazydata', file: 'DESCRIPTION', loc: [4, 1, 4, 1, '/pkg/DESCRIPTION'] }
			], { files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLicense: MIT\nLazyDataCompression: gzip\n', 'data/x.csv': '' } });
			assertLinterPackage('undocumented LazyDataCompression value', parser, 'x <- 1', 'package-data', [
				{ kind: 'lazydata', file: 'DESCRIPTION', message: 'undocumented value \'lz4\' of field \'LazyDataCompression\'' }
			], { files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: true\nLazyDataCompression: lz4\n', 'data/x.csv': '' } });
			assertLinterPackage('documented LazyDataCompression values', parser, 'x <- 1', 'package-data', [], {
				files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLazyData: yes\nLazyDataCompression: none\n', 'data/x.csv': '' }
			});
		});

		describe('saves in memory', () => {
			assertLinterPackage('saves are only read from disk', parser, 'x <- 1', 'package-data', [], {
				files: { 'data/x.rda': 'RDA3\nA\n3\n', 'R/sysdata.rda': 'RDA3\nA\n3\n' }, maxUncompressedSize: 1
			});
		});

		describe('on disk', () => {
			const Recent = `${Pkg}Depends: R (>= 3.5.0)\n`;
			const Ascii2Bytes = Buffer.from(Ascii2);
			test('version 3 save without R >= 3.5.0', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'data/x.rda': Buffer.from(Ascii3) }).then(r => r.map(x => [x.kind, x.file])), [['serialization-version', 'data/x.rda']]);
			});
			test('version 3 save with R >= 3.5.0 in Depends', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/x.rda': Buffer.from(Ascii3) }), []);
			});
			test('R >= 3.5 in Depends is enough', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': `${Pkg}Depends: methods, R (>= 3.5)\n`, 'data/x.rda': Buffer.from(Ascii3) }), []);
			});
			test('R >= 3.4.0 in Depends is not enough, also for system data', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': `${Pkg}Depends: R (>= 3.4.0)\n`, 'R/sysdata.rda': Buffer.from(Ascii3) }).then(r => r.map(x => [x.kind, x.file])), [['serialization-version', 'R/sysdata.rda']]);
			});
			test('version 2 save needs no R version', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'data/x.rda': Ascii2Bytes }), []);
			});
			test('ASCII save above the limit', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/x.rda': Ascii2Bytes }, { maxUncompressedSize: 5 }), [
					{ kind: 'compact-data', file: 'data/x.rda', message: 'large data file saved inefficiently (ASCII format, uncompressed, 0Kb)' }
				]);
			});
			test('ASCII save below the default limit', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/x.rda': Ascii2Bytes }), []);
			});
			test('ASCII system data above the limit', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'R/sysdata.rda': Ascii2Bytes }, { maxUncompressedSize: 5 }).then(r => r.map(x => [x.kind, x.file])), [['compact-sysdata', 'R/sysdata.rda']]);
			});
			test('compaction check disabled', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/x.rda': Ascii2Bytes }, { maxUncompressedSize: 5, checkCompaction: false }), []);
			});
			test('uncompressed binary save', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/bin.rda': Buffer.from(Saves.bin, 'hex') }, { maxUncompressedSize: 10 }), [
					{ kind: 'compact-data', file: 'data/bin.rda', message: 'large data file saved inefficiently (uncompressed, 0Kb)' }
				]);
			});
			test('gzip save is fine', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/gz.rda': Buffer.from(Saves.gz, 'hex') }, { maxUncompressedSize: 10 }), []);
			});
			test('ASCII save is inefficient, as it is uncompressed too', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/ascii.rda': Buffer.from(Saves.ascii, 'hex') }, { maxUncompressedSize: 10 }), [
					{ kind: 'compact-data', file: 'data/ascii.rda', message: 'large data file saved inefficiently (ASCII format, uncompressed, 0Kb)' }
				]);
			});
			test('bzip2 save needs R >= 2.10 (and a version 3 save needs R >= 3.5.0)', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'data/bz.rda': Buffer.from(Saves.bz, 'hex') }).then(r => r.map(x => [x.kind, x.file])), [
					['serialization-version', 'data/bz.rda'],
					['compression-depends', 'DESCRIPTION']
				]);
			});
			test('bzip2 save with R >= 2.10 in Depends', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': `${Pkg}Depends: R (>= 2.10)\n`, 'data/bz.rda': Buffer.from(Saves.bz, 'hex') }).then(r => r.map(x => x.kind)), [
					'serialization-version'
				]);
			});
			test('xz save needs R >= 2.10 although its content is not read', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'data/xz.rda': Buffer.from(Saves.xz, 'hex') }).then(r => r.map(x => x.kind)), ['compression-depends']);
			});
			test('version 3 gzip save in inst is still checked', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'inst/extdata/gz.rda': Buffer.from(Saves.gz, 'hex') }).then(r => r.map(x => [x.kind, x.file])), [
					['serialization-version', 'inst/extdata/gz.rda']
				]);
			});
			test('version 2 uncompressed save needs no R version', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Pkg, 'data/v2.rda': Buffer.from(Saves.v2, 'hex') }, { maxUncompressedSize: 10 }).then(r => r.map(x => x.kind)), ['compact-data']);
			});
			test('.Random.seed in a data set', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/seed.rda': Buffer.from(Saves.seed, 'hex') }), [
					{ kind: 'data-directory', file: 'data/seed.rda', message: 'object \'.Random.seed\' found in data set \'seed.rda\', please remove it' }
				]);
			});
			test('undocumented data set named by the save, not its file', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'man/x.Rd': '\\name{x}\\alias{x}\\title{X}\n', 'data/yy.rda': Buffer.from(Saves.yy, 'hex') }), [
					{ kind: 'undocumented-data', file: 'data/yy.rda', message: 'undocumented data set \'y\'' }
				]);
			});
			test('documented data set', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'man/y.Rd': '\\name{y}\\alias{y}\\title{Y}\n', 'data/yy.rda': Buffer.from(Saves.yy, 'hex') }), []);
			});
			test('data sets without a man folder are not checked for documentation', async() => {
				assert.deepStrictEqual(await lintOnDisk({ 'DESCRIPTION': Recent, 'data/yy.rda': Buffer.from(Saves.yy, 'hex') }), []);
			});
		});
	});
}));
