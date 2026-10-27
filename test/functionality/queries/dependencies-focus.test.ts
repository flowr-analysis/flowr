import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { uniqueArray } from '../../../src/util/collections/arrays';
import { SourceRange } from '../../../src/util/range';

describe('Dependencies query focus', withTreeSitter(parser => {
	/** the lines of `code` that take part in the dependencies at `focus` */
	async function focusedLines(code: string, focus: readonly SlicingCriterion[]): Promise<number[] | undefined> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput(code));
		const { dependencies } = await analyzer.query([{ type: 'dependencies', focus }]);
		const { idMap } = await analyzer.normalize();
		const ids = dependencies['.meta'].focus;
		return ids === undefined ? undefined : uniqueArray(ids.flatMap(id => SourceRange.getStartLine(idMap.get(id)?.location) ?? [])).sort((a, b) => a - b);
	}

	const code = 'f <- "a.csv"\ng <- 2\nd <- read.csv(f)\nh <- g + 1\nprint(d)';
	test(label('a read takes part with what names its file and what uses its data', ['name-normal', 'strings', 'newlines'], ['dependencies']), async() => {
		assert.deepStrictEqual(await focusedLines(code, ['3@read.csv']), [1, 3, 5]);
	});
	test(label('an output takes part with what it prints', ['name-normal', 'strings', 'newlines'], ['dependencies']), async() => {
		assert.deepStrictEqual(await focusedLines(code, ['5@print']), [1, 3, 5]);
	});
	test(label('without a focus there is none', ['name-normal'], ['dependencies']), async() => {
		assert.isUndefined(await focusedLines(code, []));
	});
}));
