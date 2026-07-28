import { describe, expect, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sigdbAnalyzer, ver } from '../../_helper/sigdb';
import { SigDbBuilder } from '../../../../src/project/sigdb/build';
import { SigDatabase } from '../../../../src/project/sigdb/reader';
import { FnProp } from '../../../../src/project/sigdb/schema';
import { executeQueries } from '../../../../src/queries/query';
import { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

/** a CRAN package `mypkg` whose exported `foo` internally calls the (non-exported) `bar` */
function buildDb(): SigDatabase {
	const b = new SigDbBuilder();
	b.addPackage('mypkg', { latest: '1.0.0' });
	b.addVersion('mypkg', '1.0.0', ver([
		{ name: 'foo', props: FnProp.Exported, params: [], callees: ['bar'] },
		{ name: 'bar', props: 0, params: [], callees: [] }
	]));
	return SigDatabase.fromMemory(b.build({ date: '2026-05-23', generated: 0 }));
}

describe('Expand library internals (call-graph / does-call)', withTreeSitter(ts => {
	test('call-graph: expandLibraryInternals adds an edge to the internal callee', async() => {
		const analyzer = await sigdbAnalyzer(ts, buildDb());
		analyzer.addRequest('library(mypkg)\nfoo()');

		const foo = NodeId.fromPkgFn('mypkg', 'foo');
		const bar = NodeId.fromPkgFn('mypkg', 'bar');

		const base = await executeQueries({ analyzer }, [{ type: 'call-graph' }]);
		expect(base['call-graph'].graph.outgoingEdges(foo)?.has(bar)).toBeFalsy();

		const expanded = await executeQueries({ analyzer }, [{ type: 'call-graph', expandLibraryInternals: true }]);
		expect(expanded['call-graph'].graph.outgoingEdges(foo)?.has(bar)).toBe(true);
		// the original, cached call graph must stay untouched
		expect((await analyzer.callGraph()).outgoingEdges(foo)?.has(bar)).toBeFalsy();
	});

	test('does-call: expandLibraryInternals matches an internal callee name', async() => {
		const analyzer = await sigdbAnalyzer(ts, buildDb());
		analyzer.addRequest('library(mypkg)\nfoo()');

		const constraints = { type: 'name', name: 'bar', nameExact: true } as const;
		const res = await executeQueries({ analyzer }, [
			{ type: 'does-call', queryId: 'off', call: '2@foo', calls: constraints },
			{ type: 'does-call', queryId: 'on', call: '2@foo', calls: constraints, expandLibraryInternals: true }
		]);

		expect(res['does-call'].results.off).toBe(false);
		expect(res['does-call'].results.on).not.toBe(false);
	});
}));
