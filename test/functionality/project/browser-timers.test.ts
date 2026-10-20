import { afterEach, assert, describe, test, vi } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';

describe('Analyzer in a browser', withTreeSitter(parser => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/* a browser's timers are plain numbers without `unref`, which the playground relies on */
	test('queries work with timers that cannot be unreferenced', async() => {
		const native = setTimeout;
		vi.stubGlobal('setTimeout', (fn: () => void, ms?: number) => Number(native(fn, ms)));
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput('library(dplyr)\nf <- function() 1\nf()'));
		const result = await analyzer.query([{ type: 'dependencies' }]);
		assert.notProperty(result.dependencies, 'error');
		assert.lengthOf(result.dependencies.library, 1);
		await new Promise(resolve => native(resolve, 10));
	});
}));
