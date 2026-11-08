import { assert, describe, test } from 'vitest';
import { FileRole } from '../../../../src/project/context/flowr-file';
import {
	FlowrAnalyzerVirtualEnvFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-virtualenv-file-plugin';
import { ctxWithFiles } from './plugin-test-helper';

describe('VirtualEnv-file', function() {
	const ctxWith = (...files: string[]) => ctxWithFiles(new FlowrAnalyzerVirtualEnvFilePlugin(), ...files);

	test('renv.lock, rv.lock and uvr.lock are tagged VirtualEnv', () => {
		const ctx = ctxWith('renv.lock', 'rv.lock', 'uvr.lock');
		const files = ctx.files.getFilesByRole(FileRole.VirtualEnv).map(f => f.path());
		assert.sameMembers(files, ['renv.lock', 'rv.lock', 'uvr.lock']);
	});

	test('unrelated files are not tagged', () => {
		const ctx = ctxWith('script.R', 'notes.lock', 'DESCRIPTION');
		assert.lengthOf(ctx.files.getFilesByRole(FileRole.VirtualEnv), 0);
	});
});
