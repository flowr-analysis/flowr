import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import type { FunctionInfo } from '../../../../src/project/context/flowr-analyzer-functions-context';
import {
	getExportedNames,
	isExportedInInfo,
	type NamespaceInfo
} from '../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';

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
	return {
		info,
		fn: (name: string) => {
			const found = ctx.deps.functionsContext.getFunctionInfo('current', name);
			return found === undefined ? [] : Array.isArray(found) ? found : [found];
		}
	};
}

describe('S4 export lists in the namespace model', () => {
	test('exportMethods and exportClasses are reported apart from ordinary exports', async() => {
		const { info } = await contextParsed();
		assert.deepEqual(info.exportedSymbols, ['plainFunction']);
		assert.deepEqual(info.exportedS4Methods, ['show', 'summary']);
		assert.deepEqual(info.exportedS4Classes, ['Account', 'Ledger']);
		assert.notInclude(info.exportedFunctions, 'show', 'an S4 method is no longer an ordinary export');
		assert.notInclude(info.exportedFunctions, 'Account');
	});

	test('they are still exports, so every consumer of the export view sees them', async() => {
		const { info } = await contextParsed();
		for(const name of ['plainFunction', 'show', 'summary', 'Account', 'Ledger']) {
			assert.isTrue(isExportedInInfo(name, info), `${name} is exported`);
			assert.include(getExportedNames(info), name);
		}
	});

	test('the functions context records which bit the name carries', async() => {
		const { fn } = await contextParsed();
		const [show] = fn('show');
		assert.isTrue(show?.isS4Method);
		assert.isNotTrue(show?.isS4Class);
		const [account] = fn('Account');
		assert.isTrue(account?.isS4Class);
		assert.isNotTrue(account?.isS4Method);
		const [plain] = fn('plainFunction');
		assert.isNotTrue(plain?.isS4Method);
		assert.isNotTrue(plain?.isS4Class);
		assert.isTrue(plain?.isExported);
	});
});
