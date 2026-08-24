import { assert, test } from 'vitest';
import type { FlowrFile, FlowrFileProvider } from '../../../../src/project/context/flowr-file';
import { FileRole } from '../../../../src/project/context/flowr-file';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import type { FlowrAnalyzerFilePlugin } from '../../../../src/project/plugins/file-plugins/flowr-analyzer-file-plugin';
import { label } from '../../_helper/label';
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import type { RdIndex, RdTopicMatch } from '../../../../src/project/plugins/file-plugins/files/flowr-rd-file';

export type TestPluginFileType = new (file: FlowrFileProvider<string>) => FlowrFile;
type LoadFn = (analyzer: FlowrAnalyzer) => void;
type TestCaseEntries = [string, LoadFn][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructTo<T> = new (...args: any) => T;

/** Tests loading `testFilePath` (which `pluginType` registers as a `pluginFileType`) via the file protocol, a direct path, and a duplicate request; `expectedContent` is what `content()` should then report, `supp` labels the case. */
export async function testFileLoadPlugin<F extends ConstructTo<FlowrFile>, P extends ConstructTo<FlowrAnalyzerFilePlugin>>(pluginType: P, pluginFileType: F, testFilePath: string, expectedContent: string, supp: SupportedFlowrCapabilityId[]) {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').registerPlugins(new pluginType()).build();

	test.each([
		['file protocol', (a: FlowrAnalyzer) => a.addRequest(`${fileProtocol}${testFilePath}`)],
		['direct path', (a: FlowrAnalyzer) => a.addRequest(testFilePath)],
		['duplicate request', (a: FlowrAnalyzer) => [1, 2].forEach(() => a.addRequest(testFilePath))]
	] satisfies TestCaseEntries)('load via $0', async(_, loadFn: LoadFn) => {
		label(testFilePath, supp, ['other']);
		loadFn(analyzer);
		await analyzer.parse();
		const files = analyzer.inspectContext().files.getFilesByRole(FileRole.Source);
		assert.strictEqual(files.length, 1);
		assert(files[0] instanceof pluginFileType);
		assert.strictEqual(files[0].content(), expectedContent);
	});
}

/** What `index.topicOf(query)` answers, shared between the plugin's own index and a package's parsed manual. `index` may be a (possibly async) getter for one built lazily. */
export function testTopicOf(name: string, index: RdIndex | (() => RdIndex | Promise<RdIndex>), query: string, expected: RdTopicMatch | undefined) {
	test(name, async() => {
		const idx = typeof index === 'function' ? await index() : index;
		assert.deepEqual(idx.topicOf(query), expected);
	});
}
