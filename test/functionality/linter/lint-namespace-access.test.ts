import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { singlePackageSigDb } from '../_helper/sigdb';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import type { PackageSignatureSource } from '../../../src/project/sigdb/reader';

function sigDbWithNames(pkg: string, names: Record<string, boolean>): PackageSignatureSource {
	return singlePackageSigDb(pkg, Object.entries(names).map(([name, exported]) => ({ name, line: 1, exported, props: [], signature: [], callees: [] })));
}

describe('flowR linter', withTreeSitter(parser => {
	describe('namespace access', () => {
		describe('flags a real mismatch', () => {
			assertLinter('unnecessary `:::` on an exported name', parser, 'stats:::median',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 14], quickFix: [{ type: 'replace', loc: [1, 1, 1, 14], description: 'Use `stats::median`', replacement: 'stats::median' }] }],
				undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			assertLinter('`::` on a name that is not exported', parser, 'stats::C_cor',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 12], quickFix: [{ type: 'replace', loc: [1, 1, 1, 12], description: 'Use `stats:::C_cor`', replacement: 'stats:::C_cor' }] }],
				undefined, { sigDb: sigDbWithNames('stats', { C_cor: false }) });

			assertLinter('unnecessary `:::` in a call', parser, 'stats:::median(1:3)',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 19], quickFix: [{ type: 'replace', loc: [1, 1, 1, 14], description: 'Use `stats::median`', replacement: 'stats::median' }] }],
				undefined, { sigDb: sigDbWithNames('stats', { median: true }) });

			assertLinter('`::` on a non-exported name in a call', parser, 'stats::C_cor(1:3)',
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 17], quickFix: [{ type: 'replace', loc: [1, 1, 1, 12], description: 'Use `stats:::C_cor`', replacement: 'stats:::C_cor' }] }],
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
				'namespace-access', [{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [2, 1, 2, 14], quickFix: [{ type: 'replace', loc: [2, 1, 2, 14], description: 'Use `stats::median`', replacement: 'stats::median' }] }], undefined, { sigDb: { ...withS3MethodAndExport, functionByName: (p, name, v) => {
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
