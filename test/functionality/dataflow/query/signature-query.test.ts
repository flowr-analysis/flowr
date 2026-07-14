import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { SigDatabase, getSharedSigSourceSync } from '../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../../src/project/sigdb/build';
import { defaultSigDbPaths } from '../../../../src/project/sigdb/manifest';
import { SigDbExt, FnProp, MaxDefaultLength, type SigFunctionInfo } from '../../../../src/project/sigdb/schema';
import { executeQueries } from '../../../../src/queries/query';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';
import { SignatureQueryDefinition } from '../../../../src/queries/catalog/signature-query/signature-query-format';
import { signatureFunctionInfo, signaturePackageInfo, cranMirrorSourceUrl, signatureQueryCompleter } from '../../../../src/queries/catalog/signature-query/signature-query-executor';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fn = (name: string, opts: Partial<SigFunctionInfo> = {}): SigFunctionInfo => ({
	name, props: FnProp.Exported, params: [], callees: [], line: 1, ...opts
});

/** an in-memory database: a CRAN package `mypkg` with a located function, and a base package `base` */
async function buildDb(dir: string): Promise<SigDatabase> {
	const b = new SigDbBuilder();
	b.addPackage('mypkg', { latest: '1.0.0', downloads: 5 });
	b.addVersion('mypkg', '1.0.0', {
		cran:         true,
		dependencies: [{ name: 'rlang', type: 1 /* Imports */, constraint: '>= 1.0.0' }],
		functions:    [fn('foo', {
			params:  [{ name: 'a', missing: true, forced: true }, { name: 'b', default: '2' }],
			callees: ['bar'],
			file:    'R/foo.R',
			line:    5
		}), fn('bar', { file: 'R/foo.R', line: 20 }),
		// `print` is an S3 generic (its dispatch target `print.myclass` lives in the same package)
		fn('print', { callees: ['UseMethod'], file: 'R/print.R', line: 1 }),
		fn('print.myclass', { file: 'R/print.R', line: 8 })]
	});
	b.addPackage('base', { latest: '4.5.3', core: true });
	b.addVersion('base', '4.5.3', { cran: false, functions: [fn('paste2', { file: 'R/paste.R', line: 10 })] });
	// a multi-version CRAN package (dated, so every version is enumerable) for version exact/glob/range tests
	b.addPackage('multi', { latest: '2.1.0', downloads: 3 });
	b.addVersion('multi', '1.0.0', { cran: true, date: Date.UTC(2020, 0, 1), functions: [fn('m1')] });
	b.addVersion('multi', '2.0.0', { cran: true, date: Date.UTC(2021, 0, 1), functions: [fn('m2')] });
	// `trunc_fn`'s default is longer than MaxDefaultLength (10), so it is stored truncated with a `…` marker
	const multi21 = [fn('m2'), fn('m21'), fn('trunc_fn', { params: [{ name: 'cfg', default: 'list(a=1,b=2,c=3)' }] })];
	b.addVersion('multi', '2.1.0', { cran: true, date: Date.UTC(2022, 0, 1), functions: multi21 });
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
	return SigDatabase.open(path.join(dir, `db${SigDbExt}`));
}

