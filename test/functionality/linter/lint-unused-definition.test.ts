import { describe } from 'vitest';


import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { convertAllSlicingCriteriaToIds } from '../../../src/slicing/criterion/parse';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { guard } from '../../../src/util/assert';
import type { SourceRange } from '../../../src/util/range';
import { rangeFrom } from '../../../src/util/range';

describe('flowR linter', withTreeSitter(parser => {
	describe('unused definitions', () => {
		describe('No unused definitions', () => {
			for(const program of [
				'foo',
				'x <- 2\nprint(x)',
				'x <- 1\ny <- 2\nprint(x + y)',
				'x <- 4\ny <- foo(x)\nprint(y)',
				'for(i in 1:10) i;',
				'for(i in 1:10) { 42 }; print(i)',
				'f <- function(x) { x + 1 }\nprint(f(2))',
				'f <- function(v) { x <<- v * 2 }\nf(2)\nprint(x)',
				'(function() { x <- 42; print(x) })()',
				'f <- function() {\n function() { 42 } }\nprint(f()())',
			]) {
				/* @ignore-in-wiki */
				assertLinter(program, parser, program, 'unused-definitions', []);
			}
		});
		describe('With unused definitions', () => {
			for(const [program, criteria, removableRange] of [
				['x <- 2', '1@x', rangeFrom(1, 1, 1, 6)],
				['x <- 2\nx <- 1\nprint(x)', '1@x', rangeFrom(1, 1, 1, 6)],
				['x <- 1\ny <- 2\nprint(x + 1)',   '2@y', rangeFrom(2, 1, 2, 6)],
				['x <- 4\ny <- foo(42)\nprint(y)', '1@x', rangeFrom(1, 1, 1, 6)],
				['for(i in 1:10) 42;', '1@i', undefined],
				['f <- function(x) { x + 1 }\nprint(2)', '1@f', rangeFrom(1, 1, 1, 26)], // ;1@function is included in f
				['f <- function(v) { x <<- v * 2 }\nf(2)', '1@x', rangeFrom(1, 20, 1, 30)],
				['function() { 42 }', '1@function', rangeFrom(1, 1, 1, 17)],
				['f <- function() {\n function() { 42 } }\nprint(f())', '2@function', rangeFrom(2, 2, 2, 18)]
			] as const satisfies readonly [string, string, SourceRange | undefined][]) {
				/* @ignore-in-wiki */
				assertLinter(program, parser, program, 'unused-definitions', (df, ast) => {
					const ids = convertAllSlicingCriteriaToIds(criteria.split(';') as SlicingCriteria, ast.idMap);
					return ids.map(({ id }) => {
						const node = ast.idMap.get(id);
						guard(node !== undefined, `Expected node for id ${id} to be defined, but got undefined`);
						return {
							certainty:    LintingResultCertainty.Uncertain,
							variableName: node.lexeme,
							range:        node.info.fullRange ?? node.location ?? rangeFrom(-1, -1, -1, -1),
							quickFix:     removableRange ? [{
								type:        'remove',
								range:       removableRange,
								description: `Remove unused definition of \`${node.lexeme}\``
							}] : undefined
						};
					});
				});
			}
		});

	});
}));
