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
import type { RShell } from '../../../../src/r-bridge/shell';

function testRename(shell: RShell, name: string, input: string, symbol: SingleSlicingCriterion, expectedRefs: SlicingCriteria | undefined) {
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
			.map(v => {
				const node = normalize.idMap.get(v);
				if(node === undefined) {
					assert.fail('Could not find node in ast');
				}

				const range = node.info.fullRange as SourceRange;
				range[3] = range[1] + (node.lexeme as string).length - 1;
				return range;
			})
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

describe.sequential('Get Symbol Refs IO Tests (1)', withShell(shell => {
	testRename(shell, 'Simple',      'test<-1\nprint(test)',                             '2@test', ['1@test', '2@test']);
	testRename(shell, 'Named Arg',   'f <- function(foo) foo\ny <- f(foo=12)\nprint(y)', '1@foo',  ['$1', '$3', '$11']);
}));

describe.sequential('Get Symbol Refs IO Tests (2)', withShell(shell => {
	testRename(shell, 'Inside Scope', 'y <- 2 \n f <- function() { y <- 5\nprint(y) }',   '2@y',    ['2@y', '3@y']);
	testRename(shell, 'Outside Scope','y <- 2 \n f <- function() { y <- 5\nprint(y) }',   '1@y',    ['1@y']);
}));

describe.sequential('Get Symbol Refs IO Tests (3)', withShell(shell => {
	const testCode = `f <- function() {
  x <- 2
  function() { x <<- 1 } 
}
g <- f()
g()
x <- g()
print(x)`;

	//         Shell   Name             Code     to rename  expected renames
	testRename(shell, 'Super assign 1', testCode, '1@f',    ['1@f', '5@f']);
	testRename(shell, 'Super assign 2', testCode, '2@x',    ['2@x']);
	testRename(shell, 'Super assign 3', testCode, '3@x',    ['3@x']);
	testRename(shell, 'Super assign 4', testCode, '5@g',    ['5@g', '6@g', '7@g']);
	testRename(shell, 'Super assign 5', testCode, '7@x',    ['7@x', '8@x']);
}));
