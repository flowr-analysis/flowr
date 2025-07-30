import { beforeAll, describe } from 'vitest';
import { setSourceProvider } from '../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { requestProviderFromText } from '../../../src/r-bridge/retriever';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { Unknown } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { withTreeSitter } from '../_helper/shell';

describe('flowR linter', withTreeSitter(parser => {
	describe('file path validity', () => {
		const files = ['file.csv', 'path/to/deep-file.csv', 'deep-file.csv'];
		beforeAll(() => {
			setSourceProvider(requestProviderFromText(Object.fromEntries(files.map(f => [f, '']))));
		});

		/* As the script contains no file paths, we expect no issues */
		assertLinter('none', parser, 'cat("hello")', 'file-path-validity', [], { totalReads: 0, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
		/* Assuming, that `file.csv` exists, we expect the linter to not report any issues, but to report an invalid file path for `file-missing.csv` */
		assertLinter('simple', parser, 'cat("hello")\nread.csv("file.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Certain, filePath: 'file-missing.csv', range: [3, 1, 3, 28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		/* If we configure the linter to ignore capitalization, we expect the linter to not report an issue for `file.csv`, but still report an issue for `file-missing.csv` */
		assertLinter('simple ignore case', parser, 'cat("hello")\nread.csv("FiLe.csv")\nread.csv("FiLe-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Certain, filePath: 'FiLe-missing.csv', range: [3, 1, 3, 28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		/* Linting should also work for relative paths, as long as the file exists, we assume `path/to/deep-file.csv` to exist */
		assertLinter('deep', parser, 'cat("hello")\nread.csv("path/to/deep-file.csv")\nread.csv("path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Certain, filePath: 'path/to/deep-file-missing.csv', range: [3, 1, 3, 41] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		/* If we use a relative path that is not valid (we expect there to be no `invalid/` folder), we expect the linter to report an issue too */
		assertLinter('deep lax', parser, 'cat("hello")\nread.csv("invalid/path/to/deep-file.csv")\nread.csv("invalid/path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Certain, filePath: 'invalid/path/to/deep-file-missing.csv', range: [3, 1, 3, 49] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		/* If we use a relative path that is not valid, but we create a file of such a name within the script, we expect the linter to not report an issue */
		assertLinter('write before', parser, 'write.csv("hello", "file-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 });
		/* If we use a relative path that is not valid, but we create a file of such a name within the script, and ignore case, we expect the linter to not report an issue */
		assertLinter('write before ignore case', parser, 'write.csv("hello", "FiLe-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 });
		/* If the code that is supposed to write the file is never executed, we expect the linter to report an issue for the missing file */
		assertLinter('write before never', parser, 'if(FALSE) { write.csv("hello", "file-missing.csv") }\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Certain, filePath: 'file-missing.csv', range: [2, 1, 2, 28] }
		], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
		/* We should be able to recognize file paths that are bound to variables */
		assertLinter('const', parser, 'path <- "file.csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { includeUnknown: true });
		/* If we configure the linter to do nothing for unknown file paths, we expect it to not report an issue for the unknown file path */
		assertLinter('unknown off', parser, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: false });
		/* If we configure the linter to report unknown file paths, we expect it to report an issue for the unknown file path */
		assertLinter('unknown on', parser, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [
			{ certainty: LintingCertainty.Uncertain, filePath: Unknown, range: [1, 37, 1, 50] }
		], { totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: true });
	});
}));
