import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';

async function graph(analyzer: FlowrAnalyzer) {
	return (await analyzer.dataflow(true)).graph.withoutEnvironments().toJSON();
}

async function analyze(...requests: string[]) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest(...requests);
	return graph(analyzer);
}

describe('Analyzer', withTreeSitter(parser => {
	test('forked analyzers produce independent results as files and config change', async() => {
		const a = await new FlowrAnalyzerBuilder()
			.setParser(parser)
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
		const b = await a.fork();

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
		const c = await a.fork();
		assert.deepStrictEqual(await graph(c), resultB);
	});

	test('forked analyzers can run in parallel without interfering with each other', async() => {
		const a = await new FlowrAnalyzerBuilder()
			.setParser(parser)
			.build();

		const initial = 'x <- 1';
		a.addRequest(initial);
		const b = await a.fork();

		const [graphA, graphB] = await Promise.all([graph(a), graph(b)]);
		assert.deepStrictEqual(graphA, graphB);

		const requestA = 'y <- x + 2';
		const requestB = 'y <- x + 3';

		a.addRequest(requestA);
		b.addRequest(requestB);

		const [resultA, resultB] = await Promise.all([graph(a), graph(b)]);
		assert.deepStrictEqual(resultA, await analyze(initial, requestA));
		assert.deepStrictEqual(resultB, await analyze(initial, requestB));
	});

	test('resetting and closing an analyzer does not interfere with its forks', async() => {
		const a = await new FlowrAnalyzerBuilder()
			.setParser(parser)
			.setEngine('tree-sitter')
			.build();

		const aFile = 'x <- 1';
		a.addRequest(aFile);

		const a2 = await a.fork();
		const b = await a2.fork();
		const bFile = 'y <- x + 2';
		b.addRequest(bFile);
		const graphB = await graph(b);

		a2.reset();
		assert.deepStrictEqual(await graph(b), graphB);

		a2.close();
		assert.deepStrictEqual(await graph(b), graphB);

		b.addRequest('y <- x + 2');
		assert.deepStrictEqual(await graph(b), await analyze(aFile, bFile));
	});

}));