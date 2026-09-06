import { assert, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FileRole, FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { RdMatch } from '../../../../src/project/plugins/file-plugins/files/flowr-rd-file';
import type { ReadOnlyFlowrAnalyzerFilesContext } from '../../../../src/project/context/flowr-analyzer-files-context';
import { testTopicOf } from './plugin-test-helper';

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

const ctx = filesContext();

test('every one of them is tagged as documentation, the datalist as data', async() => {
	const files = await ctx;
	const documented = files.getFilesByRole(FileRole.Documentation).map(f => f.path());
	assert.includeMembers(documented, ['man/macros/local.Rd', 'man/lm.Rd', 'man/sin.Rd', 'INDEX']);
	assert.notInclude(documented, 'data/datalist', 'a datalist states data, not documentation');
	assert.include(files.getFilesByRole(FileRole.Data).map(f => f.path()), 'data/datalist');
});

testTopicOf('a name is found by its own page', async() => (await ctx).documentation(), 'lm', { topic: 'lm', via: RdMatch.Page });
testTopicOf('an alias is found by the page it belongs to', async() => (await ctx).documentation(), 'print.lm', { topic: 'lm', via: RdMatch.Alias });
/* only the `sin,myclass-method` spelling is written down, so the bare generic answers through it */
testTopicOf('an S4 generic is found from its method', async() => (await ctx).documentation(), 'sin', { topic: 'Arith-methods', via: RdMatch.S4Method });

test('the manual renders macros, and INDEX fills in what has no page', async() => {
	const files = await ctx;
	const manual = files.documentation();
	assert.isFalse(manual.documents('neverDocumented'));
	assert.strictEqual(manual.page('lm')?.title, 'Fitting mypkg Models');
	assert.deepEqual(manual.page('lm')?.keywords, ['regression']);
	assert.isTrue(manual.documents('deprecatedOnly'));
	assert.strictEqual(manual.title('deprecatedOnly'), 'A Topic With No Page');
	/* the page's own title wins over the table's, as it is the source the table was built from */
	assert.strictEqual(manual.title('lm'), 'Fitting mypkg Models');
	assert.deepEqual(files.datasetObjects('both'), ['alpha', 'beta']);
	assert.deepEqual(files.datasetObjects('CAex'), ['CAex']);
	assert.deepEqual(files.datasetObjects('notADataset'), []);
});
