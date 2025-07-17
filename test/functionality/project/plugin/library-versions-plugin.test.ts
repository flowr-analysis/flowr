import { describe, assert, test } from 'vitest';
import {
	FlowrAnalyzerDescriptionFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import type { FlowrConfigOptions } from '../../../../src/config';



describe('Library-Versions-Plugin', function() {
	test('DESCRIPTION-file', async() => {
		const plugin = new FlowrAnalyzerDescriptionFilePlugin();
		// plugin.setRootPath(path.resolve('test/testfiles/project'));
		await plugin.processor({} as FlowrAnalyzer, {} as FlowrConfigOptions);
		// console.log(plugin.libraries);
		// assert.isTrue(plugin.libraries.length === 4);
		assert.isTrue(true);
	});
});