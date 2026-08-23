import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { RdMatch } from '../../../../src/project/plugins/file-plugins/files/flowr-rd-file';
import type { ReadOnlyFlowrAnalyzerFilesContext } from '../../../../src/project/context/flowr-analyzer-files-context';

const Files: Record<string, string> = {
	'man/macros/local.Rd': '\\newcommand{\\pkg}{mypkg}',
	'man/lm.Rd':           '\\name{lm}\\alias{lm}\\alias{print.lm}\\title{Fitting \\pkg Models}\\keyword{regression}',
	'man/sin.Rd':          '\\name{Arith-methods}\\alias{sin,myclass-method}',
	'INDEX':               'lm    Fitting Linear Models\ndeprecatedOnly    A Topic With No Page',
	'data/datalist':       'CAex\nboth: alpha beta',
	'R/main.R':            'x <- 1'
};

async function filesContext(): Promise<ReadOnlyFlowrAnalyzerFilesContext> {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	for(const [path, content] of Object.entries(Files)) {
		analyzer.addFile(new FlowrInlineTextFile(path, content));
	}
	analyzer.addRequest({ request: 'file', content: 'R/main.R' });
	await analyzer.dataflow();
	return analyzer.inspectContext().files;
}

describe('Documentation files an R package carries', () => {
	test('every one of them is tagged as documentation, the datalist as data', async() => {
		const files = await filesContext();
		const documented = files.getFilesByRole(FileRole.Documentation).map(f => f.path());
		assert.includeMembers(documented, ['man/macros/local.Rd', 'man/lm.Rd', 'man/sin.Rd', 'INDEX']);
		assert.notInclude(documented, 'data/datalist', 'a datalist states data, not documentation');
		assert.include(files.getFilesByRole(FileRole.Data).map(f => f.path()), 'data/datalist');
	});

	test('the manual answers which page documents a name', async() => {
		const manual = (await filesContext()).documentation();
		assert.deepEqual(manual.topicOf('lm'), { topic: 'lm', via: RdMatch.Page });
		assert.deepEqual(manual.topicOf('print.lm'), { topic: 'lm', via: RdMatch.Alias });
		/* only the `sin,myclass-method` spelling is written down, so the bare generic answers through it */
		assert.deepEqual(manual.topicOf('sin'), { topic: 'Arith-methods', via: RdMatch.S4Method });
		assert.isFalse(manual.documents('neverDocumented'));
	});

	test('a page states what it renders, with the package\'s own macros expanded', async() => {
		const manual = (await filesContext()).documentation();
		assert.strictEqual(manual.page('lm')?.title, 'Fitting mypkg Models');
		assert.deepEqual(manual.page('lm')?.keywords, ['regression']);
	});

	test('an INDEX contributes the topics no page was loaded for', async() => {
		const manual = (await filesContext()).documentation();
		assert.isTrue(manual.documents('deprecatedOnly'));
		assert.strictEqual(manual.title('deprecatedOnly'), 'A Topic With No Page');
		/* the page's own title wins over the table's, as it is the source the table was built from */
		assert.strictEqual(manual.title('lm'), 'Fitting mypkg Models');
	});

	test('the datalist says which objects a dataset provides', async() => {
		const files = await filesContext();
		assert.deepEqual(files.datasetObjects('both'), ['alpha', 'beta']);
		assert.deepEqual(files.datasetObjects('CAex'), ['CAex']);
		assert.deepEqual(files.datasetObjects('notADataset'), []);
	});
});
