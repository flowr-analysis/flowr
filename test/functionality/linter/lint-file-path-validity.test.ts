import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { Unknown } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { withTreeSitter } from '../_helper/shell';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { getPlatform } from '../../../src/util/os';

describe('flowR linter', withTreeSitter(parser => {
	describe('file path validity', () => {
		const addFiles = [
			new FlowrInlineTextFile('file.csv', ''),
			new FlowrInlineTextFile('path/to/deep-file.csv', ''),
			new FlowrInlineTextFile('deep-file.csv', '')
		];

		/* As the script contains no file paths, we expect no issues */
		assertLinter('none', parser, 'cat("hello")', 'file-path-validity', [], { totalReads: 0, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
		assertLinter('a data set name is no file', parser, 'data("rat")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/rat', loc: [1, 1, 1, 11] }
		]);
		assertLinter('a data set in the data directory', parser, 'data("rat")', 'file-path-validity', [], undefined, { addFiles: [new FlowrInlineTextFile('data/rat.rda', '')] });
		assertLinter('a base data set', parser, 'data("iris")', 'file-path-validity', []);
		assertLinter('a data set of a named package', parser, 'data("rat", package = "foo")', 'file-path-validity', []);
		assertLinter('a data set a loaded package may provide', parser, 'library(foo)\ndata("rat")', 'file-path-validity', []);
		assertLinter('a package attached only after the data call provides nothing to it', parser, 'data("Boston")\nlibrary(MASS)', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/Boston', loc: [1, 1, 1, 14] }
		]);
		assertLinter('a package named for one data call does not cover another', parser, 'data("Boston", package = "MASS")\ndata("mouse")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/mouse', loc: [2, 1, 2, 13] }
		]);
		assertLinter('a namespaced data call', parser, 'utils::data("rat")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/rat', loc: [1, 1, 1, 18] }
		]);
		assertLinter('every data set named', parser, 'data("iris", "rat")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/rat', loc: [1, 1, 1, 19] }
		]);
		assertLinter('a data set named by list', parser, 'data(list = "rat")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/rat', loc: [1, 1, 1, 18] }
		]);
		assertLinter('a data set after setwd', parser, 'setwd("sub")\ndata("rat")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'data/rat', loc: [2, 1, 2, 11] }
		], undefined, { addFiles: [new FlowrInlineTextFile('data/rat.rda', '')] });
		assertLinter('the native pipe hands the file over', parser, '"missing.csv" |> read.csv()', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'missing.csv', loc: [1, 18, 1, 27] }
		]);
		assertLinter('a named argument is no positional file, the piped one is', parser, 'library(magrittr)\n"a.csv" %>% read.csv(stringsAsFactors = FALSE)', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'a.csv', loc: [2, 13, 2, 46] }
		]);
		assertLinter('a read guarded by an existence check of the same file', parser, 'if(file.exists("cfg.yml")) readLines("cfg.yml")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: 'cfg.yml', loc: [1, 28, 1, 47] }
		]);
		assertLinter('a check of another file is no guard', parser, 'if(file.exists("other.yml")) readLines("cfg.yml")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'cfg.yml', loc: [1, 30, 1, 49] }
		]);
		assertLinter('a check whose branch does not hold the read is no guard', parser, 'if(file.exists("cfg.yml")) 1\nreadLines("cfg.yml")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'cfg.yml', loc: [2, 1, 2, 20] }
		]);
		assertLinter('data built from constants reads no file', parser, 'm <- matrix(1:6, nrow = 2)\nt(m) %*% m', 'file-path-validity', []);
		/* Assuming, that `file.csv` exists, we expect the linter to not report any issues, but to report an invalid file path for `file-missing.csv` */
		assertLinter('simple', parser, 'cat("hello")\nread.csv("file.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'file-missing.csv', loc: [3, 1, 3, 28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles });
		/* If we configure the linter to ignore capitalization, we expect the linter to not report an issue for `file.csv`, but still report an issue for `file-missing.csv` */
		assertLinter('simple ignore case', parser, 'cat("hello")\nread.csv("FiLe.csv")\nread.csv("FiLe-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'FiLe-missing.csv', loc: [3, 1, 3, 28] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles });
		/* Linting should also work for relative paths, as long as the file exists, we assume `path/to/deep-file.csv` to exist */
		assertLinter('deep', parser, 'cat("hello")\nread.csv("path/to/deep-file.csv")\nread.csv("path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'path/to/deep-file-missing.csv', loc: [3, 1, 3, 41] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles });
		/* If we use a relative path that is not valid (we expect there to be no `invalid/` folder), we expect the linter to report an issue too */
		assertLinter('deep lax', parser, 'cat("hello")\nread.csv("invalid/path/to/deep-file.csv")\nread.csv("invalid/path/to/deep-file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'invalid/path/to/deep-file-missing.csv', loc: [3, 1, 3, 49] }
		], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles });
		/* setwd makes a relative path resolve against the new working directory (location sensitive) */
		const wdFiles = [new FlowrInlineTextFile('sub/only-here.csv', '')];
		assertLinter('setwd relative valid', parser, 'setwd("sub")\nread.csv("only-here.csv")', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles: wdFiles });
		assertLinter('setwd hides the old root', parser, 'setwd("sub")\nread.csv("only-here.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'only-here.csv', loc: [2, 1, 2, 25] }
		], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 }, { addFiles: [new FlowrInlineTextFile('only-here.csv', '')] });
		/* without the setwd the same relative path is missing (guards the case above against a false pass) */
		assertLinter('no setwd relative missing', parser, 'read.csv("only-here.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'only-here.csv', loc: [1, 1, 1, 25] }
		], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 }, { addFiles: wdFiles });
		/* If we use a relative path that is not valid, but we create a file of such a name within the script, we expect the linter to not report an issue */
		assertLinter('write before', parser, 'write.csv("hello", "file-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 }, { addFiles });
		for(const create of ['file.create("file-missing.csv")', 'download.file("https://x.org", "file-missing.csv")', 'file.copy("file.csv", "file-missing.csv")']) {
			assertLinter(`created by ${create}`, parser, `${create}\nread.csv("file-missing.csv")`, 'file-path-validity', [], undefined, { addFiles });
		}
		assertLinter('creating another file does not create the one read', parser, 'file.create("other.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'file-missing.csv', loc: [2, 1, 2, 28] }
		], undefined, { addFiles });
		/* If we use a relative path that is not valid, but we create a file of such a name within the script, and ignore case, we expect the linter to not report an issue */
		assertLinter('write before ignore case', parser, 'write.csv("hello", "FiLe-missing.csv")\nread.csv("file-missing.csv")', 'file-path-validity', [], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 1, totalValid: 0 }, { addFiles });
		/* If the code that is supposed to write the file is never executed, we expect the linter to report an issue for the missing file */
		assertLinter('write before never', parser, 'if(FALSE) { write.csv("hello", "file-missing.csv") }\nread.csv("file-missing.csv")', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Certain, filePath: 'file-missing.csv', loc: [2, 1, 2, 28] }
		], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 }, { addFiles });
		/* We should be able to recognize file paths that are bound to variables */
		assertLinter('const', parser, 'path <- "file.csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { includeUnknown: true, addFiles });
		/* If we configure the linter to do nothing for unknown file paths, we expect it to not report an issue for the unknown file path */
		assertLinter('unknown off', parser, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [],
			{ totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: false, addFiles });
		/* If we configure the linter to report unknown file paths, we expect it to report an issue for the unknown file path */
		assertLinter('unknown on', parser, 'path <- "file" + runif(1) + ".csv"; read.csv(path)', 'file-path-validity', [
			{ certainty: LintingResultCertainty.Uncertain, filePath: Unknown, loc: [1, 37, 1, 50] }
		], { totalReads: 1, totalUnknown: 1, totalWritesBeforeAlways: 0, totalValid: 0 }, { includeUnknown: true, addFiles });

		describe('url handling', () => {
			const remoteUrls = [
				'https://raw.githubusercontent.com/user/repo/main/data.csv',
				'http://example.com/data.csv',
				'ftp://files.example.org/data.csv',
				'ftps://secure.ftp.example.org/data.csv',
				's3://my-bucket/data.csv',
				'gs://my-bucket/data.csv'
			];

			describe('checkUrls=false (default)', () => {
				for(const url of remoteUrls) {
					/* @ignore-in-wiki */
					assertLinter(url, parser, `read.csv("${url}")`, 'file-path-validity', [],
						{ totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
				}
				assertLinter('url and missing file', parser, `read.csv("${remoteUrls[0]}")\nread.csv("missing.csv")`, 'file-path-validity', [
					{ certainty: LintingResultCertainty.Certain, filePath: 'missing.csv', loc: [2, 1, 2, 23] }
				], { totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
				assertLinter('url and existing file', parser, `read.csv("${remoteUrls[0]}")\nread.csv("file.csv")`, 'file-path-validity', [],
					{ totalReads: 2, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 1 }, { addFiles });
			});

			describe.skipIf(getPlatform() === 'windows')('file:// urls (checked as local paths, ignores checkUrls)', () => {
				assertLinter('file:// missing', parser, 'read.csv("file:///missing/file.csv")', 'file-path-validity', [
					{ certainty: LintingResultCertainty.Certain, filePath: '/missing/file.csv', loc: [1, 1, 1, 36] }
				], { totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0 });
			});
		});
	});
}));
