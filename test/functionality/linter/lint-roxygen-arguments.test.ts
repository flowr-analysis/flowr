import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('roxygen arguments', () => {
		assertLinter('More @param documented than implemented', parser, '#\' This is a function.\n#\' An interesting function.\n#\' @param a some variable\n#\' @param b does not exist\nf = function(a){return a;}', 'roxygen-arguments', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(5, 5, 5, 26)
			}
		]);
		assertLinter('Less @param documented than implemented', parser, '#\' This is a function.\n#\' An interesting function.\n#\' @param a some variable\nf = function(a, b){return a;}', 'roxygen-arguments', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(4, 5, 4, 29)
			}
		]);
		assertLinter('Same @param documented as implemented', parser, '#\' This is a function.\n#\' An interesting function.\n#\' @param a some variable\n#\' @param b does exist\nf = function(a,b){return a;}', 'roxygen-arguments', []);
		assertLinter('Parameterized function, not commented', parser, 'f = function(a){return a;}', 'roxygen-arguments', []);
		assertLinter('Unparameterized function, not commented', parser, 'f = function(){return 42;}', 'roxygen-arguments', []);
		assertLinter('Different @param documented than implemented', parser, '#\' @param a some variable\nf = function(b){return b;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(2, 5, 2, 26),
				overDocumented:  ['a'],
				underDocumented: ['b']
			}
		]);
		assertLinter('@param documented, but function not parameterized', parser, '#\' @param a some variable\nf = function(){return 42;}', 'roxygen-arguments', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(2, 5, 2, 26)
			}
		]);
		assertLinter('Parameterized function, @param not documented', parser, '#\' Just a comment\nf = function(a){return 42;}', 'roxygen-arguments', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       SourceRange.from(2, 5, 2, 27)
			}
		]);
		assertLinter('Unparameterized function, no @param documented', parser, '#\' This is a function\nf = function(){return 42;}', 'roxygen-arguments', []);
	});
}));