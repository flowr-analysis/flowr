import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DeprecationState } from '../../../src/linter/rules/deprecated-functions';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';
import type { DecodedFunction } from '../../../src/project/sigdb/decode';
import { FnProp, type LibraryExports, type SigFunctionInfo } from '../../../src/project/sigdb/schema';
import { RRange } from '../../../src/util/r-version';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import { sigTmpDir, writeAndOpen } from '../_helper/sigdb';
import { Identifier, PkgName } from '../../../src/dataflow/environments/identifier';

const fn = (name: string, opts: Partial<SigFunctionInfo> = {}): SigFunctionInfo => ({
	name, props: FnProp.Exported, params: [], callees: [], line: 1, ...opts
});

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
		packagesExporting: name => name === fnName ? [pkg] : [],
		functions:         p => p === pkg ? [fn] : undefined,
		functionByName:    (p, name) => p === pkg && name === fnName ? fn : undefined,
		transitiveCallees: () => undefined,
		dependencies:      () => undefined,
		packageNames:      () => [pkg],
		isBaseR:           () => false,
		downloads:         () => 0,
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
			{ builtin: 0, sigdb: 0 },
			{ always: [] }
		);
		/* Given that we declare `cat` as deprecated, we expect all uses to be marked! */
		assertLinter('cat', parser, 'cat("hello")\nprint("hello")\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [1, 1, 1, 12], type: 'deprecated-function' },
				{ certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [4, 1, 4, 6], type: 'deprecated-function' },
			],
			{ builtin: 2, sigdb: 0 },
			{ always: ['cat'] }
		);
		/* Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated */
		assertLinter('custom cat', parser, 'cat("hello")\nprint("hello")\ncat <- function(x) { }\nx <- 1\ncat(x)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [1, 1, 1, 12], type: 'deprecated-function' }
			],
			{ builtin: 1, sigdb: 0 },
			{ always: ['cat'] }
		);
		/* Using the default linter configuration, a function such as `all_equal` should be marked as deprecated.
		   Nothing attaches dplyr here, so the call may be any `all_equal` and the finding is a guess */
		assertLinter('with defaults', parser, 'all_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Uncertain, function: 'all_equal', loc: [1, 1, 1, 14], type: 'deprecated-function' }
			],
			{ builtin: 1, sigdb: 0 }
		);
		/* We should find deprecated functions even if they are nested in other function calls */
		assertLinter('with defaults nested', parser, 'foo(all_equal(foo))',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Uncertain, function: 'all_equal', loc: [1, 5, 1, 18], type: 'deprecated-function' }
			],
			{ builtin: 1, sigdb: 0 }
		);
		/* attaching the package the name belongs to settles which function it is */
		assertLinter('with defaults, package attached', parser, 'library(dplyr)\nall_equal(foo)',
			'deprecated-functions', [
				{ certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [2, 1, 2, 14], type: 'deprecated-function' }
			],
			{ builtin: 1, sigdb: 0 }
		);
		/* @ignore-in-wiki */
		assertLinter('wiki example', parser, `
first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)`, 'deprecated-functions',
		[{ certainty: LintingResultCertainty.Certain, function: Identifier.from(['all_equal', PkgName.Dplyr, false]), loc: [4, 1, 4, 31], type: 'deprecated-function' }],
		{ builtin: 1, sigdb: 0 });

		describe('a deprecated function resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: Identifier.make('recode', PkgName.Dplyr), loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ builtin: 1, sigdb: 0 },
				{ always: ['recode'], sigDb: controlledSigDb('dplyr', ['recode', 'filter']) }
			);
			assertLinter('without any package database', parser, 'library(dplyr)\nrecode(x)',
				'deprecated-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }],
				{ builtin: 1, sigdb: 0 },
				{ always: ['recode'], noSigDb: true }
			);
		});

		describe('only detect deprecated arg when value is set', () => {
			assertLinter('deprecated arg but value not set', parser, 'testFn(badArg="hehe")',
				'deprecated-functions',
				[],
				{ builtin: 0, sigdb: 0 },
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
					loc:          [1, 8, 1, 13],
					quickFix:     undefined
				}],
				{ builtin: 1, sigdb: 0 },
				{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', ifValue: 'not hehe', state: DeprecationState.Deprecated }] } } }
			);
		});

		describe('only detect deprecated args when present', () => {
			assertLinter('deprecated arg but not present', parser, 'testFn()',
				'deprecated-functions',
				[],
				{ builtin: 0, sigdb: 0 },
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
					loc:          [1, 8, 1, 13],
					quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [1, 8, 1, 13] }]
				}],
				{ builtin: 1, sigdb: 0 },
				{ always: [], conditionally: {  'testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo' }] } } }
			);
		});

		describe('only deprecate when version constraint is satisfied', async() => {
			const b = new SigDbBuilder();
			b.addPackage('testPkg', { latest: '2.0.0', downloads: 5 });
			b.addVersion('testPkg', '2.0.0', { dependencies: [{ name: 'base', type: 1, constraint: '>= 1.0.0' }], cran: true, functions: [fn('testFn', { file: 'R/paste.R', line: 10, params: [ { name: 'badArg' } ] })] });
			b.addPackage('base', { latest: '4.5.3', core: true });
			const db = await writeAndOpen(sigTmpDir('dep-lint'), b.build({ date: '2026-05-23', generated: 0 }));

			assertLinter('(arg) unresolved version should make result uncertain', parser, 'library(testPkg)\ntestFn(badArg=5)',
				'deprecated-functions',
				[{
					type:         'deprecated-argument',
					certainty:    LintingResultCertainty.Uncertain,
					arg:          'badArg',
					replacedBy:   'foo',
					function:     'testFn',
					state:        DeprecationState.Deprecated,
					sinceVersion: RRange.parse('>=1.0.0'),
					loc:          [2, 8, 2, 13],
					quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [2, 8, 2, 13] }]
				}],
				{ builtin: 1, sigdb: 0 },
				{ always: [], conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } } }
			);

			assertLinter('(arg) version resolved and constraint satisfied', parser, 'library(testPkg)\ntestFn(badArg=5)',
				'deprecated-functions',
				[{
					type:         'deprecated-argument',
					certainty:    LintingResultCertainty.Certain,
					arg:          'badArg',
					replacedBy:   'foo',
					function:     Identifier.make('testFn', 'testPkg'),
					state:        DeprecationState.Deprecated,
					sinceVersion: RRange.parse('>=1.0.0'),
					loc:          [2, 8, 2, 13],
					quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [2, 8, 2, 13] }]
				}],
				{ builtin: 1, sigdb: 0 },
				{
					always:        [],
					conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } },
					sigDb:         db
				}
			);

			assertLinter('(arg) version resolved and constraint not satisfied', parser, 'library(testPkg)\ntestFn(badArg=5)',
				'deprecated-functions',
				[],
				{ builtin: 0, sigdb: 0 },
				{
					always:        [],
					conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=3.0.0') }] } },
					sigDb:         db
				}
			);



			assertLinter('(fn) unresolved version should make result uncertain', parser, 'library(testPkg)\ntestFn()',
				'deprecated-functions',
				[{
					type:         'deprecated-function',
					certainty:    LintingResultCertainty.Uncertain,
					function:     'testFn',
					state:        DeprecationState.Defunct,
					sinceVersion: RRange.parse('>=1.0.0'),
					replacedBy:   undefined,
					loc:          [2, 1, 2, 8],
					quickFix:     undefined
				}],
				{ builtin: 1, sigdb: 0 },
				{ always: [], conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } } }
			);

			assertLinter('(fn) version resolved and constraint satisfied', parser, 'library(testPkg)\ntestFn()',
				'deprecated-functions',
				[{
					type:         'deprecated-function',
					certainty:    LintingResultCertainty.Certain,
					function:     Identifier.make('testFn', 'testPkg'),
					state:        DeprecationState.Defunct,
					sinceVersion: RRange.parse('>=1.0.0'),
					replacedBy:   undefined,
					loc:          [2, 1, 2, 8],
					quickFix:     undefined
				}],
				{ builtin: 1, sigdb: 0 },
				{
					always:        [],
					conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } },
					sigDb:         db
				}
			);


			assertLinter('(fn) version resolved and constraint not satisfied', parser, 'library(testPkg)\ntestFn()',
				'deprecated-functions',
				[],
				{ builtin: 0, sigdb: 0 },
				{
					always:        [],
					conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>= 3.0.0'), state: DeprecationState.Defunct } },
					sigDb:         db
				}
			);
		});

		describe('a call the signature database marks deprecated is flagged even outside the builtin list', () => {
			assertLinter('sigdb-deprecated function not in fns', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions',
				[{ type: 'deprecated-function', certainty: LintingResultCertainty.Certain, function: Identifier.make('old_verb', PkgName.Dplyr), loc: [2, 1, 2, 11] }],
				{ builtin: 0, sigdb: 1 },
				{ fns: [], sigDb: sigDbWithDeprecatedFn('dplyr', 'old_verb') }
			);
			assertLinter('not flagged without a package database', parser, 'library(dplyr)\nold_verb(x)',
				'deprecated-functions', [],
				{ builtin: 0, sigdb: 0 },
				{ fns: [], noSigDb: true }
			);
		});

		describe('a positional argument is matched the way R fills it', () => {
			const positional = { always: [], conditionally: { 'testFn': { whenArgs: [{ argIdx: 0, replacedBy: 'newArg', state: DeprecationState.Deprecated }] } } };
			assertLinter('first argument', parser, 'testFn(99)',
				'deprecated-functions',
				[{ type:         'deprecated-argument', certainty:    LintingResultCertainty.Certain, arg:          0, replacedBy:   'newArg',
					function:     'testFn', state:        DeprecationState.Deprecated, sinceVersion: undefined, loc:          [1, 8, 1, 9], quickFix:     undefined }],
				{ builtin: 1, sigdb: 0 }, positional
			);
			/* a name binds its argument wherever it stands, so `99` still fills the first position */
			assertLinter('first argument behind a named one', parser, 'testFn(other = 1, 99)',
				'deprecated-functions',
				[{ type:         'deprecated-argument', certainty:    LintingResultCertainty.Certain, arg:          0, replacedBy:   'newArg',
					function:     'testFn', state:        DeprecationState.Deprecated, sinceVersion: undefined, loc:          [1, 19, 1, 20], quickFix:     undefined }],
				{ builtin: 1, sigdb: 0 }, positional
			);
		});

		describe('a call naming another package is another function', () => {
			assertLinter('the package the entry names', parser, 'dplyr::all_equal(x)',
				'deprecated-functions',
				[{ type: 'deprecated-function', certainty: LintingResultCertainty.Certain, function: Identifier.make('all_equal', PkgName.Dplyr), loc: [1, 1, 1, 19] }],
				{ builtin: 1, sigdb: 0 }
			);
			assertLinter('some other package', parser, 'someOther::all_equal(x)',
				'deprecated-functions', [],
				{ builtin: 0, sigdb: 0 }
			);
		});

		describe('a deprecated argument offers the replacement as a quick fix', () => {
			assertLinter('ggplot2 size becomes linewidth', parser, 'library(ggplot2)\nelement_line(size = 1)',
				'deprecated-functions',
				[{ type:         'deprecated-argument', certainty:    LintingResultCertainty.Uncertain, arg:          'size', replacedBy:   'linewidth',
					function:     'element_line', state:        DeprecationState.Deprecated, sinceVersion: RRange.parse('>= 3.4.0'), loc:          [2, 14, 2, 17],
					quickFix:     [{ type: 'replace', description: 'Replace argument `size` with `linewidth`', replacement: 'linewidth', loc: [2, 14, 2, 17] }] }],
				{ builtin: 1, sigdb: 0 }
			);
		});
	});
}));
