import { assert, describe, test } from 'vitest';


import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { isAbsolutePath } from '../../../src/util/text/strings';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { Unknown } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import path from 'path';

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

		describe('all strings', () => {
			describe('relative paths', () => {
				assertLinter('none with all strings', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
					include: {
						allStrings: true
					}
				});

				assertLinter('too short', parser, '"/x"', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
					include: {
						allStrings: true
					}
				});


				for(const relPath of ['./file.csv', '../file.csv', 'file.csv', 'a\\b\\c.csv']) {
					assertLinter(`"${relPath}"`, parser, `x <- "${relPath}"`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
						include: {
							allStrings: true
						}
					});
				}
			});
			describe('absolute paths', () => {
				for(const absPath of ['/absolute/path/file.csv', 'C:\\absolute\\path\\file.csv', 'G:\\absolute\\path\\file.txt']) {
					assertLinter(`"${absPath}"`, parser, `x <- "${absPath}"`, 'absolute-file-paths', [
						{
							certainty: LintingCertainty.Maybe,
							filePath:  absPath,
							range:     [1, 6, 1, absPath.length + 2 + 3 + 2] // +2 for the quotes and the assignment
						}
					], { totalConsidered: 1, totalUnknown: 0 }, {
						include: {
							allStrings: true
						}
					});
				}
			});
		});

		describe('path functions', () => {
			describe.each(['read.csv', 'source', 'png'])('%s', fn => {
				describe('relative paths', () => {
					for(const relPath of ['./file.csv', '../file.csv', 'file.csv', 'a\\b\\c.csv']) {
						assertLinter(`"${relPath}"`, parser, `${fn}("${relPath}")`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					}
				});
				describe('raw strings', () => {
					assertLinter('R()', parser, `${fn}(R"(./x)")`, 'absolute-file-paths', [], {
						totalConsidered: 1,
						totalUnknown:    0
					});
					assertLinter('--[]--', parser, `${fn}(R"--[./x]--")`, 'absolute-file-paths', [], {
						totalConsidered: 1,
						totalUnknown:    0
					});
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
					describe('raw strings', () => {
						assertLinter('R()', parser, `${fn}(R"(/x/y)")`, 'absolute-file-paths', [{
							certainty: LintingCertainty.Definitely,
							filePath:  '/x/y',
							range:     [1, 1, 1, 11 + fn.length] // length of the string + function name + parentheses
						}], {
							totalConsidered: 1,
							totalUnknown:    0
						});
						assertLinter('--[]--', parser, `${fn}(R"--[C:\\hello.txt]--")`, 'absolute-file-paths', [{
							certainty: LintingCertainty.Definitely,
							filePath:  'C:\\hello.txt',
							range:     [1, 1, 1, fn.length + 23] // length of the string + function name + parentheses
						}], {
							totalConsidered: 1,
							totalUnknown:    0
						});
					});
				});
			});
		});

		describe('construction functions', () => {
			describe('file.path', () => {
				describe('relative paths', () => {
					for(const components of [['a', 'b', 'c'], ['a/b/c', 'd/e/f'], ['a\\b\\c', 'd\\e\\f']] as const) {
						const command = `file.path(${components.map(c => `"${c}"`).join(', ')})`;
						assertLinter(command, parser, command, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					}
					assertLinter('change fsep', parser, 'file.path("a", "b", fsep="\\\\")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					assertLinter('skrewed fsep', parser, 'file.path("a", "b", fsep="")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
				});
				describe('unknown paths', () => {
					for(const components of [['a', Unknown, 'c'], ['a/b/c', 'd/e/f', Unknown], [Unknown, 'a\\b\\c', 'd\\e\\f']] as const) {
						const command = `file.path(${components.map(c => c === Unknown ? 'u' : `"${c}"`).join(', ')})`;
						assertLinter(command, parser, command, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
					}
					assertLinter('skrewed fsep', parser, 'file.path("a", "b", fsep=u)', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
				});
				describe('absolute paths', () => {
					for(const components of [['/absolute/path', 'file.csv'], ['G:', 'a', 'b.txt'], ['', 'a.txt'], ['C:\\absolute\\path', 'file.csv'], ['G:\\absolute\\path', 'file.txt']] as const) {
						const command = `file.path(${components.map(c => `"${c}"`).join(', ')})`;
						assertLinter(command, parser, command, 'absolute-file-paths', [
							{
								certainty: LintingCertainty.Maybe,
								filePath:  components.join(path.sep),
								range:     [1, 1, 1, command.length]
							}
						], { totalConsidered: 1, totalUnknown: 0 });
					}
					assertLinter('change fsep', parser, 'file.path("C:", "b", fsep="\\\\")', 'absolute-file-paths', [
						{
							certainty: LintingCertainty.Maybe,
							filePath:  'C:\\\\b',
							range:     [1, 1, 1, 31]
						}
					], { totalConsidered: 1, totalUnknown: 0 });
					assertLinter('skrewed fsep', parser, 'file.path("C", "b", fsep=":/")', 'absolute-file-paths', [
						{
							certainty: LintingCertainty.Maybe,
							filePath:  'C:/b',
							range:     [1, 1, 1, 30]
						}
					], { totalConsidered: 1, totalUnknown: 0 });
				});
			});
		});
	});
}));
