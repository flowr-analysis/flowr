import { describe, test , assert } from 'vitest';
import { Package } from '../../../src/project/plugins/package-version-plugins/package';
import { Range } from 'semver';

describe('DESCRIPTION-file', function() {
	describe.sequential('Parsing', function() {
		test('Library-Versions-Plugin', () => {
			const p1 = new Package({ name: 'Test Package' });
			p1.addInfo({ type: 'package', versionConstraints: [new Range('>=1.3')] });
			p1.addInfo({ versionConstraints: [new Range('<=2.3')] });
			p1.addInfo({ versionConstraints: [new Range('>=1.5')] });
			p1.addInfo({ versionConstraints: [new Range('<=2.2.5')] });

			assert.isTrue(p1.derivedVersion?.test('1.7.0'));
		});
	});
});