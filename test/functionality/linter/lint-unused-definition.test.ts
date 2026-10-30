import { assert, describe, test } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { guard } from '../../../src/util/assert';
import { SourceLocation, SourceRange } from '../../../src/util/range';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeLinterQuery } from '../../../src/queries/catalog/linter-query/linter-query-executor';

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
				/* a parameter may be an environment (a Shiny `output`), which a write changes for the caller as well */
				'server <- function(input, output) { output$plot <- input$x }\nshiny::shinyApp(NULL, server)',
				'e <- new.env()\nf <- function(x) { x$a <- 1 }\nf(e)',
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
				'`[.foo` <- function(x, i) { x[i] }',
				'as.character.foo <- function(x, ...) { x }',
				'Ops.foo <- function(e1, e2) { e1 + e2 }\nx <- structure(1, class = "foo")\nprint(x + 1)',
				'Math.foo <- function(x, ...) { x }\nx <- structure(1, class = "foo")\nprint(round(x, 2))',
				/* S3 method for a project-local generic that is dispatched somewhere - not unused */
				'myg <- function(x) UseMethod("myg")\nmyg.foo <- function(x) x\nz <- structure(1, class = "foo")\nmyg(z)',
				/* the caller fixes the signature of a function it is handed, removing `w` breaks the handler call */
				'res <- tryCatch(log(-1), warning = function(w) NA)\nprint(res)',
				'print(sapply(1:3, function(i) 0))',
				/* R package lifecycle hook called by package machinery - not unused */
				'.onAttach <- function(libname, pkgname) { cat(libname, pkgname) }',
				/* S4/S7 generic dispatcher passed to setGeneric - runs on every dispatch, so not unused */
				'setGeneric("replaceEntries", function(x, map, ...) standardGeneric("replaceEntries"))',
				/* same, with a braced dispatcher body */
				'setGeneric("bar", function(obj) { standardGeneric("bar") })'
			]) {
				assertLinter(program, parser, program, 'unused-definitions', []);
			}
			/* a package export (via NAMESPACE) is the public API and must not be reported even without a local caller */
			assertLinter('exported package function is not unused', parser,
				'arma <- function(x) { x + 1 }', 'unused-definitions', [], undefined,
				{ addFiles: [new FlowrInlineTextFile('NAMESPACE', 'export("arma")')] });
			test('a definition of a requested file is used through another file sourcing it', async() => {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
				analyzer.addFile(new FlowrInlineTextFile('lib.R', 'f <- function(x) x + 1'), new FlowrInlineTextFile('main.R', 'source("lib.R")\nz <- f(2)\nprint(z)'));
				analyzer.addRequest([{ request: 'file', content: 'lib.R' }, { request: 'file', content: 'main.R' }]);
				const result = await executeLinterQuery({ analyzer }, [{ type: 'linter', rules: ['unused-definitions'] }]);
				const unused = result.results['unused-definitions'];
				assert.ok(unused && 'results' in unused);
				assert.deepStrictEqual(unused.results, []);
			});
		});
		describe('With unused definitions', () => {
			for(const [program, criteria, removableRange] of [
				['x <- 2', '1@x', SourceRange.from(1, 1, 1, 6)],
				['x <- 2\nx <- 1\nprint(x)', '1@x', SourceRange.from(1, 1, 1, 6)],
				['x <- 1\ny <- 2\nprint(x + 1)',   '2@y', SourceRange.from(2, 1, 2, 6)],
				['x <- 4\ny <- foo(42)\nprint(y)', '1@x', SourceRange.from(1, 1, 1, 6)],
				['for(i in 1:10) 42;', '1@i', undefined],
				['f <- function(x) { x + 1 }\nprint(2)', '1@f', SourceRange.from(1, 1, 1, 26)], // ;1@function is included in f
				/* the super-assignment is the value `f` returns, so removing it changes what `f(2)` gives */
				['f <- function(v) { x <<- v * 2 }\nf(2)', '1@x', undefined],
				['function() { 42 }', '1@function', SourceRange.from(1, 1, 1, 17)],
				/* the inner function is not what `f` returns, so nothing reads or prints it */
				['f <- function() {\n function() { 42 }\n 1 }\nprint(f())', '2@function', SourceRange.from(2, 2, 2, 18)],
				['f <- function(i) { tmp <- i * 2 }\nprint(f(2))', '1@tmp', undefined],
				/* every call hands over a number, which is no environment, so the write is lost */
				['f <- function(x) { x$a <- 1 }\nf(3)', '1:20', undefined],
				['f <- function(v) { x <<- v * 2; 1 }\nf(2)', '1@x', SourceRange.from(1, 20, 1, 30)],
				['f <- function(i) { tmp <- i * 2; 1 }\nprint(f(2))', '1@tmp', SourceRange.from(1, 20, 1, 31)],
				['res <- tryCatch(log(-1), warning = function(w) { z <- 1; NA })\nprint(res)', '1@z', SourceRange.from(1, 50, 1, 55)],
				[`f <- function() {
   x <- 42
   function() {
      x <<- 2
   }
}

print(f()())`, '4@x', undefined]
			] as const satisfies readonly [string, string, SourceRange | undefined][]) {
				assertLinter(program, parser, program, 'unused-definitions', (df, ast) => {
					const ids = SlicingCriterion.decodeAll(criteria.split(';') as SlicingCriteria, ast.idMap);
					return ids.map(({ id }) => {
						const node = ast.idMap.get(id);
						guard(node !== undefined, `Expected node for id ${id} to be defined, but got undefined`);
						return {
							certainty:    LintingResultCertainty.Uncertain,
							variableName: node.lexeme,
							loc:          SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
							quickFix:     removableRange ? [{
								type:        'remove',
								loc:         removableRange,
								description: `Remove unused definition of \`${node.lexeme}\``
							}] : undefined
						};
					});
				});
			}
		});

		describe('a definition whose value came from a side effect', () => {
			assertLinter('call with a super-assignment offers no fix', parser,
				'counter <- 0\nbump <- function() { counter <<- counter + 1; counter }\nr <- bump()\nprint(counter)',
				'unused-definitions',
				[{ certainty: LintingResultCertainty.Uncertain, variableName: 'r', loc: [3, 1, 3, 1], quickFix: undefined }],
				{ totalConsidered: 5 });
		});

		describe('a definition nested inside a larger expression', () => {
			for(const value of ['runif(1)', '(runif(1))', '{ runif(1) }']) {
				assertLinter(`a draw in ${value} keeps its effect on the seed`, parser, `u <- ${value}\nprint(1)`, 'unused-definitions',
					[{ certainty: LintingResultCertainty.Uncertain, variableName: 'u', loc: [1, 1, 1, 1], quickFix: undefined }]);
			}
			assertLinter('a closure made in local reads the scope of local', parser, 'local({\nk <- 10\nfs <- list(a = function(x) x + k)\nr <- sapply(fs, function(f) f(2))\nprint(r)\n})', 'unused-definitions', []);
			assertLinter('a function handed on by parentheses is the value of its variable', parser, 'f <- (function() 1)\nr <- f\nprint(r)', 'unused-definitions', []);
			assertLinter('a closure made and called through do.call is used', parser, 'adder <- function(n) function(x) x + n\nadd2 <- do.call(adder, list(2))\nr <- do.call(add2, list(5))\nprint(r)', 'unused-definitions', []);
			assertLinter('do.call is as pure as what it calls', parser, 'df2 <- do.call(setNames, list(1, "A"))\nprint(1)', 'unused-definitions',
				[{ certainty: LintingResultCertainty.Uncertain, variableName: 'df2', loc: [1, 1, 1, 3], quickFix: [{ type: 'remove', loc: [1, 1, 1, 38], description: 'Remove unused definition of `df2`' }] }]);
			assertLinter('do.call of a draw keeps its effect on the seed', parser, 'u <- do.call(runif, list(1))\nprint(1)', 'unused-definitions',
				[{ certainty: LintingResultCertainty.Uncertain, variableName: 'u', loc: [1, 1, 1, 1], quickFix: undefined }]);
			assertLinter('assign is removed as the assignment it is', parser,
				'assign("k", 5)\nk <- 9\nprint(k)',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'k',
					loc:          [1, 8, 1, 10],
					quickFix:     [{ type: 'remove', loc: [1, 1, 1, 14], description: 'Remove unused definition of `k`' }]
				}]);
			assertLinter('assignment nested in a call argument keeps its value', parser,
				'`my var` <- 1\n`my var` + 1\nprint(x <- get("my var"))',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'x',
					loc:          [3, 7, 3, 7],
					quickFix:     [{ type: 'replace', loc: [3, 7, 3, 24], replacement: 'get("my var")', description: 'Remove unused definition of `x`' }]
				}]);

			assertLinter('assignment as a function argument keeps its value', parser,
				'foo(x <- 1)',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'x',
					loc:          [1, 5, 1, 5],
					quickFix:     [{ type: 'replace', loc: [1, 5, 1, 10], replacement: '1', description: 'Remove unused definition of `x`' }]
				}]);

			assertLinter('assignment in an if-condition keeps its value', parser,
				'if((x <- 1) > 0) { 42 }',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'x',
					loc:          [1, 5, 1, 5],
					quickFix:     [{ type: 'replace', loc: [1, 5, 1, 10], replacement: '1', description: 'Remove unused definition of `x`' }]
				}]);

			assertLinter('assignment on the right of another assignment keeps its value', parser,
				'y <- (x <- 1)\nprint(y)',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'x',
					loc:          [1, 7, 1, 7],
					quickFix:     [{ type: 'replace', loc: [1, 7, 1, 12], replacement: '1', description: 'Remove unused definition of `x`' }]
				}]);

			assertLinter('assignment as the sole statement of a block is still fully removed', parser,
				'{\n x <- 1\n}',
				'unused-definitions',
				[{
					certainty:    LintingResultCertainty.Uncertain,
					variableName: 'x',
					loc:          [2, 2, 2, 2],
					quickFix:     [{ type: 'remove', loc: [2, 2, 2, 7], description: 'Remove unused definition of `x`' }]
				}]);
		});
	});
}));
