import { assert, describe, test } from 'vitest';
import { withShell } from '../../_helper/shell';
import { slicingCriterionToId, type SingleSlicingCriterion, type SlicingCriteria } from '../../../../src/slicing/criterion/parse';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { defaultConfigOptions } from '../../../../src/config';
import { getAllRefsToSymbol } from '../../../../src/dataflow/origin/dfg-get-symbol-refs';
import { decorateLabelContext } from '../../_helper/label';
import type { SourceRange } from '../../../../src/util/range';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('Get Symbol Refs IO Tests', withShell(shell => {
	function testRename(name: string, input: string, symbol: SingleSlicingCriterion, expectedRefs: SlicingCriteria | undefined) {
		test(decorateLabelContext(name, ['other']), async() => {
			const { dataflow, normalize } = await createDataflowPipeline(shell, { request: requestFromInput(input.trim()) }, defaultConfigOptions).allRemainingSteps();
			
			const symbolId = slicingCriterionToId(symbol, normalize.idMap);
			const refs = getAllRefsToSymbol(dataflow.graph, symbolId);
			
			// If we don't expect any renames make sure there are none
			if(expectedRefs === undefined) {
				assert.isUndefined(refs);
				return;
			}

			// Otherwise check renames and output
			const expectedRenameIds = expectedRefs.map(c => slicingCriterionToId(c, normalize.idMap));
			assert.deepEqual(refs, expectedRenameIds);

			// Apply Renames
			const newInput = input.split('\n');
			const replacements = (refs as NodeId[])
				.map(v => normalize.idMap.get(v)?.info.fullRange as SourceRange)
				.sort((a, b) => a[0] == b[0] ? b[1] - a[1] : b[0] - a[0]);

			for(const range of replacements) {
				const line = newInput[range[0] - 1];
				newInput[range[0] - 1] = line.substring(0, range[1] - 1) + 'FooBar' + line.substring(range[3]);
			}	
			
			// Generate original output	
			shell.clearEnvironment();
			const expectedLines = await shell.sendCommandWithOutput(input);

			// Generate output after rename
			shell.clearEnvironment();
			const actualLines = await shell.sendCommandWithOutput(newInput.join('\n'));

			assert.strictEqual(actualLines.join('\n'), expectedLines.join('\n'), `Renamed Input was: ${newInput.join('\\n')}`);
		});
	}

	testRename('Simple',      'test<-1\nprint(test)',                             '2@test', ['1@test', '2@test']);
	testRename('Named Arg',   'f <- function(foo) foo\ny <- f(foo=12)\nprint(y)', '1@foo',  ['$1', '$3', '$11']);

	testRename('Inside Scope', 'y <- 2 \n f <- function() { y <- 5\nprint(y) }',   '2@y',    ['2@y', '3@y']);
	testRename('Outside Scope','y <- 2 \n f <- function() { y <- 5\nprint(y) }',   '1@y',    ['1@y']);

}));