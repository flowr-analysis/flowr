import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DeprecationState } from '../../../src/linter/rules/deprecated-functions';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';
import type { DecodedFunction } from '../../../src/project/sigdb/decode';
import type { LibraryExports } from '../../../src/project/sigdb/schema';
import { RRange } from '../../../src/util/r-version';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import { expFn, sigTmpDir, ver, writeAndOpen } from '../_helper/sigdb';

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
			{ hardcoded: 0, sigdb: 0 },
			{ always: [] }
		);
		/* Given that we declare `cat` as deprecated, we expect all uses to be marked! */
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12], type: 'deprecated-function' },
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [4, 1, 4, 6], type: 'deprecated-function' },
			],
			{ hardcoded: 2, sigdb: 0 },
			{ always: ['cat'] }
		);
		/* Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated */
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'cat', loc: [1, 1, 1, 12], type: 'deprecated-function' }
			],
			{ hardcoded: 1, sigdb: 0 },
			{ always: ['cat'] }
		);
		/* Using the default linter configuration, a function such as `all_equal` should be marked as deprecated */
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 1, 1, 14], type: 'deprecated-function' }
			],
			{ hardcoded: 1, sigdb: 0 }
		);
		/* We should find deprecated functions even if they are nested in other function calls */
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [1, 5, 1, 18], type: 'deprecated-function' }
			],
			{ hardcoded: 1, sigdb: 0 }
		);
		/* @ignore-in-wiki */
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingResultCertainty.Certain, function: 'dplyr::all_equal', loc: [4, 1, 4, 31], type: 'deprecated-function' }],
		{ hardcoded: 1, sigdb: 0 });

		describe('a deprecated function resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ hardcoded: 1, sigdb: 0 },
				{ always: ['recode'], sigDb: controlledSigDb('dplyr', ['recode', 'filter']) }
			);
			assertLinter('without any package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ hardcoded: 1, sigdb: 0 },
				{ always: ['recode'], noSigDb: true }
			);
		});

		describe('only detect deprecated arg when value is set', () => {
			assertLinter('deprecated arg but value not set', parser, 'testFn(badArg="hehe")',
				'deprecated-functions',
				[],
				{ hardcoded: 0, sigdb: 0 },
				{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', ifValue: 'not hehe', state: DeprecationState.Deprecated }] } } }
			);

			assertLinter('deprecated arg present', parser, 'testFn(badArg="not hehe")',
				'deprecated-functions',
				[{
					type:         'deprecated-argument',
					certainty:    LintingResultCertainty.Certain,
					arg:          'badArg',
					replacedBy:   undefined,
					function:     'testFn',
					state:        DeprecationState.Deprecated,
					sinceVersion: undefined,
					loc:          [1, 8, 1, 13]
				}],
				{ hardcoded: 1, sigdb: 0 },
				{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', ifValue: 'not hehe', state: DeprecationState.Deprecated }] } } }
			);
		});

		describe('only detect deprecated args when present', () => {
			assertLinter('deprecated arg but not present', parser, 'testFn()',
				'deprecated-functions',
				[],
				{ hardcoded: 0, sigdb: 0 },
				{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated }] } } }
			);

			assertLinter('deprecated arg present', parser, 'testFn(badArg=5)',
				'deprecated-functions',
				[{
					type:         'deprecated-argument',
					certainty:    LintingResultCertainty.Certain,
					arg:          'badArg',
					replacedBy:   'foo',
					function:     'testFn',
					state:        DeprecationState.Deprecated,
					sinceVersion: undefined,
					loc:          [1, 8, 1, 13]
				}],
				{ hardcoded: 1, sigdb: 0 },
				{ always: [], conditionally: {  'testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo' }] } } }
			);
		});

		describe('only detect deprecated fn/args when present and version constraint is satisfied', async() => {
			const b = new SigDbBuilder();
			b.addVersion('testPkg', '2.0.0', ver([expFn('testFn')]));
			const db = await writeAndOpen(sigTmpDir('dep-lint'), b.build({ date: '2026-05-23', generated: 0 }));

			describe('deprecated arg', () => {
				assertLinter('unresolved version should make result uncertain', parser, 'library(testPkg)\ntestFn(badArg=5)',
					'deprecated-functions',
					[{
						type:         'deprecated-argument',
						certainty:    LintingResultCertainty.Uncertain,
						arg:          'badArg',
						replacedBy:   'foo',
						function:     'testFn',
						state:        DeprecationState.Deprecated,
						sinceVersion: RRange.parse('>=1.0.0'),
						loc:          [2, 8, 2, 13]
					}],
					{ hardcoded: 1, sigdb: 0 },
					{ always: [], conditionally: { 'testFn': { package: 'testPkg', whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } } }
				);

				assertLinter('version resolved and constraint satisfied', parser, 'library(testPkg)\ntestFn(badArg=5)',
					'deprecated-functions',
					[{
						type:         'deprecated-argument',
						certainty:    LintingResultCertainty.Certain,
						arg:          'badArg',
						replacedBy:   'foo',
						function:     'testFn',
						state:        DeprecationState.Deprecated,
						sinceVersion: RRange.parse('>=1.0.0'),
						loc:          [2, 8, 2, 13]
					}],
					{ hardcoded: 1, sigdb: 0 },
					{
						always:        [],
						conditionally: { 'testFn': { package: 'testPkg', whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } },
						sigDb:         db
					}
				);

				assertLinter('version resolved and constraint not satisfied', parser, 'library(testPkg)\ntestFn(badArg=5)',
					'deprecated-functions',
					[],
					{ hardcoded: 0, sigdb: 0 },
					{
						always:        [],
						conditionally: { 'testFn': { package: 'testPkg', whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=3.0.0') }] } },
						sigDb:         db
					}
				);
			});

			describe('deprecated function', () => {
				describe('deprecated arg', () => {
					assertLinter('unresolved version should make result uncertain', parser, 'library(testPkg)\ntestFn()',
						'deprecated-functions',
						[{
							type:         'deprecated-function',
							certainty:    LintingResultCertainty.Uncertain,
							function:     'testFn',
							state:        DeprecationState.Defunct,
							sinceVersion: RRange.parse('>=1.0.0'),
							replacedBy:   undefined,
							loc:          [2, 1, 2, 8]
						}],
						{ hardcoded: 1, sigdb: 0 },
						{ always: [], conditionally: { 'testFn': { package: 'testPkg', sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } } }
					);

					assertLinter('version resolved and constraint satisfied', parser, 'library(testPkg)\ntestFn()',
						'deprecated-functions',
						[{
							type:         'deprecated-function',
							certainty:    LintingResultCertainty.Certain,
							function:     'testFn',
							state:        DeprecationState.Defunct,
							sinceVersion: RRange.parse('>=1.0.0'),
							replacedBy:   undefined,
							loc:          [2, 1, 2, 8]
						}],
						{ hardcoded: 1, sigdb: 0 },
						{
							always:        [],
							conditionally: { 'testFn': { package: 'testPkg', sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } },
							sigDb:         db
						}
					);

					assertLinter('version resolved and constraint not satisfied', parser, 'library(testPkg)\ntestFn()',
						'deprecated-functions',
						[],
						{ hardcoded: 1, sigdb: 0 },
						{
							always:        [],
							conditionally: { 'testFn': { package: 'testPkg', sinceVersion: RRange.parse('>= 3.0.0'), state: DeprecationState.Defunct } },
							sigDb:         db
						}
					);
				});
			});
		});

		describe('a call the signature database marks deprecated is flagged even outside the hardcoded list', () => {
			assertLinter('sigdb-deprecated function not in fns', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions',
				[{ type: 'deprecated-function', certainty: LintingResultCertainty.Certain, function: 'dplyr::old_verb', loc: [2, 1, 2, 11] }],
				{ hardcoded: 0, sigdb: 1 },
				{ fns: [], sigDb: sigDbWithDeprecatedFn('dplyr', 'old_verb') }
			);
			assertLinter('not flagged without a package database', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions', [],
				{ hardcoded: 0, sigdb: 0 },
				{ fns: [], noSigDb: true }
			);
		});
	});
}));
