import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('syntactically-valid', () => {
		assertLinter('valid code has no syntax errors', parser, 'x <- c(1, 2)\nprint(x)',
			'syntactically-valid',
			[],
			{ parser: 'tree-sitter', errors: 0, fixable: 0 }
		);

		assertLinter('missing closing parenthesis', parser, 'x <- c(1, 2',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'missing',
				message:   'Missing `)`',
				loc:       [1, 12, 1, 11],
				quickFix:  [{ type: 'replace', loc: [1, 12, 1, 11], description: 'Insert missing `)`', replacement: ')' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		assertLinter('unbalanced brace', parser, '{ 1',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `{ 1`',
				loc:       [1, 1, 1, 3],
				quickFix:  [{ type: 'replace', loc: [1, 4, 1, 3], description: 'Add missing closing `}`', replacement: '}' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		assertLinter('dangling assignment operator', parser, 'x <-',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'missing',
				message:   'Missing `identifier`',
				loc:       [1, 5, 1, 4],
				quickFix:  [{ type: 'remove', loc: [1, 3, 1, 4], description: 'Remove the dangling `<-`' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// preferFix flips the direction: with `add`, the same error offers the NULL placeholder instead of the removal
		assertLinter('dangling operator prefers the add direction when configured', parser, 'x <-',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'missing',
				message:   'Missing `identifier`',
				loc:       [1, 5, 1, 4],
				quickFix:  [{ type: 'replace', loc: [1, 5, 1, 4], description: 'Insert placeholder `NULL`', replacement: ' NULL' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 },
			{ preferFix: 'add' }
		);

		assertLinter('fuzzy-completes an unfinished operator', parser, 'a %in b',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `%in b`',
				loc:       [1, 3, 1, 7],
				quickFix:  [{ type: 'replace', loc: [1, 3, 1, 5], description: 'Complete operator to `%in%`', replacement: '%in%' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// an unfinished pipe must not complete to `%%`, which parses but silently means modulo
		/* @ignore-in-wiki */
		assertLinter('completes an unfinished pipe', parser, 'a %> b',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `%> b`',
				loc:       [1, 3, 1, 6],
				quickFix:  [{ type: 'replace', loc: [1, 3, 1, 4], description: 'Complete operator to `%>%`', replacement: '%>%' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// what a word processor or a PDF leaves behind
		assertLinter('typographic quotes', parser, 'x <- “hi”',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `“`',
				loc:       [1, 6, 1, 6],
				quickFix:  [{ type: 'replace', loc: [1, 6, 1, 6], description: 'Replace the typographic quote with a straight one', replacement: '"' }]
			}, {
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `”`',
				loc:       [1, 9, 1, 9],
				quickFix:  [{ type: 'replace', loc: [1, 9, 1, 9], description: 'Replace the typographic quote with a straight one', replacement: '"' }]
			}],
			{ parser: 'tree-sitter', errors: 2, fixable: 2 }
		);

		// a stray token no other pattern can repair falls back to commenting it out
		assertLinter('comment-out fallback for a stray token', parser, ',',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `,`',
				loc:       [1, 1, 1, 1],
				quickFix:  [{ type: 'replace', loc: [1, 1, 1, 1], description: 'Comment out the offending code', replacement: '# ,' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// disabling the only applicable pattern leaves the error reported but without a quick-fix
		assertLinter('disabling a fix drops its suggestion', parser, ',',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `,`',
				loc:       [1, 1, 1, 1],
				quickFix:  undefined
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 0 },
			{ disabledFixes: ['comment-out'] }
		);

		// a copy that stopped short of the opening bracket leaves closers that close nothing
		assertLinter('stray closing parenthesis', parser, 'x <- c(1, 2))',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `)`',
				loc:       [1, 13, 1, 13],
				quickFix:  [{ type: 'remove', loc: [1, 13, 1, 13], description: 'Remove the stray `)`' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		/* @ignore-in-wiki */
		assertLinter('stray closers spanning lines', parser, 'c(1,2))\n]',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `) ]`',
				loc:       [1, 7, 2, 1],
				quickFix:  [{ type: 'remove', loc: [1, 7, 2, 1], description: 'Remove the stray `)]`' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// lines copied out of the REPL keep their prompt
		assertLinter('copied REPL prompt', parser, '> x <- 1',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `>`',
				loc:       [1, 1, 1, 1],
				quickFix:  [{ type: 'remove', loc: [1, 1, 1, 1], description: 'Remove the copied `>` prompt' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		/* @ignore-in-wiki */
		assertLinter('a leading `>=` is not a prompt', parser, '>= 3',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `>=`',
				loc:       [1, 1, 1, 2],
				quickFix:  [{ type: 'replace', loc: [1, 1, 1, 2], description: 'Comment out the offending code', replacement: '# >=' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);

		// printed results pasted back into the script: the whole line is missing its `#`
		assertLinter('pasted console output', parser, '[1] 1 2 3',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `[`',
				loc:       [1, 1, 1, 1],
				quickFix:  [{ type: 'replace', loc: [1, 1, 1, 0], description: 'Comment out the pasted console output', replacement: '# ' }]
			}, {
				certainty: LintingResultCertainty.Certain,
				kind:      'error',
				message:   'Unexpected `]`',
				loc:       [1, 3, 1, 3],
				quickFix:  [{ type: 'replace', loc: [1, 1, 1, 0], description: 'Comment out the pasted console output', replacement: '# ' }]
			}],
			{ parser: 'tree-sitter', errors: 2, fixable: 2 }
		);

		/* @ignore-in-wiki */
		assertLinter('an indexing line is not console output', parser, 'x[1] <- 2',
			'syntactically-valid',
			[],
			{ parser: 'tree-sitter', errors: 0, fixable: 0 }
		);

		/* @ignore-in-wiki */
		assertLinter('unterminated string', parser, 'x <- "abc',
			'syntactically-valid',
			[{
				certainty: LintingResultCertainty.Certain,
				kind:      'missing',
				message:   'Missing `"`',
				loc:       [1, 10, 1, 9],
				quickFix:  [{ type: 'replace', loc: [1, 10, 1, 9], description: 'Insert missing `"`', replacement: '"' }]
			}],
			{ parser: 'tree-sitter', errors: 1, fixable: 1 }
		);
	});
}));