describe.sequential('SigDb Query', withTreeSitter(parser => {
	let tmp: string;
	let db: SigDatabase;
	let prevSigDb: string | undefined;
	let prevDisable: string | undefined;

	beforeAll(async() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sigdb-query-'));
		db = await buildDb(tmp);
		// point the query's source resolution at just our temp database
		prevSigDb = process.env.FLOWR_SIGDB;
		prevDisable = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		process.env.FLOWR_SIGDB = path.join(tmp, `db${SigDbExt}`);
		process.env.FLOWR_DISABLE_DEFAULT_SIGDB = '1';
	});
	afterAll(() => {
		db?.close();
		process.env.FLOWR_SIGDB = prevSigDb;
		if(prevDisable === undefined) {
			delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		} else {
			process.env.FLOWR_DISABLE_DEFAULT_SIGDB = prevDisable;
		}
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	describe('capability: individual function info', () => {
		test('a located CRAN function yields its signature, location and CRAN-mirror link', () => {
			const info = signatureFunctionInfo(db, 'mypkg', 'foo');
			expect(info).toBeDefined();
			expect(info?.exported).toBe(true);
			expect(info?.version).toBe('1.0.0');
			expect(info?.parameters).toEqual([
				{ name: 'a', required: true, forced: true },
				{ name: 'b', required: false, forced: false, default: '2' }
			]);
			expect(info?.callees).toEqual(['bar']);
			expect(info?.file).toBe('R/foo.R');
			expect(info?.line).toBe(5);
			expect(info?.sourceUrl).toBe('https://github.com/cran/mypkg/blob/1.0.0/R/foo.R#L5');
		});

		test('an unknown function yields undefined', () => {
			expect(signatureFunctionInfo(db, 'mypkg', 'nope')).toBeUndefined();
		});

		test('a CRAN function carries an rdrr.io documentation link', () => {
			expect(signatureFunctionInfo(db, 'mypkg', 'foo')?.docUrl).toBe('https://rdrr.io/cran/mypkg/man/foo.html');
		});

		test('a base-R function has a location, base-R doc link, and no CRAN-mirror source link', () => {
			const info = signatureFunctionInfo(db, 'base', 'paste2');
			expect(info?.file).toBe('R/paste.R');
			expect(info?.sourceUrl).toBeUndefined();
			expect(info?.docUrl).toBe('https://rdrr.io/r/base/paste2.html');
		});

		test('an S3 generic lists its same-package dispatch targets by name', () => {
			const info = signatureFunctionInfo(db, 'mypkg', 'print');
			expect(info?.s3generic).toBe(true);
			expect(info?.s3methods).toEqual(['print.myclass']);
			// a non-generic is not flagged even though the bundled call graphs reach `UseMethod` transitively
			expect(signatureFunctionInfo(db, 'mypkg', 'foo')?.s3generic).toBeUndefined();
		});

		test('a parameter default longer than the cap is stored (and returned) truncated', () => {
			const info = signatureFunctionInfo(db, 'multi', 'trunc_fn');
			const cfg = info?.parameters.find(p => p.name === 'cfg');
			const full = 'list(a=1,b=2,c=3)';
			expect(full.length).toBeGreaterThan(MaxDefaultLength);
			expect(cfg?.default).toBe(full.slice(0, MaxDefaultLength) + '…');
		});

		test('the package view reports version, kind, mirror and dependencies', () => {
			const view = signaturePackageInfo(db, 'mypkg');
			expect(view?.version).toBe('1.0.0');
			expect(view?.cran).toBe(true);
			expect(view?.repoUrl).toBe('https://github.com/cran/mypkg');
			expect(view?.functionCount).toBe(4);
			expect(view?.dependencies).toEqual([{ type: 'imports', name: 'rlang', constraint: '>= 1.0.0' }]);
		});
	});

	describe('cranMirrorSourceUrl', () => {
		test('links to the version tag with a line anchor', () => {
			expect(cranMirrorSourceUrl('gg.plot', '1.2-3', 'R/a.R', 5)).toBe('https://github.com/cran/gg.plot/blob/1.2-3/R/a.R#L5');
		});
		test('falls back to HEAD without a version and omits the anchor without a line', () => {
			expect(cranMirrorSourceUrl('pkg', undefined, 'R/a.R')).toBe('https://github.com/cran/pkg/blob/HEAD/R/a.R');
		});
	});

	describe('fromLine parser', () => {
		const parse = (line: string[]) => SignatureQueryDefinition.fromLine?.({} as never, line, {} as never).query;
		test('parses package and function positionals', () => {
			expect(parse(['mypkg', 'foo'])).toEqual([{ type: 'signature', package: 'mypkg', function: 'foo' }]);
		});
		test('parses the --all flag', () => {
			expect(parse(['mypkg', '--all'])).toEqual([{ type: 'signature', package: 'mypkg', all: true }]);
		});
		test('an empty line yields a bare summary query', () => {
			expect(parse([])).toEqual([{ type: 'signature' }]);
		});
		test('parses the `pkg::fn` shorthand', () => {
			expect(parse(['ggplot2::ggplot'])).toEqual([{ type: 'signature', package: 'ggplot2', function: 'ggplot' }]);
		});
		test('parses `pkg@version`', () => {
			expect(parse(['ggplot2@3.5.0'])).toEqual([{ type: 'signature', package: 'ggplot2', version: '3.5.0' }]);
		});
		test('parses `pkg@version::fn` together', () => {
			expect(parse(['ggplot2@3.5.0::aes'])).toEqual([{ type: 'signature', package: 'ggplot2', function: 'aes', version: '3.5.0' }]);
		});
		test('an explicit second positional wins over the `::` function', () => {
			expect(parse(['ggplot2::ggplot', 'aes'])).toEqual([{ type: 'signature', package: 'ggplot2', function: 'aes' }]);
		});
		test('keeps glob wildcards in package/function/version', () => {
			expect(parse(['gg*@3.*', 'geom_*'])).toEqual([{ type: 'signature', package: 'gg*', function: 'geom_*', version: '3.*' }]);
		});
		test('parses the --full flag', () => {
			expect(parse(['gg*', 'geom_*', '--full'])).toEqual([{ type: 'signature', package: 'gg*', function: 'geom_*', full: true }]);
		});
	});

	async function runQuery(query: Parameters<typeof executeQueries>[1]) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.unregisterPlugins(SigDbPluginName)
			.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(db))
			.build();
		const res = await executeQueries({ analyzer }, query);
		return { analyzer, res };
	}

	test(label('the function query returns the located function with its mirror link', [], ['other']), async() => {
		const { analyzer, res } = await runQuery([{ type: 'signature', package: 'mypkg', function: 'foo' }]);
		const out = res.signature;
		expect(out.function?.name).toBe('foo');
		expect(out.function?.sourceUrl).toBe('https://github.com/cran/mypkg/blob/1.0.0/R/foo.R#L5');
		const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, res, analyzer, [{ type: 'signature', package: 'mypkg', function: 'foo' }]);
		expect(ascii).toContain('R/foo.R:5');
		expect(ascii).toContain('https://github.com/cran/mypkg/blob/1.0.0/R/foo.R#L5');
	});

	test(label('the package query reports the package view', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'mypkg' }]);
		expect(res.signature.package?.name).toBe('mypkg');
		expect(res.signature.package?.functionCount).toBe(4);
	});

	test(label('an unknown function reports a not-found message with suggestions', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'mypkg', function: 'fo' }]);
		expect(res.signature.function).toBeUndefined();
		expect(res.signature.message).toContain('does not define');
		expect(res.signature.suggestions).toContain('foo');
	});

	test(label('the summary lists the loaded packages', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature' }]);
		expect(res.signature.packageCount).toBeGreaterThanOrEqual(2);
		expect(res.signature.package).toBeUndefined();
	});

	test(label('a CRAN package view carries the CRAN page, mirror and grouped dependencies', [], ['other']), async() => {
		const { analyzer, res } = await runQuery([{ type: 'signature', package: 'mypkg' }]);
		expect(res.signature.package?.cranPage).toBe('https://cran.r-project.org/package=mypkg');
		expect(res.signature.package?.repoUrl).toBe('https://github.com/cran/mypkg');
		const ascii = await asciiSummaryOfQueryResult(ansiFormatter, 0, res, analyzer, [{ type: 'signature', package: 'mypkg' }]);
		// OSC 8 terminal hyperlinks are emitted for the CRAN page and the dependency
		expect(ascii).toContain('\x1b]8;;https://cran.r-project.org/package=mypkg\x1b\\');
		expect(ascii).toContain('\x1b]8;;https://cran.r-project.org/package=rlang\x1b\\');
		expect(ascii).toContain('imports');   // grouped dependency section
	});

	test(label('a base-R package has no CRAN page and reports an R-version range', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'base' }]);
		expect(res.signature.package?.base).toBe(true);
		expect(res.signature.package?.cranPage).toBeUndefined();
		expect(res.signature.package?.repoUrl).toBeUndefined();
	});

	test(label('a glob package + function search returns matches, not a single view', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'my*', function: 'foo' }]);
		expect(res.signature.function).toBeUndefined();
		expect(res.signature.matches?.map(m => `${m.package}::${m.name}`)).toEqual(['mypkg::foo']);
	});

	test(label('a glob function matches several functions in a package', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'mypkg', function: 'print*' }]);
		const names = res.signature.matches?.map(m => m.name).sort();
		expect(names).toEqual(['print', 'print.myclass']);
	});

	test(label('a glob package with no function lists matching packages', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'm*' }]);
		expect(res.signature.matches).toBeUndefined();
		expect(res.signature.packages?.map(p => p.name).sort()).toEqual(['multi', 'mypkg']);
	});

	test(label('an exact version selects that release', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', version: '2.0.0' }]);
		expect(res.signature.package?.version).toBe('2.0.0');
	});

	test(label('a version glob matches multiple releases', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', version: '2.*' }]);
		expect(res.signature.packages?.[0]?.versions).toEqual(['2.0.0', '2.1.0']);
	});

	test(label('a semver range matches multiple releases', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', version: '>=2.0.0' }]);
		expect(res.signature.packages?.[0]?.versions).toEqual(['2.0.0', '2.1.0']);
	});

	test(label('an unavailable exact version is reported with the available ones', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', version: '9.9.9' }]);
		expect(res.signature.message).toContain('is not in the loaded database');
		expect(res.signature.message).toContain('1.0.0');
	});

	test(label('a version glob matching no release lists the available ones instead of an empty result', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', version: '9.*' }]);
		expect(res.signature.message).toContain('no release of \'multi\' matches \'9.*\'');
		expect(res.signature.message).toContain('1.0.0');
		expect(res.signature.matches ?? res.signature.packages).toBeUndefined();
	});

	test(label('a versioned function search reports the matching version', [], ['other']), async() => {
		const { res } = await runQuery([{ type: 'signature', package: 'multi', function: 'm21', version: '2.*' }]);
		expect(res.signature.matches?.map(m => `${m.name}@${m.version}`)).toEqual(['m21@2.1.0']);
	});

	test(label('a database mounted at runtime (:signature add) is reflected by the query', [], ['other']), async() => {
		const extraDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sig-extra-'));
		const b = new SigDbBuilder();
		b.addPackage('runtimepkg', { latest: '0.1.0' });
		b.addVersion('runtimepkg', '0.1.0', { cran: true, functions: [fn('added_fn', { file: 'R/a.R', line: 3 })] });
		await writeSignatureDb(path.join(extraDir, 'extra'), b.build({ date: '2026-07-01', generated: 0 }));

		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.unregisterPlugins(SigDbPluginName)
			.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(db))
			.build();
		// before mounting: unknown
		const before = await executeQueries({ analyzer }, [{ type: 'signature', package: 'runtimepkg' }]);
		expect(before.signature.package).toBeUndefined();
		// mount at runtime, then the query resolves it
		await analyzer.context().deps.addDatabaseSource(path.join(extraDir, `extra${SigDbExt}`));
		const after = await executeQueries({ analyzer }, [{ type: 'signature', package: 'runtimepkg', function: 'added_fn' }]);
		expect(after.signature.function?.name).toBe('added_fn');
		expect(after.signature.function?.sourceUrl).toBe('https://github.com/cran/runtimepkg/blob/0.1.0/R/a.R#L3');
		fs.rmSync(extraDir, { recursive: true, force: true });
	});

	test(label('an exact old version resolves from a second (history) source, not just the first', [], ['other']), async() => {
		// mirror the shipped layout: one source keeps the latest release, another the older ones
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sig-hist-'));
		const cur = new SigDbBuilder();
		cur.addPackage('splitpkg', { latest: '2.0.0' });
		cur.addVersion('splitpkg', '2.0.0', { cran: true, functions: [fn('f_new', { file: 'R/n.R', line: 1 })] });
		await writeSignatureDb(path.join(dir, 'current'), cur.build({ date: '2026-07-01', generated: 0 }));
		const hist = new SigDbBuilder();
		hist.addPackage('splitpkg', { latest: '1.0.0' });
		hist.addVersion('splitpkg', '1.0.0', { cran: true, functions: [fn('f_old', { file: 'R/o.R', line: 1 })] });
		await writeSignatureDb(path.join(dir, 'history'), hist.build({ date: '2020-01-01', generated: 0 }));

		const currentDb = await SigDatabase.open(path.join(dir, `current${SigDbExt}`));
		const historyDb = await SigDatabase.open(path.join(dir, `history${SigDbExt}`));
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			.unregisterPlugins(SigDbPluginName)
			.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(currentDb, historyDb))
			.build();

		// the old version lives only in the second source -- it must still resolve
		const old = await executeQueries({ analyzer }, [{ type: 'signature', package: 'splitpkg', version: '1.0.0', function: 'f_old' }]);
		expect(old.signature.function?.name).toBe('f_old');
		// the latest still resolves from the first source
		const cur2 = await executeQueries({ analyzer }, [{ type: 'signature', package: 'splitpkg', version: '2.0.0' }]);
		expect(cur2.signature.package?.version).toBe('2.0.0');
		// an unavailable version lists BOTH sources' releases
		const none = await executeQueries({ analyzer }, [{ type: 'signature', package: 'splitpkg', version: '9.9.9' }]);
		expect(none.signature.message).toContain('1.0.0');
		expect(none.signature.message).toContain('2.0.0');

		currentDb.close();
		historyDb.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});
}));

