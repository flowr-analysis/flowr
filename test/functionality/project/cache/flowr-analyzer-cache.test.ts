import { describe, expect, test } from 'vitest';
import { FlowrAnalyzerCache } from '../../../../src/project/cache/flowr-analyzer-cache';
import { CfgKind } from '../../../../src/project/cfg-kind';
import { defaultConfigOptions } from '../../../../src/config';
import { withTreeSitter } from '../../_helper/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { extractCfg, extractCfgQuick } from '../../../../src/control-flow/extract-cfg';

describe('Analyzer Cache', withTreeSitter( (shell) => {
	const data = {
		parser:  shell,
		config:  defaultConfigOptions,
		request: [requestFromInput('x <- 1')]
	};

	describe('Control Flow', () => {
		test('CFG without dataflow', async() => {
			const cache = FlowrAnalyzerCache.create({ parser: shell, config: defaultConfigOptions, request: requestFromInput('f <- function(x) x\nf()') });
			const actual = await cache.controlflow(false, CfgKind.NoDataflow, []);
			const expected = extractCfg(await cache.normalize(), data.config);
			expect(expected).toEqual(actual);
		});

		test('CFG with dataflow', async() => {
			const cache = FlowrAnalyzerCache.create({ parser: shell, config: defaultConfigOptions, request: requestFromInput('f <- function(x) x\nf()') });
			const actual = await cache.controlflow(false, CfgKind.WithDataflow, []);
			const expected = extractCfg(await cache.normalize(), data.config, (await cache.dataflow()).graph);
			expect(expected).toEqual(actual);
		});

		test('CFG Quick', async() => {
			const cache = FlowrAnalyzerCache.create({ parser: shell, config: defaultConfigOptions, request: requestFromInput('f <- function(x) x\nf()') });
			const quick = await cache.controlflow(false, CfgKind.Quick);
			const regular = extractCfgQuick(await cache.normalize());
			expect(regular).toEqual(quick);
		});

		test('Disallow simplifications', async() => {
			const cache = FlowrAnalyzerCache.create(data);
			const fail = () =>
				cache.controlflow(false, CfgKind.Quick, ['analyze-dead-code']);
			await expect(fail).rejects.toThrowError();
		});

		describe('Caching', () => {
			test('Force', async() => {
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, CfgKind.NoDataflow, []);
				const cached = await cache.controlflow(true, CfgKind.NoDataflow, []);
				expect(original).not.toBe(cached);
			});

			test('Should differentiate', async() => {
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, CfgKind.NoDataflow, []);
				const cached = await cache.controlflow(false, CfgKind.WithDataflow, []);
				expect(original).not.toBe(cached);
			});

			test('Should cache', async() => {
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, CfgKind.NoDataflow, []);
				const cached = await cache.controlflow(false, CfgKind.NoDataflow, []);
				expect(original).toBe(cached);
			});

			test('Re-use base CFG', async() => {
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, CfgKind.WithDataflow, []);
				const cached = await cache.controlflow(false, CfgKind.WithDataflow, ['unique-cf-sets']);
				expect(original.graph).toBe(cached.graph);
			});

			test('Keep cache unmodified', async() => {
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, CfgKind.WithDataflow, []);
				await cache.controlflow(false, CfgKind.WithDataflow, ['unique-cf-sets']);
				const afterReuse = await cache.controlflow(false, CfgKind.WithDataflow, []);
				expect(original).toBe(afterReuse);
			});

			test('Re-use CFG Quick from dataflow', async() => {
				// The request needs to have an unknown side effect for CFG Quick to be computed during dataflow
				const cache = FlowrAnalyzerCache.create({ ...data, request: requestFromInput('x<-1\ncat(x)') });
				const original = (await cache.dataflow()).cfgQuick;
				const cached = await cache.controlflow(false, CfgKind.Quick, undefined);
				expect(original).toBe(cached);
			});
		});
	});
}));