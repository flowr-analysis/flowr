import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { withTreeSitter } from '../_helper/shell';

describe('flowR linter', withTreeSitter(parser => {
	describe('autoload-files', () => {
		assertLinter('no autoload files', parser, '', 'autoload-files', []);
		assertLinter('basic autoload file', parser, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });

		assertLinter('empty autoload file allowed', parser, '', 'autoload-files', [], {},
			{ addFiles: [new FlowrInlineTextFile('/project/.RProfile', '')] });
		assertLinter('empty autoload file disallowed', parser, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { allowEmptyFiles: false, addFiles: [new FlowrInlineTextFile('/project/.RProfile', '')] });

		assertLinter('allowed file patterns allowed', parser, '', 'autoload-files', [], {},
			{ allowedFilePatterns: ['/project/'], addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });
		assertLinter('allowed file patterns disallowed', parser, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { allowedFilePatterns: ['/projects/'], addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });

		assertLinter('autoload file with source', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: '/project/test.R', loc: undefined }
		], {}, { addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'source("/project/test.R")')] });
	});
}));
