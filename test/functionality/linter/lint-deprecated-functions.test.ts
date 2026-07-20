import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';
import type { DecodedFunction } from '../../../src/project/sigdb/decode';
import type { LibraryExports } from '../../../src/project/sigdb/schema';

/** a minimal in-memory signature source exposing a single, richly-decoded (and deprecated) function of `pkg` */
function sigDbWithDeprecatedFn(pkg: string, fnName: string): PackageSignatureSource {
	const fn: DecodedFunction = { name: fnName, line: 1, exported: true, props: ['deprecated'], signature: [], callees: [] };
	const view: LibraryExports = { version: '1.0.0', exported: [fnName], internal: [], deprecated: [fnName], s3Classes: [], s4Classes: [], cran: true };
	return {
		has:               p => p === pkg,
		hasVersion:        (p, version) => p === pkg && version === '1.0.0',
		isCranVersion:     () => true,
		lookup:            p => p === pkg ? view : undefined,
		classOwner:        () => undefined,
		functions:         p => p === pkg ? [fn] : undefined,
		functionByName:    (p, name) => p === pkg && name === fnName ? fn : undefined,
		transitiveCallees: () => undefined,
		dependencies:      () => undefined,
		packageNames:      () => [pkg],
		isBaseR:           () => false,
		coreVersions:      () => undefined,
		releaseDate:       () => undefined,
		releaseDates:      () => [],
		latestVersion:     () => undefined,
		close:             () => { /* nothing to release */ }
	};
}

describe('flowR linter', withTreeSitter(parser => {
	describe('deprecated functions', () => {
		/* Here, we expect no deprecated functions to be found, as neither `cat` nor `print` nor `<-` are listed as deprecated, we specifically clean the list of deprecated functions */
		assertLinter('no function listed', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: [] }
		);
		/* Given that we declare `cat` as deprecated, we expect all uses to be marked! */
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12] },
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [4, 1, 4, 6] },
			],
			{ totalCalls: 2, totalFunctionDefinitions: 2 },
			{ fns: ['cat'] }
		);
		/* Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated */
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['cat'] }
		);
		/* Using the default linter configuration, a function such as `all_equal` should be marked as deprecated */
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 1, 1, 14] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* We should find deprecated functions even if they are nested in other function calls */
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 5, 1, 18] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		/* @ignore-in-wiki */
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingResultCertainty.Certain, function: 'dplyr::all_equal', loc: [4, 1, 4, 31] }],
		{ totalCalls: 1, totalFunctionDefinitions: 1 });

		describe('a deprecated function resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['recode'], sigDb: controlledSigDb('dplyr', ['recode', 'filter']) }
			);
			assertLinter('without any package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['recode'], noSigDb: true }
			);
		});

		describe('a call the signature database marks deprecated is flagged even outside the hardcoded list', () => {
			assertLinter('sigdb-deprecated function not in fns', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'dplyr::old_verb', loc: [2, 1, 2, 11] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: [], sigDb: sigDbWithDeprecatedFn('dplyr', 'old_verb') }
			);
			assertLinter('not flagged without a package database', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions', [],
				{ totalCalls: 0, totalFunctionDefinitions: 0 },
				{ fns: [], noSigDb: true }
			);
		});
	});
}));
