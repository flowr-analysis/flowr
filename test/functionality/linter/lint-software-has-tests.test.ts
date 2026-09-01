import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

describe('flowR linter', withTreeSitter(parser => {
	describe('software-has-tests', () => {
		assertLinter('no tests at all', parser, 'cat("hello")',
			'software-has-tests',
			[{ certainty: LintingResultCertainty.Certain, message: 'No tests found in the project', loc: [-1, -1, -1, -1] }],
			{ testFilesFound: 0, testCallsFound: 0 }
		);

		assertLinter('test_that call detected', parser, 'test_that("basic", { expect_true(TRUE) })',
			'software-has-tests',
			[],
			{ testFilesFound: 0, testCallsFound: 1 }
		);

		assertLinter('standalone expect_true not detected', parser, 'expect_true(1 == 1)',
			'software-has-tests',
			[{ certainty: LintingResultCertainty.Certain, message: 'No tests found in the project', loc: [-1, -1, -1, -1] }],
			{ testFilesFound: 0, testCallsFound: 0 }
		);

		assertLinter('test file in tests directory', parser, 'cat("hello")',
			'software-has-tests',
			[],
			{ testFilesFound: 1, testCallsFound: 0 },
			{ addFiles: [new FlowrInlineTextFile('/project/tests/test_main.R', '')] }
		);

		assertLinter('test file in test directory (singular)', parser, 'cat("hello")',
			'software-has-tests',
			[],
			{ testFilesFound: 1, testCallsFound: 0 },
			{ addFiles: [new FlowrInlineTextFile('/project/test/helper.R', '')] }
		);

		assertLinter('unrelated file not counted', parser, 'cat("hello")',
			'software-has-tests',
			[{ certainty: LintingResultCertainty.Certain, message: 'No tests found in the project', loc: [-1, -1, -1, -1] }],
			{ testFilesFound: 0, testCallsFound: 0 },
			{ addFiles: [new FlowrInlineTextFile('/project/R/main.R', '')] }
		);

		assertLinter('standalone expect_equal not detected', parser, 'expect_equal(1 + 1, 2)',
			'software-has-tests',
			[{ certainty: LintingResultCertainty.Certain, message: 'No tests found in the project', loc: [-1, -1, -1, -1] }],
			{ testFilesFound: 0, testCallsFound: 0 }
		);

		assertLinter('tinytest runner run_test_dir', parser, 'run_test_dir("inst/tinytest")',
			'software-has-tests',
			[],
			{ testFilesFound: 0, testCallsFound: 1 }
		);

		assertLinter('standalone checkEquals not detected', parser, 'checkEquals(1 + 1, 2)',
			'software-has-tests',
			[{ certainty: LintingResultCertainty.Certain, message: 'No tests found in the project', loc: [-1, -1, -1, -1] }],
			{ testFilesFound: 0, testCallsFound: 0 }
		);
	});
}));
