import { describe, expect, test } from 'vitest';
import { FlowrAnalyzerCache } from '../../../../src/project/cache/flowr-analyzer-cache';
import { withTreeSitter } from '../../_helper/shell';
import { type ControlFlowInformation, extractCfg } from '../../../../src/control-flow/control-flow-graph';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { FlowrConfig } from '../../../../src/config';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

describe('Analyzer Cache', withTreeSitter((shell) => {

	function createCache(request: string) {
		const data = {
			parser:  shell,
			context: new FlowrAnalyzerContext(FlowrConfig.default()),
		};
		data.context.addRequests([requestFromInput(request)]);
		return data;
	}

	describe('Control Flow', () => {
		test('CFG projects the dataflow graph', async() => {
			const data = createCache('f <- function(x) x\nf()');
			const cache = FlowrAnalyzerCache.create(data);
			const actual = await cache.controlflow(false, []);
			const expected = extractCfg(await cache.dataflow());
			expect(expected).toEqual(actual);
		});

		describe('Caching', () => {
			test('Force', async() => {
				const data = createCache('x <- 1');
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, []);
				const cached = await cache.controlflow(true, []);
				expect(original).not.toBe(cached);
			});

			test('Should cache', async() => {
				const data = createCache('x <- 1');
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, []);
				const cached = await cache.controlflow(false, []);
				expect(original).toBe(cached);
			});

			test('A pass changing the graph leaves the cached ones be', async() => {
				const data = createCache('i <- 0\nwhile(TRUE) { i <- i + 1; if(i >= 3) break }\nprint(i)');
				const cache = FlowrAnalyzerCache.create(data);
				const edges = (cfg: ControlFlowInformation) => [...cfg.graph.edges()].reduce((sum, [, to]) => sum + to.size, 0);
				const before = edges(await cache.controlflow(false, ['unique-cf-sets']));
				expect(edges(await cache.controlflow(false, ['unique-cf-sets', 'analyze-dead-code']))).toBeLessThan(before);
				expect(edges(await cache.controlflow(false, ['unique-cf-sets']))).toBe(before);
			});

			test('Keep cache unmodified', async() => {
				const data = createCache('x <- 1');
				const cache = FlowrAnalyzerCache.create(data);
				const original = await cache.controlflow(false, []);
				await cache.controlflow(false, ['unique-cf-sets']);
				const afterReuse = await cache.controlflow(false, []);
				expect(original).toBe(afterReuse);
			});
		});
	});

	describe('Derived values', () => {
		const key = {};
		test('computed once per analysis, again after a reset', async() => {
			const cache = FlowrAnalyzerCache.create(createCache('x <- 1'));
			let computed = 0;
			const compute = () => Promise.resolve(++computed);
			expect([await cache.derive(key, compute), await cache.derive(key, compute)]).toEqual([1, 1]);
			cache.reset();
			expect(await cache.derive(key, compute)).toBe(2);
		});

		test('a failed computation is not kept', async() => {
			const cache = FlowrAnalyzerCache.create(createCache('x <- 1'));
			await expect(cache.derive(key, () => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
			expect(await cache.derive(key, () => Promise.resolve(3))).toBe(3);
		});
	});

	describe('Tree disposal', () => {
		function spyOnDelete(parse: unknown): () => number {
			const tree = (parse as { files: { parsed: { delete(): void } }[] }).files[0].parsed;
			let freed = 0;
			const original = tree.delete.bind(tree);
			tree.delete = () => {
				freed++;
				original();
			};
			return () => freed;
		}

		test('reset() frees the WASM-backed parse tree', async() => {
			const cache = FlowrAnalyzerCache.create(createCache('x <- 1'));
			const freed = spyOnDelete(await cache.parse());
			cache.reset();
			expect(freed()).toBe(1);
		});

		test('close() frees the WASM-backed parse tree', async() => {
			// dedicated parser so close() does not affect the shared test parser
			const analyzer = new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).buildSync();
			analyzer.addRequest('y <- 2');
			const freed = spyOnDelete(await analyzer.parse());
			analyzer.close();
			expect(freed()).toBe(1);
		});
	});
}));