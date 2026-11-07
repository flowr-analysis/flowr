#!/usr/bin/env node
/*
 * `npm run test`: runs the tests affected by uncommitted changes (`vitest --changed`), unless the call already
 * names what to run (test files, directories, or a `-t` name filter), which `--changed` would otherwise narrow
 * down to nothing for unchanged tests. The tests are selected by `scripts/test-select.mjs` (near importers and the
 * mirrored test folder), as the complete import graph of `--changed` selects nearly everything. `--exact` restores that.
 */
import { spawnSync } from 'node:child_process';
import { changedFiles, selectTests } from './test-select.mjs';

const exact = process.argv.includes('--exact');
const args = process.argv.slice(2).filter(a => a !== '--exact');
const valueFlags = new Set(['-t', '--testNamePattern', '--project', '--config', '-c', '--reporter', '--exclude', '--maxWorkers', '--minWorkers', '--pool', '--shard', '--bail', '--retry', '--outputFile', '--root', '-r', '--dir', '--environment', '--changed']);
let targeted = false;
for(let i = 0; i < args.length; i++) {
	const arg = args[i];
	if(arg === '-t' || arg === '--testNamePattern' || arg.startsWith('--testNamePattern=') || arg === 'related') {
		targeted = true;
	} else if(valueFlags.has(arg)) {
		i++;
	} else if(!arg.startsWith('-') && arg !== 'run' && arg !== 'watch') {
		targeted = true;
	}
}
const base = ['vitest', '--exclude', 'test/system-tests/**', '--exclude', 'test/mutations/**', '--config', 'test/vitest.config.mts'];
const changed = targeted || args.some(a => a === '--changed' || a.startsWith('--changed=')) ? [] : ['--changed', '--passWithNoTests'];
const selected = changed.length > 0 && !exact ? selectTests(changedFiles()) : undefined;
const { status } = spawnSync('npx', [...base, ...(selected ?? changed), ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
