import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { defaultConfigOptions } from '../../../../src/config';
import {
	FlowrAnalyzerLicenseFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-license-file-plugin';


describe('License-file', function() {
	const ctx = new FlowrAnalyzerContext(
		defaultConfigOptions,
		arraysGroupBy([
			new FlowrAnalyzerLicenseFilePlugin()
		], p => p.type)
	);

	ctx.addFile(new FlowrInlineTextFile('LICENSE', 'Hey'));
	ctx.resolvePreAnalysis();

	test('Get the License!', () => {
		const files = ctx.files.getFilesByRole(FileRole.License);
		assert.lengthOf(files, 1, 'There should be exactly one License file');

		const content = files[0].content();
		assert.strictEqual(content, 'Hey', 'The content of the LICENSE file should match');
	});
});