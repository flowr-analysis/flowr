import { describe, assert, test } from 'vitest';
import {
	libraryVersionsDescriptionFilePlugin
} from '../../../../src/project/plugins/flowr-analyzer-library-versions-plugin';
import path from 'path';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import type { FlowrConfigOptions } from '../../../../src/config';

describe('Library-Versions-Plugin', function() {
	test('DESCRIPTION-file', async() => {
		const plugin = libraryVersionsDescriptionFilePlugin;
		plugin.setRootPath(path.resolve('test/testfiles/project'));
		await plugin.processor({} as FlowrAnalyzer, {} as FlowrConfigOptions);
		console.log(plugin.libraries);
		assert.isTrue(plugin.libraries.length === 4);
	});
});