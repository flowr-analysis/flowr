import { afterAll, beforeAll, describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { setSourceProvider } from '../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { requestProviderFromFile, requestProviderFromText } from '../../../src/r-bridge/retriever';
import { amendConfig, defaultConfigOptions, DropPathsOption, InferWorkingDirectory, setConfig } from '../../../src/config';

describe.sequential('flowR linter', withShell(shell => {
	describe('R1 deprecated functions', () => {
		assertLinter('none', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', []);
		assertLinter('cat', shell, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] },
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [4, 1, 4, 6] },
		], { deprecatedFunctions: ['cat'] });
		assertLinter('custom cat', shell, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)', 'deprecated-functions', [
			{ certainty: LintingCertainty.Definitely, function: 'cat', range: [1, 1, 1, 12] }
		], { deprecatedFunctions: ['cat'] });
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

		assertLinter('none', shell, 'cat("hello")', 'file-path-validity', []);
		assertLinter('simple', shell, 'cat("hello")\nread.csv("file.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'file-missing.csv', range: [3,1,3,28] }
		]);
		assertLinter('deep', shell, 'cat("hello")\nread.csv("path/to/deep-file.csv")\nread.csv("path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'path/to/deep-file-missing.csv', range: [3,1,3,41] }
		]);
		assertLinter('deep-lax', shell, 'cat("hello")\nread.csv("invalid/path/to/deep-file.csv")\nread.csv("invalid/path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingCertainty.Definitely, filePath: 'invalid/path/to/deep-file-missing.csv', range: [3,1,3,49] }
		]);
	});
}));
