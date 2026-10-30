import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { assert, describe, test } from 'vitest';
import { bumpVersion } from '../../../scripts/bump-version';

describe('release version bump', () => {
	const date = new Date('2026-10-11T09:36:30.123Z');
	const source = "// x\nconst version = '2.15.10';\n// y\nconst versionDate = '2026-10-04T18:32:24Z';\n";

	test('writes the version and the date without milliseconds', () => {
		assert.strictEqual(bumpVersion(source, '2.16.0', date), "// x\nconst version = '2.16.0';\n// y\nconst versionDate = '2026-10-11T09:36:30Z';\n");
	});
	test('only touches the two lines', () => {
		const other = `${source}const versionRegex = /^\\d+\\.\\d+\\.\\d+/m;\n`;
		assert.isTrue(bumpVersion(other, '3.0.0', date).endsWith('const versionRegex = /^\\d+\\.\\d+\\.\\d+/m;\n'));
	});
	test.each(['', 'v2.16.0', '2.16', '2.16.0-rc.1', '${version}'])('rejects the version %j', version => {
		assert.throws(() => bumpVersion(source, version, date), /expected a version/);
	});
	test('rejects a source without the lines', () => {
		assert.throws(() => bumpVersion("const version = '1.0.0';\n", '1.0.1', date), /lost its/);
		assert.throws(() => bumpVersion("const versionDate = '';\n", '1.0.1', date), /lost its/);
	});
	test('the real version file still has both lines', () => {
		const real = fs.readFileSync('src/util/flowr-version.ts', 'utf-8');
		const bumped = bumpVersion(real, '99.0.0', date);
		assert.include(bumped, "const version = '99.0.0'");
		assert.include(bumped, "const versionDate = '2026-10-11T09:36:30Z'");
	});
	test('release-it runs the bump before anything reads the version', () => {
		const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8')) as { 'release-it': { hooks: Record<string, string[]> } };
		assert.match(pkg['release-it'].hooks['after:bump'][0], /scripts\/bump-version\.ts \$\{version\}$/);
	});
	test('the script rewrites the file in the working directory', () => {
		/* the local entry point run by node itself, so nothing is fetched and windows needs no shell for a `.cmd` shim */
		const tsNode = path.resolve('node_modules/ts-node/dist/bin.js');
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-bump-'));
		try {
			fs.mkdirSync(path.join(dir, 'src/util'), { recursive: true });
			fs.writeFileSync(path.join(dir, 'src/util/flowr-version.ts'), source);
			execFileSync(process.execPath, [tsNode, '--transpile-only', path.resolve('scripts/bump-version.ts'), '4.5.6'], { cwd: dir, stdio: 'pipe' });
			assert.include(fs.readFileSync(path.join(dir, 'src/util/flowr-version.ts'), 'utf-8'), "const version = '4.5.6'");
			assert.throws(() => execFileSync(process.execPath, [tsNode, '--transpile-only', path.resolve('scripts/bump-version.ts')], { cwd: dir, stdio: 'pipe' }));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}, 60_000);
});
