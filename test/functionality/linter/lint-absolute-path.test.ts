import { assert, describe, test } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { isAbsolutePath } from '../../../src/util/text/strings';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
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

		/* Given an absolute path and assuming a home directory of `/home/me`, we expect the linter to suggest a relative path */
		assertLinter('is relative to home', parser, '"/home/me/foo.bar"', 'absolute-file-paths', [{
			certainty: LintingResultCertainty.Uncertain,
			filePath:  '/home/me/foo.bar',
			range:     [1, 1, 1, 18],
			quickFix:  [{
				type:          'replace',
				'description': 'Replace with a relative path to `/home/me/foo.bar`',
				range:         [1, 1, 1, 18],
				replacement:   `".${path.sep}foo.bar"`
			}]
		}], { totalConsidered: 1, totalUnknown: 0 }, {
			useAsFilePath: '/home/me',
			include:       {
				allStrings: true
			}
		});
		/* Replacing absolute paths with relative paths should work within function calls as well */
		assertLinter('is relative to home', parser, 'read.csv("/home/me/foo.bar")', 'absolute-file-paths', [{
			certainty: LintingResultCertainty.Uncertain,
			filePath:  '/home/me/foo.bar',
			range:     [1, 10, 1, 27],
			quickFix:  [{
				type:          'replace',
				'description': 'Replace with a relative path to `/home/me/foo.bar`',
				range:         [1, 10, 1, 27],
				replacement:   `".${path.sep}foo.bar"`
			}]
		}], { totalConsidered: 1, totalUnknown: 0 }, {
			useAsFilePath: '/home/me',
			include:       {
				allStrings: true
			}
		});

		/* If the script contains no function that reads a file path, we expect no issues */
		assertLinter('none', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
		/* If the script contains no file paths, but we include all strings, we expect no issues either */
		assertLinter('none with all strings', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
			include: {
				allStrings: true
			}
		});

		describe('all strings', () => {
			describe('relative paths', () => {
				/* if we consider all strings for absolute paths, and the string contains something that might be a path, yet we deem it too short, we expect no issues */
				assertLinter('too short', parser, '"/x"', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
					include: {
						allStrings: true
					}
				});


				for(const relPath of ['./file.csv', '../file.csv', 'file.csv', 'a\\b\\c.csv']) {
					/* @ignore-in-wiki */
					assertLinter(`"${relPath}"`, parser, `x <- "${relPath}"`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 }, {
						include: {
							allStrings: true
						}
					});
				}
			});
			describe('absolute paths', () => {
				for(const absPath of ['/absolute/path/file.csv', 'C:\\absolute\\path\\file.csv', 'G:\\absolute\\path\\file.txt']) {
					/* @ignore-in-wiki */
					assertLinter(`"${absPath}"`, parser, `x <- "${absPath}"`, 'absolute-file-paths', [
						{
							certainty: LintingResultCertainty.Uncertain,
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
						/* @ignore-in-wiki */
						assertLinter(`"${relPath}"`, parser, `${fn}("${relPath}")`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					}
				});
				describe('raw strings', () => {
					/* @ignore-in-wiki */
					assertLinter('R()', parser, `${fn}(R"(./x)")`, 'absolute-file-paths', [], {
						totalConsidered: 1,
						totalUnknown:    0
					});
					/* @ignore-in-wiki */
					assertLinter('--[]--', parser, `${fn}(R"--[./x]--")`, 'absolute-file-paths', [], {
						totalConsidered: 1,
						totalUnknown:    0
					});
				});
				describe('unknown paths', () => {
					for(const relPath of ['x', 'paste0("a", u)', 'runif(42)']) {
						/* @ignore-in-wiki */
						assertLinter(`${relPath}`, parser, `${fn}(${relPath})`, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
					}
				});
				describe('absolute paths', () => {
					for(const absPath of ['/absolute/path/file.csv', 'C:\\absolute\\path\\file.csv', 'G:\\absolute\\path\\file.txt']) {
						/* @ignore-in-wiki */
						assertLinter(`"${absPath}"`, parser, `${fn}("${absPath}")`, 'absolute-file-paths', [
							{
								certainty: LintingResultCertainty.Certain,
								filePath:  absPath,
								range:     [1, 1, 1, absPath.length + 2 + fn.length + 2] // +2 for the quotes and the parentheses
							}
						], { totalConsidered: 1, totalUnknown: 0 });
					}
					describe('raw strings', () => {
						/* @ignore-in-wiki */
						assertLinter('R()', parser, `${fn}(R"(/x/y)")`, 'absolute-file-paths', [{
							certainty: LintingResultCertainty.Certain,
							filePath:  '/x/y',
							range:     [1, 1, 1, 11 + fn.length] // length of the string + function name + parentheses
						}], {
							totalConsidered: 1,
							totalUnknown:    0
						});
						/* @ignore-in-wiki */
						assertLinter('--[]--', parser, `${fn}(R"--[C:\\hello.txt]--")`, 'absolute-file-paths', [{
							certainty: LintingResultCertainty.Certain,
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
						/* @ignore-in-wiki */
						assertLinter(command, parser, command, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					}
					/* As we also incorporate the `file.path` function, we should be able to detect relative paths with a given separator */
					assertLinter('change fsep', parser, 'file.path("a", "b", fsep="\\\\")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
					assertLinter('skrewed fsep', parser, 'file.path("a", "b", fsep="")', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 0 });
				});
				describe('unknown paths', () => {
					for(const components of [['a', Unknown, 'c'], ['a/b/c', 'd/e/f', Unknown], [Unknown, 'a\\b\\c', 'd\\e\\f']] as const) {
						const command = `file.path(${components.map(c => c === Unknown ? 'u' : `"${c}"`).join(', ')})`;
						/* @ignore-in-wiki */
						assertLinter(command, parser, command, 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
					}
					assertLinter('skrewed fsep', parser, 'file.path("a", "b", fsep=u)', 'absolute-file-paths', [], { totalConsidered: 1, totalUnknown: 1 });
				});
				describe('absolute paths', () => {
					for(const components of [['/absolute/path', 'file.csv'], ['G:', 'a', 'b.txt'], ['', 'a.txt'], ['C:\\absolute\\path', 'file.csv'], ['G:\\absolute\\path', 'file.txt']] as const) {
						const command = `file.path(${components.map(c => `"${c}"`).join(', ')})`;
						/* @ignore-in-wiki */
						assertLinter(command, parser, command, 'absolute-file-paths', [
							{
								certainty: LintingResultCertainty.Uncertain,
								filePath:  components.join(path.sep),
								range:     [1, 1, 1, command.length]
							}
						], { totalConsidered: 1, totalUnknown: 0 });
					}
					assertLinter('change fsep', parser, 'file.path("C:", "b", fsep="\\\\")', 'absolute-file-paths', [
						{
							certainty: LintingResultCertainty.Uncertain,
							filePath:  'C:\\\\b',
							range:     [1, 1, 1, 31]
						}
					], { totalConsidered: 1, totalUnknown: 0 });
					/* If someone constructs an absolute path due to a (cursed) fsep, we should still be able to detect it */
					assertLinter('skrewed fsep', parser, 'file.path("C", "b", fsep=":/")', 'absolute-file-paths', [
						{
							certainty: LintingResultCertainty.Uncertain,
							filePath:  'C:/b',
							range:     [1, 1, 1, 30]
						}
					], { totalConsidered: 1, totalUnknown: 0 });
				});
			});
		});
	});
}));
