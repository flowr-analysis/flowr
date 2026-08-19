import { assert, describe, test } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

/** Needs its own process: the suite has too much loaded for the breaking import order to occur. */
describe('Search api', () => {
	test('can be imported first, without anything else loaded', () => {
		const root = path.join(__dirname, '..', '..', '..');
		const probe = 'const { Q } = require("./src/search/flowr-search-builder"); if(typeof Q?.all !== "function") { throw new Error("Q.all is missing"); } Q.all();';
		assert.doesNotThrow(() => execFileSync(
			process.execPath,
			['-r', 'ts-node/register/transpile-only', '-e', probe],
			{ cwd: root, stdio: 'pipe', env: { ...process.env, FLOWR_VERBOSE: 'false' } }
		));
	});
});
