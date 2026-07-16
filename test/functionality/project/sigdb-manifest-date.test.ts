import { assert, describe, test } from 'vitest';
import {
	defaultSigDbPath,
	readManifestDate,
	readManifestFile,
	type SigDbScope
} from '../../../src/project/sigdb/manifest';

describe('sigdb manifest date', () => {
	const scopes: SigDbScope[] = ['base', 'current', 'full', 'history' as SigDbScope];
	const shipped = scopes.map(s => [s, defaultSigDbPath(s)] as const).filter(([, f]) => f !== undefined);

	test('some manifest ships, so the checks below are not vacuous', () => {
		assert.isNotEmpty(shipped);
	});

	for(const [scope, file] of shipped) {
		test(`the shortcut agrees with a full parse (${scope})`, () => {
			assert.strictEqual(readManifestDate(file as string), readManifestFile(file as string).date);
		});
	}
});
