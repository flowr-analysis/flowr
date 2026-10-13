import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';
import type { DecodedFunction } from '../../../src/project/sigdb/decode';
import type { LibraryExports } from '../../../src/project/sigdb/schema';

function sigDbWithNames(pkg: string, names: Record<string, boolean>): PackageSignatureSource {
	const fnOf = (name: string, exported: boolean): DecodedFunction => ({ name, line: 1, exported, props: [], signature: [], callees: [] });
	const exported = Object.keys(names).filter(n => names[n]);
	const internal = Object.keys(names).filter(n => !names[n]);
	const view: LibraryExports = { version: '1.0.0', exported, internal, deprecated: [], s3Classes: [], s4Classes: [], cran: true };
	return {
		has:               p => p === pkg,
		hasVersion:        (p, version) => p === pkg && version === '1.0.0',
		isCranVersion:     () => true,
		sourceOf:          () => undefined,
		lookup:            p => p === pkg ? view : undefined,
		classOwner:        () => undefined,
		packagesExporting: name => names[name] ? [pkg] : [],
		functions:         p => p === pkg ? Object.keys(names).map(n => fnOf(n, names[n])) : undefined,
		functionByName:    (p, name) => p === pkg && name in names ? fnOf(name, names[name]) : undefined,
		transitiveCallees: () => undefined,
		classes:           () => undefined,
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
	describe('namespace access', () => {
		describe('flags a real mismatch', () => {
			assertLinter('unnecessary `:::` on an exported name', parser, 'stats:::median',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 14] }],
				undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			assertLinter('`::` on a name that is not exported', parser, 'stats::C_cor',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 12] }],
				undefined, { sigDb: sigDbWithNames('stats', { C_cor: false }) });

			assertLinter('unnecessary `:::` in a call', parser, 'stats:::median(1:3)',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 19] }],
				undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			assertLinter('`::` on a non-exported name in a call', parser, 'stats::C_cor(1:3)',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 17] }],
				undefined, { sigDb: sigDbWithNames('stats', { C_cor: false }) });
		});

		describe('correct usage stays silent', () => {
			assertLinter('`::` on an exported name is fine', parser, 'stats::median',
				'namespace-access', [], undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			const withS3Method = sigDbWithNames('stats', { 'print.lm': true });
			assertLinter('`:::` on a registered S3 method is necessary', parser, 'stats:::print.lm',
				'namespace-access', [], undefined, { sigDb: { ...withS3Method, functionByName: (p, name, v) => {
					const fn = withS3Method.functionByName(p, name, v);
					return fn && { ...fn, props: ['exported', 's3-method'] };
				} } });

			const withS3MethodAndExport = sigDbWithNames('stats', { 'print.lm': true, median: true });
			assertLinter('`:::` on an exported function that is no S3 method is still reported', parser, 'stats:::print.lm\nstats:::median',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [2, 1, 2, 14] }], undefined, { sigDb: { ...withS3MethodAndExport, functionByName: (p, name, v) => {
					const fn = withS3MethodAndExport.functionByName(p, name, v);
					return fn && { ...fn, props: name === 'print.lm' ? ['exported', 's3-method'] : ['exported'] };
				} } });

			assertLinter('`:::` on a genuinely internal name is fine', parser, 'stats:::C_cor',
				'namespace-access', [], undefined, { sigDb: sigDbWithNames('stats', { C_cor: false }) });
		});

		describe('conservative: absence is never read as "not exported"', () => {
			assertLinter('unknown package is not flagged', parser, 'notAPackage:::secret',
				'namespace-access', [], undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			assertLinter('name absent from the database is not flagged', parser, 'stats:::undocumentedInternal',
				'namespace-access', [], undefined, { sigDb: controlledSigDb('stats', ['median']) });

			assertLinter('`::` on a name absent from the database is not flagged either', parser, 'stats::undocumentedInternal',
				'namespace-access', [], undefined, { sigDb: controlledSigDb('stats', ['median']) });

			assertLinter('no signature database mounted', parser, 'stats:::median',
				'namespace-access', [], undefined, { noSigDb: true });
		});
	});
}));
