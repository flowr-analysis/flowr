import { assert, describe, test, vi } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { analyze } from '../_helper/analyzer';
import { CacheScope, GlobalCaches } from '../../../src/util/global-caches';
import { BoundedMap } from '../../../src/util/collections/bounded-map';
import { serialize2quads } from '../../../src/util/quads';
import type { Query } from '../../../src/queries/query';

/** different programs, so what one leaves behind would show next to the next one */
const Programs = [
	'x <- 1\ny <- x + 1\nprint(y)',
	'f <- function(a, b = 2) {\n  if(!is.numeric(a)) stop("no")\n  a + b\n}\nf(3)\nrm(f)',
	'library(dplyr)\ndf <- data.frame(a = 1:3)\ndf <- filter(df, a > 1)\nwrite.csv(df, "out.csv")',
	'g <- function(n) if(n <= 1) 1 else n * g(n - 1)\nfor(i in 1:3) print(g(i))\nsource("other.R")',
	'h <- function(x) { stopifnot(is.character(x)); nchar(x) }\nz <- readRDS("in.rds")\nh(z)\nsapply(1:3, h)'
];

const Queries: readonly Query[] = [
	{ type: 'dataflow' },
	{ type: 'call-context', callName: '^print$' },
	{ type: 'dependencies' },
	{ type: 'linter' },
	{ type: 'inspect-fn-guards' },
	{ type: 'static-slice', criteria: ['$0'] },
	{ type: 'signature', package: 'base', function: 'nchar' }
] as Query[];

/** The registered caches violating what reset and the bounds promise, by name. */
function violations(afterReset: boolean): string[] {
	return Object.entries(GlobalCaches.sizes()).flatMap(([name, { scope, size, cap }]) => {
		if(size === undefined) {
			return [];
		} else if(afterReset && scope === CacheScope.Analysis && size > 0) {
			return [`${name} holds ${size} entries after reset`];
		} else if(cap !== undefined && size > cap) {
			return [`${name} holds ${size} > ${cap} entries`];
		}
		return [];
	});
}

/* sequential: the caches are global, and fake timers would reach into a concurrent test */
describe.sequential('Global caches', withTreeSitter(parser => {
	test('a bounded map starts over at its cap', () => {
		const map = new BoundedMap<number, number>(3);
		for(let i = 0; i < 10; i++) {
			map.set(i, i);
			assert.isAtMost(map.size, 3);
		}
		map.set(9, 0);
		assert.strictEqual(map.get(9), 0, 'overwriting a kept key does not start over');
	});

	test('reset releases the analysis caches and every cache stays bounded', async() => {
		const analyzer = await analyze(parser, Programs[0]);
		for(const program of Programs) {
			analyzer.reset();
			assert.deepStrictEqual(violations(true), []);
			analyzer.addRequest(program);
			for(const query of Queries) {
				await analyzer.query([query]);
			}
			const dfg = await analyzer.dataflow();
			serialize2quads({ vertices: [...dfg.graph.vertices(true)].map(([, v]) => v) }, { context: 'test' });
			assert.strictEqual(GlobalCaches.sizes()['quad-cycle-guard'].size, 0, 'the serialized vertices must not outlive the call');
			assert.deepStrictEqual(violations(false), []);
		}
		analyzer.reset();
		assert.deepStrictEqual(violations(true), []);
		const names = Object.keys(GlobalCaches.sizes());
		for(const expected of ['built-in-guards', 'base-namespace-layers', 'removed-names', 'quad-cycle-guard', 'exporting-per-context', 'default-sigdb-paths']) {
			assert.include(names, expected);
		}
	});

	/* the calls of a graph are qualified on timers, a pending one keeps the whole analysis alive */
	test('reset stops the background work on the dropped analysis', async() => {
		vi.useFakeTimers();
		try {
			const analyzer = await analyze(parser, Programs[1]);
			await analyzer.dataflow();
			assert.strictEqual(vi.getTimerCount(), 1, 'the calls are qualified in the background');
			analyzer.reset();
			assert.strictEqual(vi.getTimerCount(), 0);
		} finally {
			vi.useRealTimers();
		}
	});
}));
