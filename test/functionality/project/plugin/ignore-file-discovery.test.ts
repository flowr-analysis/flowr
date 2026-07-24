import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import {
	FlowrAnalyzerGitignoreProjectDiscoveryPlugin,
	FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin,
	FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin
} from '../../../../src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin';
import { FlowrAnalyzerFullProjectDiscoveryPlugin, type FlowrAnalyzerProjectDiscoveryPlugin } from '../../../../src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import { isParseRequest } from '../../../../src/r-bridge/retriever';
import type { FlowrFile } from '../../../../src/project/context/flowr-file';

const roots: string[] = [];
afterAll(() => {
	for(const r of roots) {
		fs.rmSync(r, { recursive: true, force: true });
	}
});

/** Materializes `files` (path to content) below a fresh temporary root. */
function project(files: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-ignore-'));
	roots.push(root);
	for(const [file, content] of Object.entries(files)) {
		const target = path.join(root, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, content);
	}
	return root;
}

/**
 * The paths (relative to `root`) the given discovery plugin yields, posix-separated.
 * We read the plugin's result directly, as the context keeps R sources as parse requests rather than files.
 */
function discovered(plugin: FlowrAnalyzerProjectDiscoveryPlugin, root: string): string[] {
	const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), arraysGroupBy([plugin], p => p.type));
	return plugin.processor(ctx, { request: 'project', content: root })
		.map(r => isParseRequest(r) && r.request === 'file' ? r.content : (r as FlowrFile<string>).path())
		.map(p => path.relative(root, p).replaceAll(path.sep, '/'))
		.sort();
}

// the ignore plugins wrap the greedy discovery here so these tests exercise only the ignore semantics, not the
// intelligent default's file scoping (covered separately in intelligent-discovery.test.ts)
const greedy = () => new FlowrAnalyzerFullProjectDiscoveryPlugin();

describe('Ignore-file project discovery', () => {
	const files = {
		'R/main.R':      'x <- 1',
		'R/helper.R':    'y <- 2',
		'tests/big.R':   'stopifnot(TRUE)',
		'scratch.R':     'z <- 3',
		'notes.md':      '# notes',
		'.Rbuildignore': '^tests$\n^.*\\.md$\n',
		'.gitignore':    'scratch.R\n'
	};

	test('.Rbuildignore drops matching files and whole directories', () => {
		const got = discovered(new FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin(greedy()), project(files));
		assert.notInclude(got, 'tests/big.R', 'a directory matched by ^tests$ is dropped entirely');
		assert.notInclude(got, 'notes.md');
		assert.includeMembers(got, ['R/main.R', 'R/helper.R', 'scratch.R']);
	});

	test('.gitignore alone leaves the .Rbuildignore entries alone', () => {
		const got = discovered(new FlowrAnalyzerGitignoreProjectDiscoveryPlugin(greedy()), project(files));
		assert.notInclude(got, 'scratch.R');
		assert.includeMembers(got, ['tests/big.R', 'notes.md']);
	});

	test('the combined plugin respects both files', () => {
		const got = discovered(new FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin(undefined, greedy()), project(files));
		assert.sameMembers(got, ['R/main.R', 'R/helper.R', '.Rbuildignore', '.gitignore']);
	});

	test('without any ignore file everything is kept', () => {
		const got = discovered(new FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin(undefined, greedy()), project({ 'R/main.R': 'x <- 1' }));
		assert.sameMembers(got, ['R/main.R']);
	});

	test('an invalid .Rbuildignore pattern is skipped, the valid ones still apply', () => {
		const root = project({ 'R/main.R': 'x <- 1', 'notes.md': '#', '.Rbuildignore': '^([unclosed\n^.*\\.md$\n' });
		const got = discovered(new FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin(greedy()), root);
		assert.notInclude(got, 'notes.md');
		assert.include(got, 'R/main.R');
	});
});
