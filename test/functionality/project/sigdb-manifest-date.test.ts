import { assert, describe, test } from 'vitest';
import {
	defaultSigDbPath,
	readManifestDate,
	readManifestFile,
	type SigDbScope
} from '../../../src/project/sigdb/manifest';

describe('sigdb manifest date', () => {
	const scopes: SigDbScope[] = ['base', 'current', 'full', 'history' as SigDbScope];

	for(const scope of scopes) {
		/* the sigdb is generated, not shipped by the repository, so a fresh checkout (e.g. the ci) has none */
		const file = defaultSigDbPath(scope);
		test.skipIf(file === undefined)(`the shortcut agrees with a full parse (${scope})`, () => {
			assert.strictEqual(readManifestDate(file as string), readManifestFile(file as string).date);
		});
	}
});
