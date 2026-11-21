import { assert, describe, test } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import path from 'path';
import { label } from '../../_helper/label';

/** The secure mode cannot be disabled once enabled, hence everything runs in a separate process. */
describe('Secure mode', () => {
	const root = path.join(__dirname, '..', '..', '..', '..');
	const env = { ...process.env, FLOWR_VERBOSE: 'false', FLOWR_SECURE_MODE: '1' };

	test(label('forbids R, processes, and untrusted config, but still analyzes', ['name-normal'], ['other']), () => {
		const out = execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', path.join(__dirname, 'secure-mode-probe.ts')], { cwd: root, env, encoding: 'utf8' });
		const result = JSON.parse(out.trim().split('\n').pop() as string) as Record<string, unknown>;
		assert.deepStrictEqual(result, {
			enabled:          true,
			noDisable:        true,
			rShellExecutor:   'refused: starting R',
			rShell:           'refused: starting R',
			fork:             'refused: starting a process',
			gzipBomb:         'bounded',
			regexConfig:      true,
			lintRegexIgnored: true,
			parsedRPath:      null,
			absoluteRPath:    null,
			searchedRPath:    null,
			engines:          ['tree-sitter'],
			defaultEngine:    'tree-sitter',
			analysis:         'ok'
		});
	}, 120_000);

	test(label('the CLI refuses --r-session-access in secure mode', ['name-normal'], ['other']), () => {
		const run = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/cli/flowr.ts', '--secure', '--r-session-access', '-e', ':version'], {
			cwd: root, env: { ...process.env, FLOWR_VERBOSE: 'false' }, encoding: 'utf8', timeout: 120_000
		});
		assert.strictEqual(run.status, 1, run.stderr);
		assert.include(run.stderr, 'secure mode forbids --r-session-access');
	}, 130_000);
});
