import { assert, describe, test } from 'vitest';


import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { isAbsolutePath } from '../../../src/util/text/strings';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('absolute path linter', () => {

		describe('utility functions', () => {
			describe('is absolute path', () => {
				test.each(['/absolute/path', 'C:\\absolute\\path', 'G:\\absolute\\path\\file.txt', '/home/user/file.txt', 'C:/absolute/path/file.txt'])('%s', p => {
					assert.isTrue(isAbsolutePath(p, undefined));
				});
				test.each(['relative/path', 'home/user/file.txt', '../../a/../b/../c.txt'])('%s', p => {
					assert.isFalse(isAbsolutePath(p, undefined));
				});
			});
		});

		assertLinter('none', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
		assertLinter('none with all strings', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
			include: {
				allStrings: true
			}
		});

		describe('path functions', () => {
			describe.each(['read.csv', 'source', 'png'])('%s', fn => {
				describe('relative paths', () => {
					for(const relPath of ['./file.csv', '../file.csv', 'file.csv', 'a\\b\\c.csv']) {
						assertLinter(`"${relPath}"`, parser, `${fn}("${relPath}")`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					}
				});
				describe('unknown paths', () => {
					for(const relPath of ['x', 'paste0("a", u)', 'runif(42)']) {
						assertLinter(`${relPath}`, parser, `${fn}(${relPath})`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
					}
				});
				describe('absolute paths', () => {
					for(const absPath of ['/absolute/path/file.csv', 'C:\\absolute\\path\\file.csv', 'G:\\absolute\\path\\file.txt']) {
						assertLinter(`"${absPath}"`, parser, `${fn}("${absPath}")`, 'absolute-file-paths', [
							{
								certainty: LintingCertainty.Definitely,
								filePath:  absPath,
								range:     [1, 1, 1, absPath.length + 2 + fn.length + 2] // +2 for the quotes and the parentheses
							}
						], { totalConsidered: 1, totalUnknown: 0 });
					}
				});
			});
		});
	});
}));
