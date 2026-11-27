import { assert, describe, test } from 'vitest';
import { gitWebUrl, packageSourceUrl } from '../../../src/util/r-package-urls';

describe('Where a file of a package\'s sources is online', () => {
	const at = { file: 'src/nat.c', line: 26, endLine: 31 };
	const url = (pkg: string, place: Parameters<typeof packageSourceUrl>[1]) => packageSourceUrl(pkg, place);
	test('CRAN\'s mirror at the version, R\'s own sources for a base package', () => {
		assert.strictEqual(url('nat', { ...at, version: '1.0' }), 'https://github.com/cran/nat/blob/1.0/src/nat.c#L26-L31');
		assert.strictEqual(url('stats', { file: 'src/fft.c', line: 3, base: true, version: '4.5.1' }), 'https://github.com/wch/r-source/blob/R-4-5-branch/src/library/stats/src/fft.c#L3');
	});
	test('a git repository at HEAD, GitLab with its own path', () => {
		assert.strictEqual(url('nat', { ...at, source: 'https://github.com/o/nat.git' }), 'https://github.com/o/nat/blob/HEAD/src/nat.c#L26-L31');
		assert.strictEqual(url('nat', { ...at, source: 'git@gitlab.com:o/nat.git' }), 'https://gitlab.com/o/nat/-/blob/HEAD/src/nat.c#L26-L31');
		assert.strictEqual(gitWebUrl('https://codeberg.org/o/nat'), 'https://codeberg.org/o/nat');
		assert.isUndefined(gitWebUrl('cran'));
	});
	test('an R-universe\'s repository, Bioconductor\'s browser, else the repository\'s page', () => {
		assert.strictEqual(url('nat', { ...at, source: 'runiverse:r-lib' }), 'https://github.com/r-lib/nat/blob/HEAD/src/nat.c#L26-L31');
		assert.strictEqual(url('nat', { ...at, source: 'bioc' }), 'https://code.bioconductor.org/browse/nat/blob/devel/src/nat.c#L26-L31');
		assert.strictEqual(url('nat', { ...at, source: 'omegahat' }), 'https://www.omegahat.net/nat/');
	});
});
