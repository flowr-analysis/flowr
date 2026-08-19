import { guard } from '../../../src/util/assert';
import semver from 'semver/preload';
import { RShellExecutor } from '../../../src/r-bridge/shell-executor';
import { describe, assert, expect, test } from 'vitest';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../src/config';

describe('RShellExecutor', function() {
	test('R version', () => {
		const version = new RShellExecutor().usedRVersion();
		guard(version !== null, 'we should be able to retrieve the version of R');
		assert.isNotNull(semver.valid(version), `the version ${JSON.stringify(version)} should be a valid semver`);
		assert.isTrue(semver.gt(version, '0.0.0'), `the version ${JSON.stringify(version)} should not be 0.0.0`);
	});

	test('ignore errors', () => {
		const executor = new RShellExecutor()
			.addPrerequisites('options(warn=-1); invisible(Sys.setlocale("LC_MESSAGES", \'en_GB.UTF-8\'))');

		// check the regular result when an error occurs
		const error = executor.run('a', true);
		assert.match(error, /Error.*'a'/g);
		assert.match(error, /halted/g);
	});
});

describe('TreeSitterExecutor', () => {
	test('query() frees the WASM-backed query it compiles from a string', () => {
		const ts = new TreeSitterExecutor();
		const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
		const tree = ts.parse(requestFromInput('x <- 1'), ctx);
		let freed = 0;
		const original = ts.createQuery.bind(ts);
		ts.createQuery = (source: string) => {
			const q = original(source);
			const del = q.delete.bind(q);
			q.delete = () => {
				freed++;
				del();
			};
			return q;
		};
		ts.query('(_) @node', tree);
		expect(freed).toBe(1);
		tree.delete();
		ts.close();
	});
});
