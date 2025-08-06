import { describe, test , assert } from 'vitest';
import { Package } from '../../../src/project/plugins/package-version-plugins/package';
import { minVersion, Range } from 'semver';

describe('DESCRIPTION-file', function() {
	describe.sequential('Parsing', function() {
		test('Library-Versions-Plugin', () => {
			const p1 = new Package();
			p1.addInfo('Test Package', 'package', undefined, new Range('>= 1.3'));
			p1.addInfo(undefined, undefined, undefined, new Range('<= 2.3'));
			p1.addInfo(undefined, undefined, undefined, new Range('>= 1.5'));
			p1.addInfo(undefined, undefined, undefined, new Range('<= 2.2.5'));

			console.log(p1.derivedVersion);
			console.log(minVersion(p1.derivedVersion as Range));

			assert.isTrue(p1.derivedVersion?.test('1.7.0'));
		});
	});
});