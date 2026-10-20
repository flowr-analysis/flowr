import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('non-ascii-code', () => {
		const fix = (replacement: string, [sl, sc, el, ec]: readonly number[]) => [{ type: 'replace', description: 'Escape the non-ASCII characters', replacement, loc: [sl, sc, el, ec, '/pkg/R/code.R'] }];

		describe('string literals', () => {
			assertLinterPackage('umlaut in a string', parser, 'f <- function() "ü"', 'non-ascii-code', [
				{ certainty: LintingResultCertainty.Certain, kind: 'string', characters: ['ü'], loc: [1, 17, 1, 19, '/pkg/R/code.R'], message: 'Non-ASCII characters in string literal (ü), use \\uxxxx escapes instead', quickFix: fix('"\\u00fc"', [1, 17, 1, 19]) }
			]);
			assertLinterPackage('emoji outside the BMP', parser, 'f <- function() "😀"', 'non-ascii-code', [
				{ kind: 'string', characters: ['😀'], quickFix: fix('"\\U{1f600}"', [1, 17, 1, 20]) }
			]);
			assertLinterPackage('CJK characters', parser, 'f <- function() "中文"', 'non-ascii-code', [
				{ kind: 'string', characters: ['中', '文'], quickFix: fix('"\\u4e2d\\u6587"', [1, 17, 1, 20]) }
			]);
			assertLinterPackage('single quotes are kept in the fix', parser, "f <- function() 'é'", 'non-ascii-code', [
				{ kind: 'string', characters: ['é'], quickFix: fix("'\\u00e9'", [1, 17, 1, 19]) }
			]);
			assertLinterPackage('mixed ASCII and non-ASCII characters', parser, 'f <- function() "naïve text"', 'non-ascii-code', [
				{ kind: 'string', characters: ['ï'], quickFix: fix('"na\\u00efve text"', [1, 17, 1, 28]) }
			]);
			assertLinterPackage('distinct characters are listed once', parser, 'f <- function() "éé"', 'non-ascii-code', [
				{ kind: 'string', characters: ['é'] }
			]);
			assertLinterPackage('escaped quotes are kept in the fix', parser, 'f <- function() "\\"é\\""', 'non-ascii-code', [
				{ kind: 'string', characters: ['é'], quickFix: fix('"\\"\\u00e9\\""', [1, 17, 1, 23]) }
			]);
			assertLinterPackage('raw string gets no quick fix', parser, 'f <- function() r"(é)"', 'non-ascii-code', [
				{ kind: 'string', characters: ['é'], quickFix: undefined }
			]);
			assertLinterPackage('hash inside a string is no comment', parser, 'f <- function() "# é"', 'non-ascii-code', [
				{ kind: 'string', characters: ['é'] }
			]);
			assertLinterPackage('string as argument name is a symbol', parser, 'x <- c("ö" = 1)', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ö'] }
			]);
			assertLinterPackage('location of a string in a multi-line function', parser, 'f <- function() {\n  "ü"\n}', 'non-ascii-code', [
				{ loc: [2, 3, 2, 5, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('each string is reported', parser, 'x <- "ä"\ny <- "ö"', 'non-ascii-code', [
				{ kind: 'string', characters: ['ä'] }, { kind: 'string', characters: ['ö'] }
			]);
		});

		describe('symbols', () => {
			assertLinterPackage('umlaut in a symbol name', parser, 'café <- 1', 'non-ascii-code', [
				{ certainty: LintingResultCertainty.Certain, kind: 'symbol', characters: ['é'], loc: [1, 1, 1, 4, '/pkg/R/code.R'], message: 'Non-ASCII characters in symbol name (é), use ASCII only' }
			]);
			assertLinterPackage('backtick name', parser, '`naïve` <- 1', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ï'] }
			]);
			assertLinterPackage('function name', parser, 'fü <- function() 1', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ü'] }
			]);
			assertLinterPackage('call of a function with a non-ASCII name', parser, 'fü()', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ü'] }
			]);
			assertLinterPackage('function parameter name', parser, 'f <- function(ü) 1', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ü'] }
			]);
			assertLinterPackage('argument name of a call', parser, 'x <- list(é = 1)', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['é'] }
			]);
			assertLinterPackage('dollar access to a non-ASCII field', parser, 'x$é', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['é'] }
			]);
			assertLinterPackage('symbols with several non-ASCII characters', parser, 'ñáé <- 1', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['ñ', 'á', 'é'] }
			]);
		});

		describe('mixed', () => {
			assertLinterPackage('symbol and string in one line', parser, 'é <- "ü"', 'non-ascii-code', [
				{ kind: 'symbol', characters: ['é'] }, { kind: 'string', characters: ['ü'] }
			]);
		});

		describe('config', () => {
			assertLinterPackage('strings can be ignored', parser, 'f <- function() "ü"', 'non-ascii-code', [], { checkStrings: false });
			assertLinterPackage('symbols can be ignored', parser, 'café <- 1', 'non-ascii-code', [], { checkSymbols: false });
			assertLinterPackage('ignoring symbols keeps strings', parser, 'é <- "ü"', 'non-ascii-code', [
				{ kind: 'string', characters: ['ü'] }
			], { checkSymbols: false });
		});

		describe('NAMESPACE', () => {
			assertLinterPackage('non-ASCII export', parser, 'f <- 1', 'non-ascii-code', [{ kind: 'namespace', characters: ['ü'], loc: [2, 1, 2, 1, '/pkg/NAMESPACE'] }], { files: { NAMESPACE: 'export(f)\nexport(fü)\n' } });
			assertLinterPackage('one finding per line', parser, 'f <- 1', 'non-ascii-code', [{ kind: 'namespace', characters: ['é'] }, { kind: 'namespace', characters: ['ö'] }], { files: { NAMESPACE: 'export(é)\nexport(ö)\n' } });
			assertLinterPackage('comments are ignored', parser, 'f <- 1', 'non-ascii-code', [], { files: { NAMESPACE: '# café\nexport(f) # é\n' } });
			assertLinterPackage('ASCII NAMESPACE', parser, 'f <- 1', 'non-ascii-code', [], { files: { NAMESPACE: 'export(f)\n' } });
		});

		describe('no findings', () => {
			assertLinterPackage('non-ASCII only in a comment', parser, '# café\nf <- function() 1', 'non-ascii-code', []);
			assertLinterPackage('roxygen comment', parser, "#' Returns the café\nf <- function() 1", 'non-ascii-code', []);
			assertLinterPackage('trailing comment', parser, 'x <- 1 # é', 'non-ascii-code', []);
			assertLinterPackage('unicode escape already used', parser, 'f <- function() "\\u00e9"', 'non-ascii-code', []);
			assertLinterPackage('ASCII only code', parser, 'f <- function(x) "abc"', 'non-ascii-code', []);
			assertLinterPackage('test file is no package code', parser, 'x <- "ü"', 'non-ascii-code', [], { file: 'tests/testthat/test-a.R' });
			assertLinterPackage('inst file is no package code', parser, 'x <- "ü"', 'non-ascii-code', [], { file: 'inst/scripts/run.R' });
		});
	});
}));
