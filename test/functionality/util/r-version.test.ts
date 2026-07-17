import { assert, describe, test } from 'vitest';
import { Range, SemVer } from 'semver';
import { RVersion, RRange } from '../../../src/util/r-version';

describe('R Version Utility', () => {
	describe('Version', () => {
		function check(...tests: readonly [give: string, want: string][]) {
			test.each(tests)('parse %s', (version, expect) => {
				const parsed = RVersion.parse(version);
				if(parsed === undefined) {
					assert.fail(`expected "${version}" to parse into a version`);
				}
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
			['4.00', '4.0.0'],
			['12.01', '12.1.0'],
			// `-` separates a component just like `.` does, so `7.3-65` is `7.3.65` and not a pre-release of `7.3.0`
			['7.3-65', '7.3.65'],
			['0.4-9', '0.4.9'],
			['1.1-3', '1.1.3']
		);

		describe('a parsed version orders like compare does', () => {
			// a pre-release would sort *below* the release, which is what `-` used to be read as
			test.each([
				['7.3-65', '7.3.0'],
				['0.4-9', '0.4.0'],
				['1.1-3', '1.1.0']
			])('%s is above %s', (a, b) => {
				const pa = RVersion.parse(a);
				const pb = RVersion.parse(b);
				assert.isTrue(pa !== undefined && pb !== undefined);
				assert.isAbove((pa as SemVer).compare(pb as SemVer), 0, `${a} must be above ${b}`);
				assert.isAbove(RVersion.compare(a, b), 0, `${a} must be above ${b} for compare too`);
				assert.isTrue(RRange.satisfies(a, `>= ${b}`), `${a} must satisfy >= ${b}`);
			});
		});

		describe('un-coercible versions yield undefined (never throw)', () => {
			test.each([
				'',            // an empty `Version:` field
				'   ',
				'not-a-version'
			])('parse %j -> undefined', bad => {
				assert.doesNotThrow(() => RVersion.parse(bad));
				assert.isUndefined(RVersion.parse(bad));
			});
		});

		describe('compare follows R\'s numeric_version scheme', () => {
			// `.` and `-` separate equally, and each part compares numerically rather than as text
			test.each([
				['0.4-9', '0.4.10', -1],   // 9 < 10, even though "9" sorts after "1" as text
				['1.10', '1.9', 1],
				['1.0', '0.9-9', 1],
				['1.2.3', '1.2.3', 0],
				['1.2', '1.2.0', 0]        // a missing part counts as zero
			] as const)('compare %s %s', (a, b, want) => {
				assert.strictEqual(Math.sign(RVersion.compare(a, b)), want);
				assert.strictEqual(Math.sign(RVersion.compare(b, a)), -want, 'comparison must be symmetric');
			});
		});
	});

	describe('Range', () => {
		function check(...tests: readonly [give: string, want: string][]) {
			test.each(tests)('parse %s', (versionRange, expect) => {
				const parsed = RRange.parse(versionRange);
				if(parsed === undefined) {
					assert.fail(`expected "${versionRange}" to parse into a range`);
				}
				assert.strictEqual(parsed.str, versionRange, `Original version string mismatch for input "${versionRange}"`);
				const other = new Range(expect);
				assert.isTrue(parsed.intersects(other), `Parsed range ${parsed.raw} does not match expected ${other.raw}`);
				assert.strictEqual(parsed.range, other.range, `Parsed range string ${parsed.range} does not match expected ${other.range}`);
				assert.strictEqual(parsed.includePrerelease, other.includePrerelease, `Parsed range includePrerelease ${parsed.includePrerelease} does not match expected ${other.includePrerelease}`);
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
			['4.2', '>=4.2.0 <4.3.0-0'],
			// `-` separates a component just like `.` does, so these are no pre-releases (cf. the compare tests)
			['4.2-1', '4.2.1'],
			['>=4.2-1', '>=4.2.1'],
			['4-1', '4.1.0'],
			['>=4-1', '>=4.1.0'],
			// empty parts of a malformed version collapse
			['4.2.-1', '4.2.1'],
			['>=4.2.-1', '>=4.2.1'],
			['>=4..-1', '>=4.1.0'],
			['4', '>= 4.0.0 <5.0.0-0'],
			['==4.2.1', '=4.2.1'],
			['>=3.5.0 <4.0.0', '>=3.5.0 <4.0.0'],
			['>=4.0.0 <4.2.0 || >=4.2.1', '>=4.0.0 <4.2.0 || >=4.2.1'],
			['>=3.00', '>=3.0.0'],
			['>=5.01', '>=5.1.0'],
			['>= 2018-07.10', '>=2018.7.10'],
			['>=2018.0.0-07.10', '>=2018.0.0-7.10'],
			['>=0.6.0-00', '>=0.6.0-0']
		);

		describe('unparseable constraints yield undefined (never throw)', () => {
			test.each([
				'>= abc',            // a non-numeric bound (e.g. a typo'd DESCRIPTION constraint)
				'GitHub (123.0.0)',  // a lockfile git/URL "version"
				'not a version',
				'>=>=1.0'
			])('parse %j -> undefined', bad => {
				assert.doesNotThrow(() => RRange.parse(bad));
				assert.isUndefined(RRange.parse(bad));
			});
		});
	});
});