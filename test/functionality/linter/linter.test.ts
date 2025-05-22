import { afterAll, beforeAll, describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { setSourceProvider } from '../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { requestProviderFromFile, requestProviderFromText } from '../../../src/r-bridge/retriever';
import { amendConfig, defaultConfigOptions, DropPathsOption, InferWorkingDirectory, setConfig } from '../../../src/config';
import { Unknown } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';

describe.sequential('flowR linter', withShell(shell => {
	describe('R1 deprecated functions', () => {
		assertLinter('none', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', [], { totalRelevant: 4, totalNotDeprecated: 4 });
		assertLinter('cat', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] },
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [4, 1, 4, 6] },
		], { totalRelevant: 4, totalNotDeprecated: 2 }, { deprecatedFunctions: ['cat'] });
		assertLinter('custom cat', shell, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] }
		], { totalRelevant: 5, totalNotDeprecated: 4 }, { deprecatedFunctions: ['cat'] });
	});

	describe('R2 file path validity', () => {
		const files = ['file.csv', 'path/to/deep-file.csv', 'deep-file.csv'];
		beforeAll(() => {
			setSourceProvider(requestProviderFromText(Object.fromEntries(files.map(f => [f, '']))));
			amendConfig({ solver: {
				...defaultConfigOptions.solver,
				resolveSource: {
					dropPaths:             DropPathsOption.Once,
					ignoreCapitalization:  true,
					inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
					searchPath:            []
				}
			} });
		});
		afterAll(() => {
			setSourceProvider(requestProviderFromFile());
			setConfig((defaultConfigOptions));
		});

		assertLinter('none', shell, 'cat("hello")', 'file-path-validity', [], { totalReads: 0, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
		assertLinter('simple', shell, 'cat("hello")\nread.csv("file.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'file-missing.csv', range: [3,1,3,28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		assertLinter('simple ignore case', shell, 'cat("hello")\nread.csv("FiLe.csv")\nread.csv("FiLe-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'FiLe-missing.csv', range: [3,1,3,28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		assertLinter('deep', shell, 'cat("hello")\nread.csv("path/to/deep-file.csv")\nread.csv("path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'path/to/deep-file-missing.csv', range: [3,1,3,41] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		assertLinter('deep lax', shell, 'cat("hello")\nread.csv("invalid/path/to/deep-file.csv")\nread.csv("invalid/path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'invalid/path/to/deep-file-missing.csv', range: [3,1,3,49] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 });
		assertLinter('write before', shell, 'write.csv("hello", "file-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 });
		assertLinter('write before ignore case', shell, 'write.csv("hello", "FiLe-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 });
		assertLinter('write before never', shell, 'if(FALSE) { write.csv("hello", "file-missing.csv") }\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'file-missing.csv', range: [2,1,2,28] }
		], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });

		assertLinter('const', shell, 'path <- "file.csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { includeUnknown: true });
		assertLinter('unknown off', shell, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: false });
		assertLinter('unknown on', shell, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [
			{ certainty: LintingCertainty.Maybe, filePath: Unknown, range: [1,37,1,50] }
		], { totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: true });
	});
}));
