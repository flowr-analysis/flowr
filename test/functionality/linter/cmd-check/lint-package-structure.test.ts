import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { PackageStructureConfig, PackageStructureResult } from '../../../../src/linter/rules/cmd-check/package-structure';

/** lints the files of a package in memory; only `kind` and `file` of the findings are compared */
function lint(parser: Parameters<typeof assertLinterPackage>[1], name: string, files: Record<string, string | null>, expected: readonly (readonly [string, string])[], config: Partial<PackageStructureConfig> = {}) {
	assertLinterPackage(name, parser, 'x <- 1', 'package-structure', expected.map(([kind, file]) => ({ kind, file })), { files, ...config });
}

/** makes every directory below `dir` accessible again so that it can be deleted */
function restorePermissions(dir: string): void {
	for(const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if(e.isDirectory()) {
			fs.chmodSync(path.join(dir, e.name), 0o755);
			restorePermissions(path.join(dir, e.name));
		}
	}
}

/** lints a package on disk, answering `[kind, file]` pairs; the package is deleted afterwards */
async function lintOnDisk(setup: (root: string) => void, config: Partial<PackageStructureConfig> = {}): Promise<[string, string][]> {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-structure-'));
	try {
		fs.writeFileSync(path.join(root, 'DESCRIPTION'), 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n');
		fs.mkdirSync(path.join(root, 'R'));
		fs.writeFileSync(path.join(root, 'R', 'a.R'), 'x <- 1\n');
		setup(root);
		const analyzer = await new FlowrAnalyzerBuilder().build();
		analyzer.addRequest(`file://${root}`);
		await analyzer.dataflow();
		const linted = await analyzer.query([{ type: 'linter', rules: [{ name: 'package-structure', config }] as never }]);
		const results = (linted.linter.results['package-structure'] as unknown as { results: PackageStructureResult[] }).results;
		return results.map(r => [r.kind, r.file] as [string, string]).sort();
	} finally {
		restorePermissions(root);
		fs.rmSync(root, { recursive: true, force: true });
	}
}

const write = (root: string, rel: string, content: string | Buffer = '', mode?: number) => {
	fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
	fs.writeFileSync(path.join(root, rel), content);
	if(mode !== undefined) {
		fs.chmodSync(path.join(root, rel), mode);
	}
};

describe('flowR linter', withTreeSitter(parser => {
	describe('package-structure', () => {
		describe('clean package', () => {
			lint(parser, 'minimal package', {}, []);
			lint(parser, 'regular package layout', { NAMESPACE: '', 'man/a.Rd': '', 'tests/test.R': '', 'data/d.rda': '', 'inst/extdata/x.csv': '', 'README.md': '', 'NEWS.md': '' }, []);
		});

		describe('portable file names', () => {
			lint(parser, 'invalid character', { 'R/a:b.R': '' }, [['non-portable-file-name', 'R/a:b.R']]);
			lint(parser, 'question mark', { 'inst/a?.txt': '' }, [['non-portable-file-name', 'inst/a?.txt']]);
			lint(parser, 'non-ASCII file name in man', { 'man/é.Rd': '' }, [['non-portable-file-name', 'man/é.Rd'], ['invalid-file-name', 'man/é.Rd']]);
			lint(parser, 'percent in man', { 'man/a%b.Rd': '' }, [['non-portable-file-name', 'man/a%b.Rd']]);
			lint(parser, 'Windows reserved name', { 'R/con.R': '' }, [['non-portable-file-name', 'R/con.R']]);
			lint(parser, 'reserved name with different case and extension', { 'inst/Aux.txt': '', 'inst/LPT1': '' }, [['non-portable-file-name', 'inst/Aux.txt'], ['non-portable-file-name', 'inst/LPT1']]);
			lint(parser, 'name only starting like a reserved one', { 'R/console.R': '' }, []);
			lint(parser, 'case-clashing names', { 'R/b.R': '', 'R/B.R': '' }, [['duplicate-lowercase-name', 'R/b.R']]);
			lint(parser, 'not fully portable name', { 'inst/café.txt': '' }, [['not-fully-portable-name', 'inst/café.txt']]);
			lint(parser, 'name with space', { 'inst/a b.txt': '' }, [['not-fully-portable-name', 'inst/a b.txt']]);
			lint(parser, 'path longer than 100 bytes is noted', { [`inst/${'d'.repeat(50)}/${'f'.repeat(50)}.txt`]: '' }, [['long-path', `inst/${'d'.repeat(50)}/${'f'.repeat(50)}.txt`]]);
			lint(parser, 'path longer than 256 bytes cannot be stored', { [`inst/${'d'.repeat(120)}/${'e'.repeat(120)}/f.txt`]: '' }, [['unstorable-path', `inst/${'d'.repeat(120)}`], ['unstorable-path', `inst/${'d'.repeat(120)}/${'e'.repeat(120)}`], ['unstorable-path', `inst/${'d'.repeat(120)}/${'e'.repeat(120)}/f.txt`]]);
			lint(parser, 'final component beyond 100 bytes', { [`inst/${'d'.repeat(30)}/${'f'.repeat(110)}.txt`]: '' }, [['unstorable-path', `inst/${'d'.repeat(30)}/${'f'.repeat(110)}.txt`]]);
			lint(parser, 'configured path length', { [`inst/${'d'.repeat(30)}.txt`]: '' }, [['long-path', `inst/${'d'.repeat(30)}.txt`]], { maxPathLength: 40 });
		});

		describe('hidden files', () => {
			lint(parser, 'hidden file', { 'inst/.secret': '' }, [['hidden-file', 'inst/.secret']]);
			lint(parser, 'hidden directory', { '.github/ci.yml': '' }, [['hidden-file', '.github']]);
			lint(parser, 'allowed hidden file', { '.Rinstignore': '', 'vignettes/.install_extras': '' }, []);
			lint(parser, 'allowed list is extensible', { '.foo': '' }, [], { hiddenAllowed: ['.foo'] });
			assertLinterPackage('CRAN-pack does not know the file', parser, 'x <- 1', 'package-structure', [{ message: "Found the following hidden file: 'inst/.foo'. These were most likely included in error. CRAN-pack does not know about this." }], { files: { 'inst/.foo': '' } });
			assertLinterPackage('CRAN-pack knows the file', parser, 'x <- 1', 'package-structure', [{ message: "Found the following hidden file: 'inst/.foo'. These were most likely included in error. CRAN-pack knows about this." }], { files: { 'inst/.foo': '' }, cranKnownHidden: ['.foo'] });
			assertLinterPackage('no CRAN-pack remark when disabled', parser, 'x <- 1', 'package-structure', [{ message: "Found the following hidden file: 'inst/.foo'. These were most likely included in error." }], { files: { 'inst/.foo': '' }, cranPack: false });
		});

		describe('top-level files', () => {
			lint(parser, 'non-standard top-level file', { 'notes.txt': '' }, [['non-standard-top-level', 'notes.txt']]);
			lint(parser, 'non-standard top-level directory', { 'docs/a.md': '' }, [['non-standard-top-level', 'docs']]);
			lint(parser, 'RStudio project file', { 'pkg.Rproj': '' }, [['non-standard-top-level', 'pkg.Rproj']]);
			lint(parser, 'standard top-level files', { 'LICENSE.note': '', 'NEWS': '', 'cleanup': '', 'configure.ac': '', 'tools/x.R': '' }, [], { checkTopLevel: true });
			lint(parser, 'AUTHORS is fine with inst/AUTHORS', { 'AUTHORS': '', 'inst/AUTHORS': '' }, []);
			lint(parser, 'top-level check can be disabled', { 'notes.txt': '' }, [], { checkTopLevel: false });
			lint(parser, 'standard list is configurable', { 'notes.txt': '' }, [], { standardTopLevel: ['notes.txt'] });
			assertLinterPackage('copyright hint', parser, 'x <- 1', 'package-structure', [{ message: "Non-standard file found at top level: 'Copyright.txt'. Copyright information should be in file inst/COPYRIGHTS" }], { files: { 'Copyright.txt': '' } });
			lint(parser, 'defunct install.R', { 'install.R': '' }, [['defunct-top-level-file', 'install.R'], ['non-standard-top-level', 'install.R']]);
			lint(parser, 'configure without autoconf source', { configure: '#!/bin/sh\n# Generated by GNU Autoconf 2.69\n' }, [['configure-without-source', 'configure']]);
			lint(parser, 'configure with autoconf source', { configure: '# Generated by GNU Autoconf\n', 'configure.ac': '' }, []);
			lint(parser, 'configure.in is old-fashioned', { configure: '# Generated by GNU Autoconf\n', 'configure.in': '' }, [['configure-in', 'configure.in']]);
			lint(parser, 'handwritten configure needs no source', { configure: '#!/bin/sh\necho hi\n' }, []);
			lint(parser, 'license file not mentioned', { LICENSE: '' }, [['unmentioned-license-file', 'LICENSE']]);
			lint(parser, 'license file mentioned', { LICENSE: '', DESCRIPTION: 'Package: pkg\nVersion: 1.0\nLicense: MIT + file LICENSE\n' }, []);
			lint(parser, 'installed license file not mentioned', { 'inst/LICENCE': '' }, [['unmentioned-license-file', 'inst/LICENCE']]);
			lint(parser, 'bash shebang', { configure: '#!/bin/bash\necho\n' }, [['bashism', 'configure']], { checkBashisms: true });
			lint(parser, 'bash shebang is not checked by default', { configure: '#!/bin/bash\necho\n' }, []);
			lint(parser, 'env bash', { cleanup: '#!/usr/bin/env bash\n' }, [['bashism', 'cleanup']], { checkBashisms: true });
		});

		describe('left-over files', () => {
			lint(parser, 'top-level Rd file', { 'foo.Rd': '' }, [['non-standard-top-level', 'foo.Rd'], ['leftover-file', 'foo.Rd']]);
			lint(parser, 'svn commit message', { 'R/svn-commit.2.tmp': '' }, [['leftover-file', 'R/svn-commit.2.tmp'], ['invalid-file-name', 'R/svn-commit.2.tmp']]);
		});

		describe('package subdirectories', () => {
			lint(parser, 'invalid file in R', { 'R/notes.txt': '' }, [['invalid-file-name', 'R/notes.txt']]);
			lint(parser, 'files of R allowed besides code', { 'R/sysdata.rda': '', 'R/Makefile.win': '', 'R/zzz.R.in': '', 'R/unix/u.R': '' }, []);
			lint(parser, 'code file starting with an underscore', { 'R/_a.R': '' }, [['invalid-file-name', 'R/_a.R']]);
			lint(parser, 'invalid file in man', { 'man/a.Rd': '', 'man/b.md': '' }, [['invalid-file-name', 'man/b.md']]);
			lint(parser, 'invalid file in demo', { 'demo/00Index': '', 'demo/a.R': 'x', 'demo/b.txt': '' }, [['invalid-file-name', 'demo/b.txt']]);
			lint(parser, 'case variants of directories', { 'MAN/a.Rd': '', 'DATA/a.rda': '' }, [['non-standard-top-level', 'DATA'], ['non-standard-top-level', 'MAN'], ['case-variant-directory', 'DATA'], ['case-variant-directory', 'MAN']]);
			lint(parser, 'data without data sets', { 'data/readme.pdf': '' }, [['empty-data-directory', 'data']]);
			lint(parser, 'demo without demos', { 'demo/00Index': '' }, [['empty-demo-directory', 'demo']]);
			lint(parser, 'demo with non-ASCII characters', { 'demo/a.R': 'x <- "é"\n' }, [['demo-non-ascii', 'demo/a.R']]);
			lint(parser, 'exec with only hidden files', { 'exec/.keep': '' }, [['hidden-file', 'exec/.keep'], ['empty-exec-directory', 'exec']]);
			lint(parser, 'src without sources', { 'src/notes.txt': '' }, [['empty-src-directory', 'src']]);
			lint(parser, 'src with sources', { 'src/a.cpp': '' }, []);
			lint(parser, 'src with a Makefile', { 'src/Makefile': '' }, []);
			lint(parser, 'system directory in inst', { 'inst/R/x.R': '' }, [['inst-system-subdirectory', 'inst/R']]);
			lint(parser, 'reserved directories are extensible', { 'inst/Foo/x.R': '' }, [['inst-system-subdirectory', 'inst/Foo']], { reservedInstDirs: ['Foo'] });
			lint(parser, 'misplaced CITATION', { 'R/CITATION': '' }, [['invalid-file-name', 'R/CITATION'], ['misplaced-citation', 'R/CITATION']]);
			lint(parser, 'CITATION in inst', { 'inst/CITATION': '' }, []);
			lint(parser, 'tests without test files', { 'tests/notes.txt': '' }, [['empty-tests-directory', 'tests']]);
			lint(parser, 'invalid vignette name in inst/doc', { 'inst/doc/_v.Rmd': '' }, [['invalid-file-name', 'inst/doc/_v.Rmd']]);
		});

		describe('executables and line endings', () => {
			lint(parser, 'exe file', { 'inst/bin/tool.exe': '' }, [['exe-dll-file', 'inst/bin/tool.exe']]);
			lint(parser, 'dll file', { 'inst/lib.dll': '' }, [['exe-dll-file', 'inst/lib.dll']]);
			lint(parser, 'declared binary in BinaryFiles', { 'inst/lib.dll': '', BinaryFiles: 'inst/lib.dll\n' }, [['non-standard-top-level', 'BinaryFiles']]);
			lint(parser, 'CRLF in configure', { configure: '#!/bin/sh\r\necho\r\n' }, [['crlf-shell-script', 'configure']]);
			lint(parser, 'CRLF in cleanup', { cleanup: 'rm -f x\r\n' }, [['crlf-shell-script', 'cleanup']]);
			lint(parser, 'LF in configure', { configure: '#!/bin/sh\necho\n' }, []);
		});

		describe('vignettes and inst/doc', () => {
			lint(parser, 'vignette source in inst/doc but not in vignettes', { 'vignettes/a.Rmd': '', 'inst/doc/b.Rnw': '' }, [['vignette-source-missing', 'inst/doc/b.Rnw'], ['no-vignette-builder', 'DESCRIPTION']]);
			lint(parser, 'knitr vignette without VignetteBuilder', { 'vignettes/a.Rmd': '' }, [['no-vignette-builder', 'DESCRIPTION']]);
			lint(parser, 'knitr vignette with VignetteBuilder', { 'vignettes/a.Rmd': '', DESCRIPTION: 'Package: pkg\nVersion: 1.0\nVignetteBuilder: knitr\n' }, []);
			lint(parser, 'Sweave vignette needs no builder', { 'vignettes/a.Rnw': '' }, []);
			lint(parser, 'vignette leftovers', { 'vignettes/a.Rnw': '', 'vignettes/a.log': '', 'vignettes/a.aux': '' }, [['leftover-mistake', 'vignettes/a.aux'], ['leftover-mistake', 'vignettes/a.log']]);
			lint(parser, 'leftover extensions are extensible', { 'vignettes/a.Rnw': '', 'vignettes/a.zzz': '' }, [['leftover-mistake', 'vignettes/a.zzz']], { leftoverExtensions: ['zzz'] });
			lint(parser, 'knitr cache and figure', { 'vignettes/a.Rnw': '', 'vignettes/cache/x.rdb': '', 'vignettes/figure/p.png': '' }, [['knitr-leftover', 'vignettes/cache'], ['knitr-leftover', 'vignettes/figure']]);
			lint(parser, 'files already in R', { 'vignettes/a.Rnw': '', 'vignettes/jss.cls': '' }, [['file-already-in-r', 'vignettes/jss.cls']]);
			lint(parser, 'style file requiring distribution of sources', { 'vignettes/a.Rnw': '', 'vignettes/my.sty': '%% This generated file may be distributed as long as the\n%% original source files, as listed above, are part of the\n%% same distribution.\n' }, [['license-requires-sources', 'vignettes/my.sty']]);
			lint(parser, 'built package without inst/doc', { 'vignettes/a.Rnw': '' }, [['vignettes-without-inst-doc', 'vignettes']], { builtPackage: true });
			lint(parser, 'leftovers in inst/doc', { 'inst/doc/a.Rnw': '', 'vignettes/a.Rnw': '', 'inst/doc/a.toc': '' }, [['leftover-mistake', 'inst/doc/a.toc']]);
			lint(parser, 'files that should not be installed', { 'inst/doc/a.Rnw': '', 'vignettes/a.Rnw': '', 'inst/doc/fig1.pdf': '', 'inst/doc/logo.png': '' }, [['should-not-install', 'inst/doc/fig1.pdf'], ['should-not-install', 'inst/doc/logo.png']]);
			lint(parser, 'directories that should not be installed', { 'inst/doc/a.Rnw': '', 'vignettes/a.Rnw': '', 'inst/doc/figures/p.txt': '' }, [['should-not-install', 'inst/doc/figures']]);
			lint(parser, 'directories not to install are extensible', { 'inst/doc/a.Rnw': '', 'vignettes/a.Rnw': '', 'inst/doc/mine/p.txt': '' }, [['should-not-install', 'inst/doc/mine']], { docDirsNotInstalled: ['mine'] });
			lint(parser, 'large PDF', { 'inst/doc/a.pdf': 'x'.repeat(2000) }, [['large-pdf', 'inst/doc/a.pdf']], { maxPdfBytes: 1000 });
			lint(parser, 'small PDF', { 'inst/doc/a.pdf': 'x'.repeat(2000) }, []);
		});
	});

	describe('package-structure on disk', () => {
		test('a clean package', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'NAMESPACE')), []);
		});
		test('file without read permission', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'inst/secret.txt', 'x', 0o200)), [['insufficient-permissions', 'inst/secret.txt']]);
		});
		test('directory without full permission', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'inst/sub/a.txt', 'x');
				fs.chmodSync(path.join(root, 'inst/sub'), 0o500);
			}), [['insufficient-permissions', 'inst/sub']]);
		});
		test('configure that is not executable', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'configure', '#!/bin/sh\n', 0o644)), [['not-executable', 'configure']]);
		});
		test('configure that is executable', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'configure', '#!/bin/sh\n', 0o755)), []);
		});
		test('future time stamp', async() => {
			const future = new Date(Date.now() + 3600 * 1000 * 24);
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'inst/new.txt', 'x');
				fs.utimesSync(path.join(root, 'inst/new.txt'), future, future);
			}), [['future-timestamp', 'inst/new.txt']]);
		});
		test('future time stamp within the leeway', async() => {
			const soon = new Date(Date.now() + 60 * 1000);
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'inst/new.txt', 'x');
				fs.utimesSync(path.join(root, 'inst/new.txt'), soon, soon);
			}), []);
		});
		test('future time stamp check disabled', async() => {
			const future = new Date(Date.now() + 3600 * 1000 * 24);
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'inst/new.txt', 'x');
				fs.utimesSync(path.join(root, 'inst/new.txt'), future, future);
			}, { checkFutureTimestamps: false }), []);
		});
		test('ELF executable', async() => {
			const elf = Buffer.alloc(64);
			elf.write('\u007fELF', 0, 'latin1');
			elf[5] = 1;
			elf.writeUInt16LE(2, 16);
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'inst/tool', elf, 0o755)), [['executable-file', 'inst/tool']]);
		});
		test('shared object is no executable', async() => {
			const elf = Buffer.alloc(64);
			elf.write('\u007fELF', 0, 'latin1');
			elf[5] = 1;
			elf.writeUInt16LE(3, 16);
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'inst/lib.so', elf, 0o644)), []);
		});
		test('PE executable under a misleading name', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'inst/data.bin', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(40)]))), [['executable-file', 'inst/data.bin']]);
		});
		test('script is no executable', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'inst/run.sh', '#!/bin/sh\necho\n', 0o755)), []);
		});
		test('installed size above the limit', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'data/big.rda', Buffer.alloc(3 * 1024 * 1024)), { maxInstalledSizeMb: 2 }), [['installed-size', 'DESCRIPTION']]);
		});
		test('installed size below the limit', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'data/big.rda', Buffer.alloc(3 * 1024 * 1024))), []);
		});
		test('vignettes are not installed', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => write(root, 'vignettes/a.Rnw', Buffer.alloc(3 * 1024 * 1024)), { maxInstalledSizeMb: 2 }), []);
		});
		test('left-overs from vignette generation', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'inst/doc/Rplots.pdf');
				write(root, 'inst/x.txt');
			}), [['vignette-leftover', 'inst/doc/Rplots.pdf']]);
		});
		test('empty directories are no files', async() => {
			assert.deepStrictEqual(await lintOnDisk(root => fs.mkdirSync(path.join(root, 'exec'))), [['empty-exec-directory', 'exec']]);
		});
		test('vignette index of the build directory', async() => {
			const rds = path.join(os.tmpdir(), `flowr-vignette-${process.pid}.rds`);
			const { spawnSync } = await import('child_process');
			const made = spawnSync('Rscript', ['-e', `saveRDS(data.frame(File=c("a.Rmd","b.Rmd"),PDF=c("a.html",""),R=c("a.R","b.R"),stringsAsFactors=FALSE), "${rds}")`]);
			if(made.status !== 0) {
				return;
			}
			try {
				const found = await lintOnDisk(root => {
					write(root, 'build/vignette.rds', fs.readFileSync(rds));
					write(root, 'inst/doc/a.html');
				});
				assert.deepStrictEqual(found, [
					['build-missing-code', 'build/vignette.rds'],
					['build-missing-source', 'build/vignette.rds'],
					['build-vignette-without-output', 'build/vignette.rds']
				]);
			} finally {
				fs.rmSync(rds, { force: true });
			}
		});
		test('vignette newer than its build', async() => {
			const old = new Date(Date.now() - 3600 * 1000);
			assert.deepStrictEqual(await lintOnDisk(root => {
				write(root, 'vignettes/a.Rnw');
				write(root, 'inst/doc/a.Rnw');
				write(root, 'inst/doc/a.pdf');
				fs.utimesSync(path.join(root, 'inst/doc/a.Rnw'), old, old);
				fs.utimesSync(path.join(root, 'inst/doc/a.pdf'), old, old);
			}, { builtPackage: true }), [['vignette-newer', 'vignettes/a.Rnw']]);
		});
	});
}));
