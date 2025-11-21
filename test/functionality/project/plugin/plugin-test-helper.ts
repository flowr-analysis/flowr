import { assert, test } from 'vitest';
import type { FlowrFile, FlowrFileProvider } from '../../../../src/project/context/flowr-file';
import { FileRole } from '../../../../src/project/context/flowr-file';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import type { FlowrAnalyzerFilePlugin } from '../../../../src/project/plugins/file-plugins/flowr-analyzer-file-plugin';

export type TestPluginFileType = new (file: FlowrFileProvider<string>) => FlowrFile;
type LoadFn = (analyzer: FlowrAnalyzer) => void;
type TestCaseEntries = [string, LoadFn][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructTo<T> = new (...args: any) => T;

/**
 * Tests the loading of a file which is loaded via a special Plugin via various methods
 * @param pluginType - The Plugin to test
 * @param pluginFileType - The File that should be created by the plugin
 * @param testFilePath - The path to the file to test
 */
export async function testFileLoadPlugin<F extends ConstructTo<FlowrFile>, P extends ConstructTo<FlowrAnalyzerFilePlugin>>(pluginType: P, pluginFileType: F, testFilePath: string, expectedContent: string) {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.registerPlugins(new pluginType())
		.build();

	test.each([
		['file protocol', (analyzer) => {
			analyzer.addRequest(`${fileProtocol}${testFilePath}`);
		}],
		['direct path', (analyzer) => {
			analyzer.addRequest(testFilePath);
		}],
		['duplicate request', (analyzer) => {
			analyzer.addRequest(testFilePath);
			analyzer.addRequest(testFilePath);
		}],
	] satisfies TestCaseEntries)('load via $0', async(_, loadFn: LoadFn) => {
		analyzer.reset();

		loadFn(analyzer);
		await analyzer.parse();

		const files = analyzer.inspectContext().files.getFilesByRole(FileRole.Source);
		assert(files.length === 1);
		assert(files[0] instanceof pluginFileType);
		assert.equal(files[0].content(), expectedContent);
	});
}
