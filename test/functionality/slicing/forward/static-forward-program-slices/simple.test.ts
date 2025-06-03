import { assertSliced, withShell } from '../../../_helper/shell';
import { describe } from 'vitest';
import type { SlicingCriteria } from '../../../../../src/slicing/criterion/parse';
import { label } from '../../../_helper/label';

describe.sequential('Simple Forward', withShell(shell => {
	function testForwardSlice(code: string, criteria: SlicingCriteria, expected: string) {
		assertSliced(label(`Forward slice: ${code}`), shell, code, criteria, expected, { forwardSlice: true });
	}

	testForwardSlice(`x <- 1
y <- 2
print(x + y)
		`, ['1@x'], 'x <- 1\nprint(x + y)');
	testForwardSlice(`f <- function() {
	  x <<- 2
	}
f()
print(x + y)
		`, ['2@x'], '{ x <<- 2 }\nf()\nprint(x + y)');
}));