describe.sequential('SigDb additionalPaths config', withTreeSitter(parser => {
	test(label('a database in solver.sigdb.additionalPaths is discovered and queryable', [], ['other']), async() => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sig-addpath-'));
		const b = new SigDbBuilder();
		b.addPackage('cfgpkg', { latest: '0.2.0' });
		b.addVersion('cfgpkg', '0.2.0', { cran: true, functions: [fn('cfg_fn', { file: 'R/c.R', line: 7 })] });
		await writeSignatureDb(path.join(dir, 'extra'), b.build({ date: '2026-07-01', generated: 0 }));
		// additionalPaths group with the default discovery, so clear the hermetic disable flag around this test
		// (in the test body, not a hook, so it is immune to sibling describes racing on these env vars); a sibling
		// describe can also leave FLOWR_SIGDB pointing at a now-deleted temp db, so clear that too
		const prevDisable = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		const prevSigDb = process.env.FLOWR_SIGDB;
		delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		delete process.env.FLOWR_SIGDB;
		try {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
				.amendConfig(c => {
					c.solver.sigdb.additionalPaths = [dir];
				})
				.build();
			const res = await executeQueries({ analyzer }, [{ type: 'signature', package: 'cfgpkg', function: 'cfg_fn' }]);
			expect(res.signature.function?.name).toBe('cfg_fn');
			expect(res.signature.function?.sourceUrl).toBe('https://github.com/cran/cfgpkg/blob/0.2.0/R/c.R#L7');
		} finally {
			if(prevDisable === undefined) {
				delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
			} else {
				process.env.FLOWR_DISABLE_DEFAULT_SIGDB = prevDisable;
			}
			if(prevSigDb === undefined) {
				delete process.env.FLOWR_SIGDB;
			} else {
				process.env.FLOWR_SIGDB = prevSigDb;
			}
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
}));

describe('signature query completer', () => {
	// the completer reads the discoverable bundle (not a synthetic db) and these cases query CRAN packages, so
	// only run when the full bundle is present -- CI ships just the base-R floor (no ggplot2), so it skips there
	const bundled = defaultSigDbPaths().some(p => getSharedSigSourceSync(p)?.has('ggplot2'));
	// the shared test setup disables the default bundle for hermetic runs; the completer honors that flag, so
	// clear it here (the completer is exactly the case that wants the shipped bundle) and restore it afterwards
	let prevDisable: string | undefined;
	beforeAll(() => {
		prevDisable = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
	});
	afterAll(() => {
		if(prevDisable === undefined) {
			delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
		} else {
			process.env.FLOWR_DISABLE_DEFAULT_SIGDB = prevDisable;
		}
	});

	test.runIf(bundled)(label('completes package names in the first position', [], ['other']), () => {
		const { completions } = signatureQueryCompleter(['ggplot'], false);
		expect(completions).toContain('ggplot2 ');
		expect(completions.every(c => c.startsWith('ggplot'))).toBe(true);
	});

	test.runIf(bundled)(label('completes a package\'s functions in the second position and via pkg::', [], ['other']), () => {
		const spaced = signatureQueryCompleter(['ggplot2', 'aes'], false).completions;
		expect(spaced).toContain('aes ');
		expect(spaced).toContain('aes_string ');
		const dbl = signatureQueryCompleter(['ggplot2::aes'], false).completions;
		expect(dbl).toContain('ggplot2::aes ');
		expect(dbl.every(c => c.startsWith('ggplot2::aes'))).toBe(true);
	});

	test.runIf(bundled)(label('caps a broad set at 200 but spreads them across the alphabet', [], ['other']), () => {
		const { completions } = signatureQueryCompleter(['ggplot2'], true);   // every ggplot2 function
		expect(completions.length).toBe(200);
		const letters = new Set(completions.map(c => c.trim()[0]?.toLowerCase()));
		expect(letters.size).toBeGreaterThan(10);   // not just the alphabetical head
	});

	test.runIf(bundled)(label('offers nothing for a version fragment or an unknown package', [], ['other']), () => {
		expect(signatureQueryCompleter(['ggplot2@4'], false).completions).toEqual([]);
		expect(signatureQueryCompleter(['nope', 'x'], false).completions).toEqual([]);
	});

	test.runIf(bundled)(label('offers flags after a function argument', [], ['other']), () => {
		expect(signatureQueryCompleter(['ggplot2', 'aes', '-'], false).completions).toEqual(['--all ', '--full ']);
	});
});
