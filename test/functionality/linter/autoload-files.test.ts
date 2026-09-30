import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { withTreeSitter } from '../_helper/shell';
import path from 'path';

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

		assertLinter('autoload file with source absolute', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}test.R`, loc: undefined }
		], {}, { addFiles: [
			new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("/project/test.R")'),
			new FlowrInlineTextFile(`${path.sep}project${path.sep}test.R`, 'system("rm -rf /")'),
		] });
		assertLinter('autoload file with source absolute loop', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}test.R`, loc: undefined }
		], {}, { addFiles: [
			new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("/project/test.R")'),
			new FlowrInlineTextFile(`${path.sep}project${path.sep}test.R`, 'source("/project/.RProfile")'),
		] });
		assertLinter('autoload file with source relative', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}relative.R`, loc: undefined }
		], {}, { addFiles: [
			new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("relative.R")'),
			new FlowrInlineTextFile(`${path.sep}project${path.sep}relative.R`, 'system("rm -rf /")'),
		] });
		assertLinter('autoload file with source relative nested', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}test1.R`, loc: undefined },
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}nested${path.sep}test2.R`, loc: undefined },
		], {}, { addFiles: [
			new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("./test1.R")'),
			new FlowrInlineTextFile(`${path.sep}project${path.sep}test1.R`, 'source("./nested/test2.R")'),
			new FlowrInlineTextFile(`${path.sep}project${path.sep}nested${path.sep}test2.R`, 'system("rm -rf /")'),
		] });

		assertLinter('autoload file with invalid source allowed', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
		], {}, { allowInvalidFiles: true, addFiles: [new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("/project/test.R")')] });
		assertLinter('autoload file with invalid source disallowed', parser, '', 'autoload-files', [
			{ certainty: LintingResultCertainty.Certain, filePath: `${path.sep}project${path.sep}.RProfile`, loc: undefined },
			{ certainty: LintingResultCertainty.Uncertain, filePath: '/project/test.R', loc: undefined }
		], {}, { addFiles: [new FlowrInlineTextFile(`${path.sep}project${path.sep}.RProfile`, 'source("/project/test.R")')] });
	});
}));
