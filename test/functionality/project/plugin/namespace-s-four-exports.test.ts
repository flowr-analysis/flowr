import { assert, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import type { FunctionInfo } from '../../../../src/project/context/flowr-analyzer-functions-context';
import { getExportedNames, isExportedInInfo, type NamespaceInfo } from '../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';

const Namespace = `export(plainFunction)
exportMethods(show, summary)
exportClasses("Account", "Ledger")
S3method(print, rel)
`;

/** the context-parsed path needs a real analyzer, which is what tells the S4 directives apart */
async function contextParsed(): Promise<{ info: NamespaceInfo, fn: (name: string) => FunctionInfo[] }> {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	analyzer.addFile(new FlowrInlineTextFile('NAMESPACE', Namespace));
	analyzer.addFile(new FlowrInlineTextFile('test.R', 'x <- 1'));
	analyzer.addRequest({ request: 'file', content: 'test.R' });
	await analyzer.dataflow();
	const ctx = analyzer.inspectContext();
	const info = ctx.deps.getDependency('current')?.namespaceInfo as NamespaceInfo;
	const fn = (name: string): FunctionInfo[] => {
		const found = ctx.deps.functionsContext.getFunctionInfo('current', name);
		return found === undefined ? [] : Array.isArray(found) ? found : [found];
	};
	return { info, fn };
}

const parsed = contextParsed();

test('exportMethods/exportClasses are reported apart from ordinary exports, yet all remain exports', async() => {
	const { info, fn } = await parsed;
	assert.deepEqual(info.exportedSymbols, ['plainFunction']);
	assert.deepEqual(info.exportedS4Methods, ['show', 'summary']);
	assert.deepEqual(info.exportedS4Classes, ['Account', 'Ledger']);
	assert.notInclude(info.exportedFunctions, 'show', 'an S4 method is no longer an ordinary export');
	assert.notInclude(info.exportedFunctions, 'Account');
	for(const name of ['plainFunction', 'show', 'summary', 'Account', 'Ledger']) {
		assert.isTrue(isExportedInInfo(name, info), `${name} is exported`);
		assert.include(getExportedNames(info), name);
	}
	assert.isTrue(fn('plainFunction')[0]?.isExported, 'an ordinary export is still marked as exported');
});

test.each([
	['show', true, false], ['Account', false, true], ['plainFunction', false, false]
] as const)('%s carries isS4Method=%s, isS4Class=%s', async(name, isS4Method, isS4Class) => {
	const { fn } = await parsed;
	const [found] = fn(name);
	assert.strictEqual(!!found?.isS4Method, isS4Method, name);
	assert.strictEqual(!!found?.isS4Class, isS4Class, name);
});
