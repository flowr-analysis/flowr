import { describe, assert, test } from 'vitest';
import {
	FlowrAnalyzerDescriptionFilePlugin
} from '../../../../src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import type { FlowrConfigOptions } from '../../../../src/config';
import path from 'path';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from '../../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from '../../../../src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';


describe('DESCRIPTION-file', function() {
	const descriptionFilePlugin = new FlowrAnalyzerDescriptionFilePlugin();
	descriptionFilePlugin.addFiles(path.resolve('test/testfiles/project/DESCRIPTION'));
	describe.sequential('Parsing', function() {
		test('Library-Versions-Plugin', async() => {
			const flowrAnalyzerPackageVersionsDescriptionFilePlugin = new FlowrAnalyzerPackageVersionsDescriptionFilePlugin();
			flowrAnalyzerPackageVersionsDescriptionFilePlugin.dependencies = [descriptionFilePlugin];

			await flowrAnalyzerPackageVersionsDescriptionFilePlugin.processor({} as FlowrAnalyzer, {} as FlowrConfigOptions);

			assert.isNotEmpty(flowrAnalyzerPackageVersionsDescriptionFilePlugin.packages);
		});

		test('Loading-Order-Plugin', async() => {
			const flowrAnalyzerLoadingOrderDescriptionFilePlugin = new FlowrAnalyzerLoadingOrderDescriptionFilePlugin();
			flowrAnalyzerLoadingOrderDescriptionFilePlugin.dependencies = [descriptionFilePlugin];

			await flowrAnalyzerLoadingOrderDescriptionFilePlugin.processor({} as FlowrAnalyzer, {} as FlowrConfigOptions);

			assert.isNotEmpty(flowrAnalyzerLoadingOrderDescriptionFilePlugin.loadingOrder);
		});
	});
});