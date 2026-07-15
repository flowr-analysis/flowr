import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { guard } from '../../../src/util/assert';
import { SourceLocation, SourceRange } from '../../../src/util/range';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

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
				/* the super-assigned x escapes transitively (g calls f) and is then used - not unused thanks to transitive side-effect propagation */
				'f <- function() { x <<- 1 }\ng <- function() { f() }\ng()\nprint(x)',
				/* x is read back through the global env (globalenv()/.GlobalEnv point into the search-path stack) - so it is used, not unused */
				'x <- 1\n.GlobalEnv$x',
				'x <- 1\nglobalenv()$x',
				'(function() { x <- 42; print(x) })()',
				'f <- function() {\n function() { 42 } }\nprint(f()())',
				'x <- list()\nx$a <- 2\nprint(x)',
				'x <- new.env()\nx$a <- 2\nprint(x)',
				/* the first `x <- 42` is *not* unused as it serves as an anchor for the global redefinition within the nested function! */
				`f <- function() {
   x <- 42
   function() {
      x <<- 2
   }
}

print(f()())
print(x)`,
				/* the dots parameter must never be reported as an unused definition */
				'f <- function(x, ...) { x }\nprint(f(1))',
				/* S3 method for a known base generic - dispatched indirectly, so not unused */
				'print.foo <- function(x, ...) { cat(x) }\ny <- structure(list(), class = "foo")\nprint(y)',
				/* S3 method for a project-local generic that is dispatched somewhere - not unused */
				'myg <- function(x) UseMethod("myg")\nmyg.foo <- function(x) x\nz <- structure(1, class = "foo")\nmyg(z)',
				/* R package lifecycle hook called by package machinery - not unused */
				'.onAttach <- function(libname, pkgname) { cat(libname, pkgname) }'
			]) {
				/* @ignore-in-wiki */
				assertLinter(program, parser, program, 'unused-definitions', []);
			}
			/* a package export (via NAMESPACE) is the public API and must not be reported even without a local caller */
			assertLinter('exported package function is not unused', parser,
				'arma <- function(x) { x + 1 }', 'unused-definitions', [], undefined,
				{ addFiles: [new FlowrInlineTextFile('NAMESPACE', 'export("arma")')] });
		});
		describe('With unused definitions', () => {
			for(const [program, criteria, removableRange] of [
				['x <- 2', '1@x', SourceRange.from(1, 1, 1, 6)],
				['x <- 2\nx <- 1\nprint(x)', '1@x', SourceRange.from(1, 1, 1, 6)],
				['x <- 1\ny <- 2\nprint(x + 1)',   '2@y', SourceRange.from(2, 1, 2, 6)],
				['x <- 4\ny <- foo(42)\nprint(y)', '1@x', SourceRange.from(1, 1, 1, 6)],
				['for(i in 1:10) 42;', '1@i', undefined],
				['f <- function(x) { x + 1 }\nprint(2)', '1@f', SourceRange.from(1, 1, 1, 26)], // ;1@function is included in f
				['f <- function(v) { x <<- v * 2 }\nf(2)', '1@x', SourceRange.from(1, 20, 1, 30)],
				['function() { 42 }', '1@function', SourceRange.from(1, 1, 1, 17)],
				['f <- function() {\n function() { 42 } }\nprint(f())', '2@function', SourceRange.from(2, 2, 2, 18)],
				[`f <- function() {
   x <- 42
   function() {
      x <<- 2
   }
}

print(f()())`, '4@x', SourceRange.from(4, 7, 4, 13)]
			] as const satisfies readonly [string, string, SourceRange | undefined][]) {
				/* @ignore-in-wiki */
				assertLinter(program, parser, program, 'unused-definitions', (df, ast) => {
					const ids = SlicingCriteria.decodeAll(criteria.split(';') as SlicingCriteria, ast.idMap);
					return ids.map(({ id }) => {
						const node = ast.idMap.get(id);
						guard(node !== undefined, `Expected node for id ${id} to be defined, but got undefined`);
						return {
							certainty:    LintingResultCertainty.Uncertain,
							variableName: node.lexeme,
							loc:          SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
							quickFix:     removableRange ? [{
								type:        'remove',
								loc:         removableRange as SourceLocation,
								description: `Remove unused definition of \`${node.lexeme}\``
							}] : undefined
						};
					});
				});
			}
		});

	});
}));
