import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { FlowrConfig } from '../../../../src/config';
import {
	FlowrAnalyzerVirtualEnvFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-virtualenv-file-plugin';

describe('VirtualEnv-file', function() {
	function ctxWith(...files: string[]): FlowrAnalyzerContext {
		const ctx = new FlowrAnalyzerContext(
			FlowrConfig.default(),
			arraysGroupBy([new FlowrAnalyzerVirtualEnvFilePlugin()], p => p.type)
		);
		for(const f of files) {
			ctx.addFile(new FlowrInlineTextFile(f, ''));
		}
		return ctx;
	}

	test('renv.lock and rv.lock are tagged VirtualEnv', () => {
		const ctx = ctxWith('renv.lock', 'rv.lock');
		const files = ctx.files.getFilesByRole(FileRole.VirtualEnv).map(f => f.path());
		assert.sameMembers(files, ['renv.lock', 'rv.lock']);
	});

	test('unrelated files are not tagged', () => {
		const ctx = ctxWith('script.R', 'notes.lock', 'DESCRIPTION');
		assert.lengthOf(ctx.files.getFilesByRole(FileRole.VirtualEnv), 0);
	});
});
