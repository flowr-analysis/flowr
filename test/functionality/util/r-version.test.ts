import { assert, describe, test } from 'vitest';
import { Range, SemVer } from 'semver';
import { parseRRange, parseRVersion } from '../../../src/util/r-version';

describe('R Version Utility', () => {
	describe('Version', () => {
		function check(...tests: readonly [give: string, want: string][]) {
			test.each(tests)('parse %s', (version, expect) => {
				const parsed = parseRVersion(version);
				assert.strictEqual(parsed.str, version, `Original version string mismatch for input "${version}"`);
				const other = new SemVer(expect);
				assert.strictEqual(parsed.compare(other), 0, `Parsed version ${parsed.version} does not match expected ${other.format()}`);
			});
		}

		check(
			['4.2.1', '4.2.1'],
			['4.2.1.9000', '4.2.1-9000'],
			['4.2.1.9000.100', '4.2.1-9000.100'],
			['4.2.1.9000.100-a', '4.2.1-9000.100-a'],
			['4.2.1-beta1', '4.2.1-beta1'],
			['4.2.1-beta.1', '4.2.1-beta.1'],
			['4.2.1-rc2', '4.2.1-rc2'],
			['4.2.1-rc.2', '4.2.1-rc.2'],
			['4.2.1-alpha', '4.2.1-alpha'],
			['4.2.1-alpha.5', '4.2.1-alpha.5'],
			['4.2', '4.2.0'],
			['4', '4.0.0'],
			['00004', '4.0.0'],
			['4.00', '4.00'],
			['12.01', '12.01']
		);
	});

	describe.only('Range', () => {
		function check(...tests: readonly [give: string, want: string][]) {
			test.each(tests)('parse %s', (versionRange, expect) => {
				const parsed = parseRRange(versionRange);
				assert.strictEqual(parsed.str, versionRange, `Original version string mismatch for input "${versionRange}"`);
				const other = new Range(expect);
				assert.isTrue(parsed.intersects(other), `Parsed range ${parsed.raw} does not match expected ${other.raw}`);
			});
		}
		check(
			['>=4.2.1', '>=4.2.1'],
			['>4.2.1', '>4.2.1'],
			['>= 4.2.1.9000', '>= 4.2.1-9000'],
			['<4.2.1.9000.100', '<4.2.1-9000.100'],
			['<=4.2.1-beta1', '<=4.2.1-beta1'],
			['^4.2.1-rc2', '^4.2.1-rc2'],
			['~4.2.1-alpha', '~4.2.1-alpha'],
			['4.2', '4.2.0'],
			['4.2-1', '4.2.0-1'],
			['>=4.2-1', '>=4.2.0-1'],
			['4.2.-1', '4.2.0-1'],
			['>=4.2.-1', '>=4.2.0-1'],
			['>=4..-1', '>=4.0.0-1'],
			['4-1', '4.0.0-1'],
			['>=4-1', '>=4.0.0-1'],
			['4', '4.0.0'],
			['==4.2.1', '=4.2.1'],
			['>=3.5.0 <4.0.0', '>=3.5.0 <4.0.0'],
			['>=4.0.0 <4.2.0 || >=4.2.1', '>=4.0.0 <4.2.0 || >=4.2.1'],
			['>=3.00', '>=3.0.0'],
			['>=5.01', '>=5.1.0'],
		);
	});
});