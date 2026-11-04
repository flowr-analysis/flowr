
import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import type { KnownParser } from '../../../src/r-bridge/parser';

async function graph(analyzer: FlowrAnalyzer) {
	return (await analyzer.dataflow(true)).graph.withoutEnvironments().toJSON();
}

async function analyze(parser: KnownParser, ...requests: string[]) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setParser(parser)
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest(...requests);
	return graph(analyzer);
}

describe('Analyzer', withTreeSitter(parser => {
	test('forked analyzers produce independent results as files and config change', async() => {
		const a = await new FlowrAnalyzerBuilder()
			.setParser(parser)
			.setEngine('tree-sitter')
			.configure('project.implicitSources', ['setup.R', 'main.R'])
			.build();

		a.addFile(
			new FlowrInlineTextFile('virtual-analyzer-fork/a.R', 'x <- 40'),
			new FlowrInlineTextFile('virtual-analyzer-fork/b.R', 'y <- x + 2\nprint(y)')
		);
		a.addRequest(
			{ request: 'file', content: 'virtual-analyzer-fork/a.R' },
			{ request: 'file', content: 'virtual-analyzer-fork/b.R' }
		);
		const b = a.fork();

		const resultA = await graph(a);
		assert.deepStrictEqual(resultA, await graph(b));

		b.updateConfig({ project: { implicitSources: ['setup.R', 'branch.R', 'main.R'] } });
		b.addFile(new FlowrInlineTextFile('virtual-analyzer-fork/branch.R', 'branch <- answer + 5\nprint(branch)'));
		b.addRequest({ request: 'file', content: 'virtual-analyzer-fork/branch.R' });
		const resultB = await graph(b);
		assert.notDeepEqual(resultA, resultB);

		a.updateConfig({ project: { implicitSources: ['setup.R', 'branch.R', 'main.R'] } });
		a.addFile(new FlowrInlineTextFile('virtual-analyzer-fork/branch.R', 'branch <- answer + 5\nprint(branch)'));
		a.addRequest({ request: 'file', content: 'virtual-analyzer-fork/branch.R' });
		assert.deepStrictEqual(await graph(a), resultB);

		a.updateConfig({ project: { implicitSources: ['setup.R', 'branch.R', 'main.R', 'extra.R'] } });
		const extra = new FlowrInlineTextFile('virtual-analyzer-fork/extra.R', 'extra <- answer + 100\nprint(extra)');
		a.addFile(extra);
		a.addRequest({ request: 'file', content: 'virtual-analyzer-fork/extra.R' });
		const c = a.fork();
		extra.updateInlineContent('');
		const resultC = await graph(c);
		assert.notDeepEqual(resultC, resultB);

		a.updateConfig({ project: { implicitSources: ['setup.R', 'branch.R', 'main.R'] } });
		a.reset();
		a.addFile(
			new FlowrInlineTextFile('virtual-analyzer-fork/a.R', 'x <- 40'),
			new FlowrInlineTextFile('virtual-analyzer-fork/b.R', 'y <- x + 2\nprint(y)'),
			new FlowrInlineTextFile('virtual-analyzer-fork/branch.R', 'branch <- answer + 5\nprint(branch)')
		);
		a.addRequest(
			{ request: 'file', content: 'virtual-analyzer-fork/a.R' },
			{ request: 'file', content: 'virtual-analyzer-fork/b.R' },
			{ request: 'file', content: 'virtual-analyzer-fork/branch.R' }
		);
		assert.deepStrictEqual(await graph(a), resultB);
	});

	test('forked analyzers can run in parallel without interfering with each other', async() => {
		const a = await new FlowrAnalyzerBuilder()
			.setParser(parser)
			.setEngine('tree-sitter')
			.build();

		const initial = 'x <- 1';
		a.addRequest(initial);
		const b = a.fork();

		const [graphA, graphB] = await Promise.all([graph(a), graph(b)]);
		assert.deepStrictEqual(graphA, graphB);

		const requestA = 'y <- x + 2';
		const requestB = 'y <- x + 3';

		a.addRequest(requestA);
		b.addRequest(requestB);

		const [resultA, resultB] = await Promise.all([graph(a), graph(b)]);
		assert.deepStrictEqual(resultA, await analyze(parser, initial, requestA));
		assert.deepStrictEqual(resultB, await analyze(parser, initial, requestB));
	});

	// TODO: Test a.reset() or a.close()

	// TODO?: Test for queries

}));