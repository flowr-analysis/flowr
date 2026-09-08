import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { SigDatabase } from '../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../../src/project/sigdb/build';
import { SigDbExt, FnProp, type SigFunctionInfo } from '../../../../src/project/sigdb/schema';
import { executeQueries } from '../../../../src/queries/query';
import type { FunctionInfoQuery, FunctionInfoQueryResult } from '../../../../src/queries/catalog/function-info-query/function-info-query-format';
import { builtinModelsOf } from '../../../../src/queries/catalog/function-info-query/function-origin';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fn = (name: string, opts: Partial<SigFunctionInfo> = {}): SigFunctionInfo => ({
	name, props: FnProp.Exported, params: [], callees: [], line: 1, ...opts
});

/** two CRAN packages that both export `shared`, plus one exporting only `onlyA` - enough to test package restriction */
async function buildDb(dir: string): Promise<SigDatabase> {
	const b = new SigDbBuilder();
	b.addPackage('pkgA', { latest: '1.0.0', downloads: 10 });
	b.addVersion('pkgA', '1.0.0', { cran: true, functions: [fn('shared', { params: [{ name: 'x', props: 0 }], file: 'R/a.R', line: 3 }), fn('onlyA')] });
	b.addPackage('pkgB', { latest: '2.0.0', downloads: 1 });
	b.addVersion('pkgB', '2.0.0', { cran: true, functions: [fn('shared', { file: 'R/b.R', line: 9 })] });
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
	return SigDatabase.open(path.join(dir, `db${SigDbExt}`));
}

describe('Function Info Query', withTreeSitter(parser => {
	describe('shared function-origin helper (builtinModelsOf)', () => {
		test('reports flowR\'s own definition for a base function', () => {
			const models = builtinModelsOf('get');
			expect(models).toHaveLength(1);
			expect(models[0]).toMatchObject({ kind: 'function', namespace: 'base', processor: 'builtin:get', evalHandler: 'eval:get' });
		});

		test('a name a later entry deliberately overrides is reported once, not once per entry', () => {
			// `median` is declared once in the general "x carries the data" group and once more with `overrides: true`
			// for a precise signature (see WrittenBuiltinDefinitions); only the winning one should come back
			const models = builtinModelsOf('median');
			expect(models).toHaveLength(1);
			expect(models[0].namespace).toBe('stats');
		});

		test('an unknown name reports no built-in at all', () => {
			expect(builtinModelsOf('totallyNotARealFunctionName12345')).toEqual([]);
		});
	});

	describe('the query, against a small synthetic database', { concurrent: false }, () => {
		let tmp: string;
		let db: SigDatabase;
		let prevSigDb: string | undefined;
		let prevDisable: string | undefined;

		beforeAll(async() => {
			tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-function-info-query-'));
			db = await buildDb(tmp);
			// point the query's source resolution at just our temp database, exactly like the signature query tests
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

		async function runQuery(query: readonly FunctionInfoQuery[]): Promise<FunctionInfoQueryResult> {
			// no file/request added at all: the executor's own `getDependency` warm-up must resolve the sigdb
			// plugin sources on its own, even on a completely fresh analyzer
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			return (await executeQueries({ analyzer }, query))['function-info'];
		}

		test('reports every package exporting the name by default', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'shared' }]);
			expect(out.name).toBe('shared');
			expect(out.packages.map(p => p.package).sort()).toEqual(['pkgA', 'pkgB']);
			expect(out.packages.every(p => p.exported)).toBe(true);
		});

		test('restricts the package list to the given candidates', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'shared', packages: ['pkgB'] }]);
			expect(out.packages.map(p => p.package)).toEqual(['pkgB']);
			expect(out.packages[0]).toMatchObject({ file: 'R/b.R', line: 9 });
		});

		test('a package list naming none of the exporters yields no packages', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'shared', packages: ['nope'] }]);
			expect(out.packages).toEqual([]);
		});

		test('reports the located signature for a single exporter', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'onlyA' }]);
			expect(out.packages).toHaveLength(1);
			expect(out.packages[0]).toMatchObject({ package: 'pkgA', exported: true });
		});

		test('a name no database package exports still answers from flowR\'s built-in table', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'get' }]);
			expect(out.packages).toEqual([]);
			expect(out.builtin).toHaveLength(1);
			expect(out.builtin[0]).toMatchObject({ kind: 'function', namespace: 'base' });
		});

		test('a name nothing knows about answers with nothing', async() => {
			const out = await runQuery([{ type: 'function-info', name: 'totallyNotARealFunctionName12345' }]);
			expect(out.packages).toEqual([]);
			expect(out.builtin).toEqual([]);
		});
	});
}));
