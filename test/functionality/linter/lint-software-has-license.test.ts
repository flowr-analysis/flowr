import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

describe('flowR linter', withTreeSitter(parser => {
	describe('software-has-license', () => {
		assertLinter('no license in plain script', parser, 'cat("hello")',
			'software-has-license',
			[{ certainty: LintingResultCertainty.Certain, message: 'No license found in the project', loc: [-1, -1, -1, -1] }],
			{}
		);

		assertLinter('license file present', parser, 'cat("hello")',
			'software-has-license',
			[],
			{},
			{ addFiles: [new FlowrInlineTextFile('/project/LICENSE', 'MIT License')] }
		);

		assertLinter('license.md present', parser, 'cat("hello")',
			'software-has-license',
			[],
			{},
			{ addFiles: [new FlowrInlineTextFile('/project/LICENSE.md', '## License\nMIT')] }
		);

		assertLinter('unrelated file does not count', parser, 'cat("hello")',
			'software-has-license',
			[{ certainty: LintingResultCertainty.Certain, message: 'No license found in the project', loc: [-1, -1, -1, -1] }],
			{},
			{ addFiles: [new FlowrInlineTextFile('/project/README.md', 'no license here')] }
		);

		assertLinter('description file with license', parser, 'cat("hello")',
			'software-has-license',
			[],
			{},
			{ addFiles: [new FlowrInlineTextFile('/project/DESCRIPTION', 'Package: Foo\nVersion: 1.0\nLicense: MIT\n')] }
		);

		assertLinter('description file without license field', parser, 'cat("hello")',
			'software-has-license',
			[{ certainty: LintingResultCertainty.Certain, message: 'No license found in the project', loc: [-1, -1, -1, -1] }],
			{},
			{ addFiles: [new FlowrInlineTextFile('/project/DESCRIPTION', 'Package: Foo\nVersion: 1.0\n')] }
		);

		assertLinter('description check disabled', parser, 'cat("hello")',
			'software-has-license',
			[{ certainty: LintingResultCertainty.Certain, message: 'No license found in the project', loc: [-1, -1, -1, -1] }],
			{},
			{
				addFiles:             [new FlowrInlineTextFile('/project/DESCRIPTION', 'Package: Foo\nVersion: 1.0\nLicense: MIT\n')],
				checkDescriptionFile: false
			}
		);
	});
}));
