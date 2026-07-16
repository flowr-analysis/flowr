import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { PkgDbBuilder } from '../../../src/project/plugins/package-version-plugins/pkgdb';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/*const pkgDatabase = PkgDatabase.fromObject({
	format:  'flowr-pkgdb',
	schema:  4,
	scope:   'latest',
	content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
	strings: [],
	pkgs:    { ggplot2: ['3.5.1', ['ggplot', 'aes', 'geom_point']], random1: ['1.0.0', ['test1', 'test2']] }
});
console.log('version', pkgDatabase.content.version)*/

const b = new PkgDbBuilder();
b.addPackage('ggplot2', { latest: '3.5.1' });
b.addVersion('ggplot2', '3.5.1', { exported: ['ggplot', 'aes', 'geom_point'], internal: [], deprecated: [], cran: true });
b.addPackage('ggplot', { latest: '1.1.0' });
b.addVersion('random1', '1.0.0', { exported: ['test1', 'test2'], internal: [], deprecated: [], cran: true });
b.addVersion('random1', '1.1.0', { exported: ['test1', 'test3'], internal: [], deprecated: [], cran: true });
b.addPackage('p', { latest: '1.0' });
b.addVersion('p', '1.0', { exported: ['f'], internal: [], deprecated: [], cran: true });
const pkg = b.build('all', { version: 1, date: '2026-05-23', generated: 0 });



describe('flowR linter', withTreeSitter(parser => {
	describe('unused import', () => {
		assertLinter('Unused Import', parser, 'library(ggplot2)', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 16],
				version:   [['ggplot2', '3.5.1']]
			},
		], undefined, { pkgDb: pkg });
		assertLinter('Used and unused imports', parser, 'library(p)\nlibrary(ggplot2)\nlibrary(random1)\nggplot()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [3, 1, 3, 16],
				version:   [['random1', '1.1.0']]
			},
		], undefined, { pkgDb: pkg });
		assertLinter('Used and unused imports with require', parser, 'require(ggplot2)\nrequire(random1)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [2, 1, 2, 16],
				version:   [['random1', '1.1.0']]
			},
		], undefined, { pkgDb: pkg });
		assertLinter('Not in package database', parser, 'library(ggplot2)\nlibrary(random1)\nlibrary(notInDb)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [2, 1, 2, 16],
				version:   [['random1', '1.1.0']]
			}
		], undefined, { pkgDb: pkg });
		assertLinter('Whitelisted package', parser, 'require(p)\nrequire(ggplot2)\nrequire(random1)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 10],
				version:   [['p', '1.0']]
			},
		], undefined, { pkgDb: pkg, whitelist: ['random1'] });
	});
}));