import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledPkgDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/** base package exports the tests rely on (base R is resolved through the package database) */
const basePkgDb = controlledPkgDb({
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

			// an unresolved library could export the symbol, so the finding is kept but marked low-confidence
			assertLinter('flagged low-confidence when an unknown library is loaded', parser, 'library(somePkg)\nfoo()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'foo', kind: 'function', loc: [2, 1, 2, 5], mayBeProvidedByUnresolvedLibrary: true }]);
		});

		describe('base R packages resolve via the package database', () => {
			assertLinter('default-attached base functions are not flagged', parser,
				'sd(x)\nformat(y)\nmatch.arg(z)\ncolnames(m)\ndeparse(q)\nperson("a")\nbibentry()\nNCOL(d)',
				'undefined-symbol', [], undefined, { pkgDb: basePkgDb, checkVariables: false });

			assertLinter('namespace-qualified base function is not flagged', parser, 'stats::sd(x)',
				'undefined-symbol', [], undefined, { pkgDb: basePkgDb, checkVariables: false });

			// parallel is base-priority but not attached by default -> flagged, with a hint from the database
			assertLinter('non-attached base package function is flagged with a hint', parser, 'mclapply(x, f)',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'mclapply', kind: 'function', loc: [1, 1, 1, 14], availableInPackages: ['parallel'] }],
				undefined, { pkgDb: controlledPkgDb('parallel', ['mclapply']), checkVariables: false });
		});

		describe('package hints from the database', () => {
			assertLinter('suggests loading a package that exports the symbol', parser, 'ggahh()',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'ggahh', kind: 'function', loc: [1, 1, 1, 7], availableInPackages: ['ggPkg'] }],
				undefined, { pkgDb: controlledPkgDb('ggPkg', ['ggahh']) });

			// a loaded package's (dotted) export resolves, but a typo is still flagged
			assertLinter('resolves a loaded dotted export yet still flags a typo', parser,
				'library(quadprog)\nsolve.QP(a, b)\nsol.QP(a, b)',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'sol.QP', kind: 'function', loc: [3, 1, 3, 12] }],
				undefined, { pkgDb: controlledPkgDb('quadprog', ['solve.QP']), checkVariables: false });
		});

		describe('variables', () => {
			assertLinter('undefined variable read is flagged (checked by default)', parser, 'f <- function() undefinedVar',
				'undefined-symbol', [{ certainty: LintingResultCertainty.Uncertain, name: 'undefinedVar', kind: 'variable', loc: [1, 17, 1, 28] }]);

			assertLinter('variable checking can be disabled', parser, 'f <- function() undefinedVar',
				'undefined-symbol', [], undefined, { checkVariables: false });

			assertLinter('parameters and locals are not flagged', parser, 'f <- function(a, b) { c <- a + b\n  c }',
				'undefined-symbol', []);

			assertLinter('builtin constants are not flagged', parser, 'print(pi)\nprint(T)\nprint(LETTERS)',
				'undefined-symbol', []);

			// quoting (non-standard evaluation) is recognised via flowR's dataflow
			assertLinter('quoted symbols are not flagged', parser, 'quote(someSymbol)\nsubstitute(other)',
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
}));
