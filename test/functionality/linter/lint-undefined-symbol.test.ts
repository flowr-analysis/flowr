import { describe } from 'vitest';
import { assumeLoadedPackages, withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb, assertLintedLines, assertLinterFields } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DepType } from '../../../src/project/sigdb/schema';
import { decorateLabelContext, label } from '../_helper/label';

assumeLoadedPackages('dplyr', 'ggplot2', 'magrittr');

/** base package exports the tests rely on (base R is resolved through the package database) */
const baseSigDb = controlledSigDb({
	base:  ['double', 'length', 'sum', 'format', 'match.arg', 'colnames', 'deparse', 'NCOL', 'optimize'],
	stats: ['sd'],
	utils: ['person', 'bibentry']
});

describe('flowR linter', withTreeSitter(parser => {
	describe('undefined symbol', () => {
		describe('function calls', () => {
			assertLinter('undefined function is flagged', parser, 'foo()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'foo', kind: 'function', loc: [1, 1, 1, 5] }]);

			assertLinter('locally defined function is not flagged', parser, 'foo <- function() 1\nfoo()',
				'undefined-symbol', []);

			assertLinter('builtin is not flagged', parser, 'print("hi")\nc(1, 2)',
				'undefined-symbol', []);

			assertLinter('only the undefined call is flagged', parser, 'g <- function() 1\ng()\nh()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'h', kind: 'function', loc: [3, 1, 3, 3] }]);

			// an unresolved library could export any bare name, so nothing is guessed
			assertLinter('not flagged when an unknown library is loaded', parser, 'library(somePkg)\nfoo()', 'undefined-symbol', []);
			assertLinter('a data set of datasets is defined', parser, 'summary(iris)\nhead(mtcars)', 'undefined-symbol', []);
			assertLinter('a namespaced name is still checked', parser, 'library(somePkg)\nfoo()\nbase::fooo()', 'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'fooo', kind: 'function', loc: [3, 1, 3, 12] }]);
		});

		describe('base R packages resolve via the package database', () => {
			assertLinter('default-attached base functions are not flagged', parser,
				'sd(x)\nformat(y)\nmatch.arg(z)\ncolnames(m)\ndeparse(q)\nperson("a")\nbibentry()\nNCOL(d)',
				'undefined-symbol', [], undefined, { sigDb: baseSigDb, checkVariables: false });

			assertLinter('namespace-qualified base function is not flagged', parser, 'stats::sd(x)',
				'undefined-symbol', [], undefined, { sigDb: baseSigDb, checkVariables: false });

			assertLinter('namespace-qualified base function is not flagged', parser, 'stats::sd',
				'undefined-symbol', [], undefined, { sigDb: baseSigDb, checkVariables: true });

			// primitives/internals (`is.na`) and base data constants (`.Machine`) are absent from the sigdb
			// export list but must still be recognised as defined base-R names (both calls and variable reads)
			assertLinter('base primitives and constants are not flagged', parser,
				'x <- 1\nis.na(x)\nis.finite(x)\ntcrossprod(x)\nunclass(x)\nrange(x)\ncumsum(x)\ny <- .Machine$double.eps',
				'undefined-symbol', [], undefined, { sigDb: baseSigDb });

			// parallel is base-priority but not attached by default -> flagged, with a hint from the database
			assertLinter('non-attached base package function is flagged with a hint', parser, 'mclapply(x, f)',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'mclapply', kind: 'function', loc: [1, 1, 1, 14], availableInPackages: ['parallel'] }],
				undefined, { sigDb: controlledSigDb('parallel', ['mclapply']), checkVariables: false });
		});

		describe('attached packages', () => {
			assertLinter('an export named like a primitive keeps its semantics', parser, 'library(lubridate)\nd <- data.frame(a = 1)\nprint(d$a)',
				'undefined-symbol', [], undefined, { sigDb: controlledSigDb({ lubridate: ['$', 'ymd'] }) });
			assertLinter('a namespaced read may be lazy data the database does not record', parser, 'x <- MASS::birthwt',
				'undefined-symbol', [], undefined, { sigDb: controlledSigDb({ MASS: ['lda'] }) });
			assertLinter('a name the package may re-export from its imports', parser, 'library(dplyr)\nas_tibble(data.frame(a = 1))',
				'undefined-symbol', [], undefined, { sigDb: { ...controlledSigDb({ dplyr: ['mutate'], tibble: ['as_tibble'] }), dependencies: (pkg: string) => pkg === 'dplyr' ? [{ name: 'tibble', type: DepType.Imports }] : undefined } });
			assertLinter('a name neither the package nor its imports export is flagged', parser, 'library(dplyr)\nnot_in_dplyr(data.frame(a = 1))',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'not_in_dplyr', kind: 'function', loc: [2, 1, 2, 31] }], undefined, { sigDb: { ...controlledSigDb({ dplyr: ['mutate'], tibble: ['as_tibble'] }), dependencies: (pkg: string) => pkg === 'dplyr' ? [{ name: 'tibble', type: DepType.Imports }] : undefined } });
		});

		describe('package hints from the database', () => {
			assertLinter('suggests loading a package that exports the symbol', parser, 'ggahh()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'ggahh', kind: 'function', loc: [1, 1, 1, 7], availableInPackages: ['ggPkg'] }],
				undefined, { sigDb: controlledSigDb('ggPkg', ['ggahh']) });

			// a loaded package's (dotted) export resolves, but a typo is still flagged
			assertLinter('resolves a loaded dotted export yet still flags a typo', parser,
				'library(quadprog)\nsolve.QP(a, b)\nsol.QP(a, b)',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'sol.QP', kind: 'function', loc: [3, 1, 3, 12] }],
				undefined, { sigDb: controlledSigDb('quadprog', ['solve.QP']), checkVariables: false });
		});

		describe('implicit test-framework imports', () => {
			// a test file runs under its framework's attached namespace, so its exports need no explicit library() there
			assertLinter('a testthat export is not flagged inside a test file', parser, 'expect_equal(1, 1)',
				'undefined-symbol', [], undefined,
				{ sigDb: controlledSigDb('testthat', ['expect_equal']), checkVariables: false, useAsFilePath: 'tests/testthat/test-x.R' });

			// the same call outside a test file has no attached framework, so it is still flagged (with a hint)
			assertLinter('the same testthat export is flagged outside a test file', parser, 'expect_equal(1, 1)',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'expect_equal', kind: 'function', loc: [1, 1, 1, 18], availableInPackages: ['testthat'] }],
				undefined, { sigDb: controlledSigDb('testthat', ['expect_equal']), checkVariables: false });
		});

		describe('variables', () => {
			for(const load of ['data(rat)', 'data("rat")', 'data(list = "rat")']) {
				assertLinter(`${load} defines the data set`, parser, `${load}\nprint(rat)`, 'undefined-symbol', []);
				assertLinter(`${load} defines no other data set`, parser, `${load}\nprint(mouse)`, 'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'mouse', kind: 'variable', loc: [2, 7, 2, 11] }]);
			}
			assertLinter('undefined variable read is flagged (checked by default)', parser, 'f <- function() undefinedVar',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedVar', kind: 'variable', loc: [1, 17, 1, 28] }]);
			assertLinter('a read before the write in the same frame is flagged', parser, 'f <- function() { print(v); v <- 1 }',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'v', kind: 'variable', loc: [1, 25, 1, 25] }]);

			assertLinter('variable checking can be disabled', parser, 'f <- function() undefinedVar',
				'undefined-symbol', [], undefined, { checkVariables: false });

			assertLinter('parameters and locals are not flagged', parser, 'f <- function(a, b) { c <- a + b\n  c }',
				'undefined-symbol', []);

			assertLinter('builtin constants are not flagged', parser, 'print(pi)\nprint(T)\nprint(LETTERS)',
				'undefined-symbol', []);

			// quoting (non-standard evaluation) is recognised via flowR's dataflow
			assertLinter('quoted symbols are not flagged', parser, 'quote(someSymbol)\nsubstitute(other)',
				'undefined-symbol', []);

			// a loop marks its body as nse too, but the body is evaluated, so its symbols are ordinary reads
			assertLinter('a braceless for-loop body is still flagged', parser, 'for(i in 1:2) undefinedVar',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedVar', kind: 'variable', loc: [1, 15, 1, 26] }]);

			assertLinter('a braceless while-loop body is still flagged', parser, 'while(TRUE) undefinedVar',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedVar', kind: 'variable', loc: [1, 13, 1, 24] }]);

			assertLinter('a braceless repeat body is still flagged', parser, 'repeat undefinedVar',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedVar', kind: 'variable', loc: [1, 8, 1, 19] }]);

			assertLinter('a quotation within a loop body is still not flagged', parser, 'for(i in 1:2) quote(someSymbol)',
				'undefined-symbol', []);

			// recall: a variable defined nowhere is still flagged even next to a defined one
			assertLinter('a variable defined nowhere is still flagged', parser,
				'f <- function() {\n  known <- 1\n  known + reallyUndefined\n}',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'reallyUndefined', kind: 'variable', loc: [3, 11, 3, 25] }]);

			// the scope fallback is *scoped*: a binding in a sibling function does not resolve here
			assertLinter('a binding from a sibling scope does not suppress the use', parser,
				'f <- function() { onlyInF <- 1 }\ng <- function() onlyInF',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'onlyInF', kind: 'variable', loc: [2, 17, 2, 23] }]);

			// the enclosing-scope fallback (only unconditional bindings suppress) is unit-tested directly in
			// undefined-symbol-util.test.ts, since minimal end-to-end snippets are resolved before reaching it
		});

		// these are recognised via flowR's dataflow (NonStandardEvaluation edges from the builtin config)
		describe('non-standard evaluation is not flagged', () => {
			assertLinter('formula operands', parser, 'y ~ x + z',
				'undefined-symbol', [], undefined, { checkVariables: true });

			assertLinter('subset data-masked columns', parser, 'd <- data.frame()\nsubset(d, col > 1)',
				'undefined-symbol', [], undefined, { checkVariables: true });

			assertLinter('with data-masked columns', parser, 'd <- data.frame()\nwith(d, aa + bb)',
				'undefined-symbol', [], undefined, { checkVariables: true });

			assertLinter('quoted symbols', parser, 'quote(someSymbol)\nsubstitute(other)',
				'undefined-symbol', [], undefined, { checkVariables: true });

			assertLinter('dplyr / tidyr data-masked columns', parser, 'd <- data.frame()\nmutate(d, z = revenue * 2)\nselect(d, id, name)',
				'undefined-symbol', [], undefined, { checkVariables: true });

			assertLinter('ggplot aes columns', parser, 'd <- data.frame()\nggplot(d, aes(x = revenue, y = cost))',
				'undefined-symbol', [], undefined, { checkVariables: true });

			// piped data-masking: the data is injected by `%>%`/`|>`, so all explicit args are columns
			assertLinter('piped dplyr columns', parser, 'd <- data.frame()\nd %>% filter(cost > 1) %>% mutate(z = revenue) %>% select(id)',
				'undefined-symbol', [], undefined, { checkVariables: true });

			// `data.table`'s `DT[i, j, by]` masks subscript symbols; muted by default (indistinguishable from indexing)
			assertLinter('data.table subscript columns are muted', parser, 'dt <- data.frame()\ndt[revenue > 1, sum(sales), by = grp]',
				'undefined-symbol', []);

			// ... but the accessed object itself is still checked, and `checkSubscripts` re-enables subscripts
			assertLinter('the accessed object is still flagged', parser, 'undefinedDT[, 1]',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedDT', kind: 'variable', loc: [1, 1, 1, 11] }]);

			assertLinter('subscript checking can be enabled', parser, 'dt <- data.frame()\ndt[, sales]',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'sales', kind: 'variable', loc: [2, 6, 2, 10] }],
				undefined, { checkSubscripts: true });
		});

		describe('inst/ resource files are treated separately', () => {
			assertLinter('undefined call in an inst/ file is not flagged', parser, 'notARealFunction()',
				'undefined-symbol', [], undefined, { useAsFilePath: 'inst/REFERENCES.R' });

			assertLinter('the same call in an R/ file is flagged', parser, 'notARealFunction()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'notARealFunction', kind: 'function', loc: [1, 1, 1, 18, 'R/foo.R'] }],
				undefined, { useAsFilePath: 'R/foo.R' });
		});
	});
	describe('counterexamples', () => {
		/* R: data("rat") and data(list = "rat") define rat just like data(rat) */
		assertLinterFields(parser, 'data("rat")\nprint(rat)', 'undefined-symbol', [], ['data/rat.R'], []);
		assertLinterFields(parser, 'data(list = "rat")\nprint(rat)', 'undefined-symbol', [], ['data/rat.R'], []);
		assertLintedLines(decorateLabelContext(label('io: iris is a data set of datasets', ['name-normal', 'function-calls']), ['dataflow']), parser, 'write.csv(iris, "data.csv")\ndf <- read.csv("data.csv")', 'undefined-symbol', []);
	});
}));
