import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { SigDbBuilder, writeSignatureDb } from '../../../../src/project/sigdb/build';
import { SigDbExt, FnProp, type SigFunctionInfo } from '../../../../src/project/sigdb/schema';
import { executeQueries } from '../../../../src/queries/query';
import type { FunctionInfoQuery, FunctionInfoQueryResult } from '../../../../src/queries/catalog/function-info-query/function-info-query-format';
import { builtinModelsOf } from '../../../../src/queries/catalog/function-info-query/function-origin';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import type { BuiltInDefinitions } from '../../../../src/dataflow/environments/built-in-config';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fn = (name: string, opts: Partial<SigFunctionInfo> = {}): SigFunctionInfo => ({
	name, props: FnProp.Exported, params: [], callees: [], line: 1, ...opts
});

async function buildDb(dir: string): Promise<void> {
	const b = new SigDbBuilder();
	b.addPackage('pkgA', { latest: '1.0.0', downloads: 10 });
	b.addVersion('pkgA', '1.0.0', { cran: true, functions: [fn('shared', { params: [{ name: 'x', props: 0 }], file: 'R/a.R', line: 3 }), fn('onlyA')] });
	b.addPackage('pkgB', { latest: '2.0.0', downloads: 1 });
	b.addVersion('pkgB', '2.0.0', { cran: true, functions: [fn('shared', { file: 'R/b.R', line: 9 })] });
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
}

describe('Function Info Query', withTreeSitter(parser => {
	async function contextOf(definitions?: BuiltInDefinitions): Promise<ReadOnlyFlowrAnalyzerContext> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).amendConfig(c => {
			if(definitions) {
				c.semantics.environment.overwriteBuiltIns.definitions = definitions;
			}
		}).build();
		return analyzer.inspectContext();
	}

	describe('shared function-origin helper (builtinModelsOf)', () => {
		test('reports flowR\'s own definition for a base function', async() => {
			const models = builtinModelsOf('get', await contextOf());
			expect(models).toHaveLength(1);
			expect(models[0]).toMatchObject({ kind: 'function', namespace: 'base', processor: 'builtin:get', evalHandler: 'eval:get' });
		});

		test('a name a later entry deliberately overrides is reported once, not once per entry', async() => {
			const models = builtinModelsOf('median', await contextOf());
			expect(models).toHaveLength(1);
			expect(models[0].namespace).toBe('stats');
		});

		test('an unknown name reports no built-in at all', async() => {
			expect(builtinModelsOf('totallyNotARealFunctionName12345', await contextOf())).toEqual([]);
		});

		test('a built-in only the FlowrConfig states is reported, and only for that configuration', async() => {
			const definitions = [{
				type:            'function',
				names:           [Identifier.from(['launchIt', 'base'])],
				processor:       BuiltInProcName.Default,
				config:          { tags: [SemanticCallTag.Process] },
				assumePrimitive: false
			}] as unknown as BuiltInDefinitions;
			expect(builtinModelsOf('launchIt', await contextOf(definitions)))
				.toMatchObject([{ kind: 'function', namespace: 'base', processor: BuiltInProcName.Default, tags: [SemanticCallTag.Process] }]);
			expect(builtinModelsOf('launchIt', await contextOf())).toEqual([]);
		});

		test('a configuration that drops the defaults reports no built-in for a default name', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).amendConfig(c => {
				c.semantics.environment.overwriteBuiltIns.loadDefaults = false;
			}).build();
			expect(builtinModelsOf('get', analyzer.inspectContext())).toEqual([]);
		});
	});

	describe('the query, against a small synthetic database', { concurrent: false }, () => {
		let tmp: string;
		let prevSigDb: string | undefined;
		let prevDisable: string | undefined;

		beforeAll(async() => {
			tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-function-info-query-'));
			await buildDb(tmp);
			prevSigDb = process.env.FLOWR_SIGDB;
			prevDisable = process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
			process.env.FLOWR_SIGDB = path.join(tmp, `db${SigDbExt}`);
			process.env.FLOWR_DISABLE_DEFAULT_SIGDB = '1';
		});
		afterAll(() => {
			process.env.FLOWR_SIGDB = prevSigDb;
			if(prevDisable === undefined) {
				delete process.env.FLOWR_DISABLE_DEFAULT_SIGDB;
			} else {
				process.env.FLOWR_DISABLE_DEFAULT_SIGDB = prevDisable;
			}
			fs.rmSync(tmp, { recursive: true, force: true });
		});

		async function runQuery(query: readonly FunctionInfoQuery[]): Promise<FunctionInfoQueryResult> {
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
