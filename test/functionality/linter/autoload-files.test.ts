import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', () => {
	describe('autoload-files', () => {
		assertLinter('no autoload files', undefined, '', 'autoload-files', []);
		assertLinter('basic autoload file', undefined, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });

		assertLinter('empty autoload file allowed', undefined, '', 'autoload-files', [], {},
			{ addFiles: [new FlowrInlineTextFile('/project/.RProfile', '')] });
		assertLinter('empty autoload file disallowed', undefined, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { allowEmptyFiles: false, addFiles: [new FlowrInlineTextFile('/project/.RProfile', '')] });

		assertLinter('allowed file patterns allowed', undefined, '', 'autoload-files', [], {},
			{ allowedFilePatterns: ['/project/'], addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });
		assertLinter('allowed file patterns disallowed', undefined, '', 'autoload-files',
			[{ certainty: LintingResultCertainty.Certain, filePath: '/project/.RProfile', loc: undefined }],
			{}, { allowedFilePatterns: ['/projects/'], addFiles: [new FlowrInlineTextFile('/project/.RProfile', 'system("rm -rf /")')] });
	});
});
