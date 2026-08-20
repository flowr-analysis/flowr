import { assert, describe, test } from 'vitest';
import { missingSigDbWarning } from '../../../src/documentation/doc-util/doc-sigdb';
import { label } from '../_helper/label';

describe('Signature database documentation', () => {
	test(label('the warning names the page and how to get the database', ['name-normal'], ['other']), () => {
		const warning = missingSigDbWarning('wiki/Query API.md');
		assert.include(warning, 'wiki/Query API.md');
		assert.include(warning, 'npm run sync:sigdb');
		assert.include(warning, 'no signature database installed');
	});
});
